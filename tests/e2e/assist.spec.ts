import type { Page, Worker } from "@playwright/test";
import { dragSelect, expect, FIXTURES, prismReady, shot, tabId, test } from "./harness";

async function boxOf(page: Page, selector: string, pad = 6): Promise<[[number, number], [number, number]]> {
  const b = (await page.locator(selector).first().boundingBox())!;
  return [[b.x - pad, b.y - pad], [b.x + b.width + pad, b.y + b.height + pad]];
}

async function chooseAction(page: Page, action: string) {
  const menu = page.locator("[data-testid=prism-menu]");
  await expect(menu).toBeVisible();
  await menu.locator(`[data-action=${action}]`).click();
  const card = page.locator("[data-testid=prism-card]");
  await expect(card).toHaveAttribute("data-status", /ready|error/, { timeout: 90_000 });
  return card;
}

const SYNTHETIC_PROFILE = {
  name: "Margaret Ellison", formOfAddress: "Margaret", ageRange: "70+", country: "England", city: "Leeds",
  language: "English", otherLanguages: "", readingNeeds: "Larger text, plain language", background: "Retired school teacher",
  goals: "Lower my council tax bill", addressLine1: "14 Larkspur Close", addressLine2: "", postcode: "LS6 2QT",
  phone: "07700 900123", email: "margaret.ellison@example.com", dateOfBirth: "1951-03-27", people: [], extraFacts: [
    { id: "f1", text: "Receives Pension Credit (guarantee part)", source: "typed", addedAt: 0 },
    { id: "f2", text: "Lives alone since 2022", source: "typed", addedAt: 0 },
  ], updatedAt: 0,
};

async function setProfile(sw: Worker) {
  await sw.evaluate((profile) => chrome.storage.local.set({ profile }), SYNTHETIC_PROFILE);
}

test("Define: hold Alt and drag over a notice, get a plain explanation", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const [from, to] = await boxOf(page, "#deadline-notice");
  await dragSelect(page, from, to);
  await expect(page.locator("[data-testid=prism-sel-rect]")).toBeVisible();
  await shot(page, "assist-01-menu");
  const card = await chooseAction(page, "define");
  await expect(card).toHaveAttribute("data-status", "ready");
  const text = await card.innerText();
  expect(text.toLowerCase()).toMatch(/month|apply|backdat/);
  await shot(page, "assist-02-define");
});

test("Translate: Spanish words inside an image (OCR)", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/image-text/`);
  await prismReady(page);
  const [from, to] = await boxOf(page, "img[src='aviso-es.png']", 2);
  await dragSelect(page, from, to);
  const card = await chooseAction(page, "translate");
  await expect(card).toHaveAttribute("data-status", "ready");
  const text = (await card.innerText()).toLowerCase();
  expect(text).toContain("water");
  expect(text).toMatch(/21/);
  expect(text).toMatch(/900 123 456/);
  await shot(page, "assist-03-translate-image");
});

test("Define: English text inside an image", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/image-text/`);
  await prismReady(page);
  const [from, to] = await boxOf(page, "img[src='bin-poster.png']", 2);
  await dragSelect(page, from, to);
  const card = await chooseAction(page, "define");
  expect((await card.innerText()).toLowerCase()).toMatch(/thursday/);
  await shot(page, "assist-04-define-image");
});

test("Translate: Spanish page text, selection with key released first", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/non-english/`);
  await prismReady(page);
  const [from, to] = await boxOf(page, "#plazo");
  await dragSelect(page, from, to, { releaseKeyFirst: true });
  const card = await chooseAction(page, "translate");
  const text = (await card.innerText()).toLowerCase();
  expect(text).toMatch(/deadline|submission|period/);
  expect(text).toContain("15");
  await shot(page, "assist-05-translate-dom");
});

test("Selection: Esc cancels, tiny drag does nothing, page never gets the click", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  await page.evaluate(() => { (window as any).__clicks = 0; document.addEventListener("click", () => (window as any).__clicks++, true); });
  const link = (await page.locator("a.btn-apply").boundingBox())!;
  // Tiny drag on a link with Alt held: nothing opens, page doesn't navigate.
  await dragSelect(page, [link.x + 5, link.y + 5], [link.x + 8, link.y + 7]);
  await expect(page.locator("[data-testid=prism-menu]")).toHaveCount(0);
  expect(page.url()).toContain("/cluttered-info/");
  // Esc mid-drag cancels.
  await page.mouse.move(300, 300);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(500, 450, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect(page.locator("[data-testid=prism-menu]")).toHaveCount(0);
  await expect(page.locator("[data-testid=prism-sel-rect]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__clicks)).toBe(0);
  // Esc closes an open menu too.
  const [from, to] = await boxOf(page, "#deadline-notice");
  await dragSelect(page, from, to);
  await expect(page.locator("[data-testid=prism-menu]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-testid=prism-menu]")).toHaveCount(0);
});

test("Selection near the viewport edge keeps the menu on screen; 150% zoom crops correctly", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/image-text/`);
  await prismReady(page);
  const id = await tabId(sw, page);
  await sw.evaluate((id) => chrome.tabs.setZoom(id, 1.5), id);
  await page.waitForTimeout(600);
  // Under browser zoom the CSS viewport shrinks; Playwright's mouse uses CSS pixels.
  const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(vp.width).toBeLessThan(900);
  // Bottom-right corner selection.
  await dragSelect(page, [vp.width - 220, vp.height - 160], [vp.width - 5, vp.height - 5]);
  const menu = page.locator("[data-testid=prism-menu]");
  await expect(menu).toBeVisible();
  const mb = (await menu.boundingBox())!;
  expect(mb.x).toBeGreaterThanOrEqual(0);
  expect(mb.y).toBeGreaterThanOrEqual(0);
  expect(mb.x + mb.width).toBeLessThanOrEqual(vp.width);
  expect(mb.y + mb.height).toBeLessThanOrEqual(vp.height);
  await page.keyboard.press("Escape");
  // At 150% zoom, a selection over the Spanish poster is still read correctly.
  const [from, to] = await boxOf(page, "img[src='aviso-es.png']", 2);
  await dragSelect(page, from, [Math.min(to[0], vp.width - 2), Math.min(to[1], vp.height - 2)]);
  const card = await chooseAction(page, "translate");
  expect((await card.innerText()).toLowerCase()).toMatch(/water|important/);
  await shot(page, "assist-06-zoom150");
  await sw.evaluate((id) => chrome.tabs.setZoom(id, 1), id);
});

test("Fill out: suggestions from profile, applied with validation, never submitted, undo works", async ({ context, sw }) => {
  await setProfile(sw);
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/benefits-form/`);
  await prismReady(page);
  const [from, to] = await boxOf(page, "#step1", 4);
  await page.setViewportSize({ width: 1280, height: 1300 });
  const [f2, t2] = await boxOf(page, "#step1", 4);
  await dragSelect(page, f2, t2);
  const card = await chooseAction(page, "fill");
  await expect(card).toHaveAttribute("data-status", "ready");
  await shot(page, "assist-07-fill-suggestions");
  const cardText = await card.innerText();
  expect(cardText).toContain("Margaret");
  // The password field must not get a suggestion.
  expect(await page.locator("#new-password").inputValue()).toBe("");
  await card.locator("[data-testid=fill-apply]").click();
  await expect(card.locator("[data-testid=fill-result]")).toBeVisible();
  await shot(page, "assist-08-fill-applied");
  expect(await page.locator("#full-name").inputValue()).toBe("Margaret Ellison");
  expect((await page.locator("#postcode").inputValue()).toUpperCase().replace(/\s/g, "")).toBe("LS62QT");
  const fixture = await page.evaluate(() => (window as any).__fixture);
  expect(fixture.state.fullName).toBe("Margaret Ellison"); // the site's own state saw real input events
  expect(fixture.submits).toBe(0); // nothing was submitted
  expect(await page.locator("#new-password").inputValue()).toBe("");
  expect(page.url()).toContain("/benefits-form/");
  // Undo restores the previous (empty) values.
  await card.locator("[data-testid=fill-undo]").click();
  expect(await page.locator("#full-name").inputValue()).toBe("");
  void from; void to;
});
