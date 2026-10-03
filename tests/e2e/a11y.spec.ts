import type { Page } from "@playwright/test";
import { dragSelect, EVIDENCE, expect, FIXTURES, prismReady, setSettings, shot, tabId, tabMessage, test, tidy } from "./harness";
import path from "node:path";

/** WCAG contrast of visible text against its effective background, computed in the page. */
async function contrastAudit(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element | null): { r: number; g: number; b: number } => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c.a > 0.6) return c;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const fails: string[] = [];
    let checked = 0;
    const els = document.querySelectorAll("main p, main li, main h1, main h2, main h3, main label, main a, main button, main td, main th, [data-prism-role=notice]");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !(el as HTMLElement).innerText?.trim()) continue;
      if (el.closest("[data-prism-collapsed]:not([data-prism-open]),[data-prism-s=keep],[data-prism-role=clutter]")) continue;
      const fg = parse(getComputedStyle(el).color);
      const bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      checked++;
      const size = parseFloat(getComputedStyle(el).fontSize);
      const bold = Number(getComputedStyle(el).fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (ratio < need) fails.push(`${el.tagName} "${(el as HTMLElement).innerText.slice(0, 30)}" ${ratio.toFixed(2)}`);
    }
    return { checked, fails };
  });
}

for (const style of ["clear", "bold", "calm", "soft"]) {
  test(`Contrast and target sizes on a tidied page: ${style}`, async ({ context, sw }) => {
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/cluttered-info/`);
    await setSettings(sw, { styleId: style });
    await tidy(sw, page);
    await page.waitForTimeout(600);
    const audit = await contrastAudit(page);
    expect(audit.checked).toBeGreaterThan(15);
    expect(audit.fails, audit.fails.join("\n")).toEqual([]);
    const small = await page.evaluate(() => [...document.querySelectorAll("[data-prism-c=button],[data-prism-c=button-link],[data-prism-c=field]")]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest("[data-prism-collapsed]:not([data-prism-open])") && (r.height < 24 || r.width < 24); })
      .map((e) => e.outerHTML.slice(0, 80)));
    expect(small).toEqual([]);
  });
}

test("Keyboard only: shortcut selection mode, arrow keys, Enter, menu arrows, Esc returns focus", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/non-english/`);
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:start-selection", mode: "keyboard" });
  await expect(page.getByTestId("prism-sel-rect")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Enter");
  const menu = page.getByTestId("prism-menu");
  await expect(menu).toBeVisible();
  // Focus starts on Define; ArrowRight moves to Translate.
  await expect(menu.locator("[data-action=define]")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(menu.locator("[data-action=translate]")).toBeFocused();
  await shot(page, "a11y-01-keyboard-menu");
  await page.keyboard.press("Enter");
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", /ready|error/, { timeout: 90_000 });
  await expect(card.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});

test("Keyboard only: popup is fully operable with Tab and Space", async ({ context, sw, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${await tabId(sw, page)}`);
  await popup.bringToFront();
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toBeVisible();
  await popup.keyboard.press("Tab");
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toBeFocused();
  await popup.keyboard.press("Space");
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "true");
  // Visible focus indicator on the focused control.
  const outline = await popup.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});

test("Reduced motion: animations and transitions are switched off", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  const durations = await page.evaluate(() => [...document.querySelectorAll("[data-prism-c=button],a")].slice(0, 10).map((e) => getComputedStyle(e).transitionDuration));
  expect(durations.every((d) => d.split(",").every((x) => parseFloat(x) === 0))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("200% zoom: tidied page has no sideways scrolling and stays readable", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  await sw.evaluate((id) => chrome.tabs.setZoom(id, 2), await tabId(sw, page));
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await tidy(sw, page);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(after).toBeLessThanOrEqual(Math.max(before, 0) + 40);
  await shot(page, "a11y-02-zoom200");
});

test("Errors: AI service down → clear message and a working page; restricted capture explained", async ({ context, sw }) => {
  await setSettings(sw, { helperMode: "local", localUrl: "http://127.0.0.1:9" });
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page, { allowBase: true });
  const status = await tabMessage(sw, page, { type: "prism:status" });
  expect(status.status).toBe("base");
  expect(status.message).toMatch(/can't reach|isn't available|basic clean-up/i);
  // The basic tidy still applies and the page still works.
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(true);
  const b = (await page.locator("#deadline-notice").boundingBox())!;
  await dragSelect(page, [b.x - 4, b.y - 4], [b.x + b.width + 4, b.y + b.height + 4]);
  await page.getByTestId("prism-menu").locator("[data-action=define]").click();
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", "error", { timeout: 60_000 });
  await expect(card).toContainText(/can't reach its helper|online service/i);
  await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "a11y-03-offline-error.png") });
});

test("Strict CSP page: tidy styles and Prism UI both work", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/strict-csp/`);
  await prismReady(page);
  const fontBefore = await page.evaluate(() => getComputedStyle(document.querySelector("main p")!).fontSize);
  await tidy(sw, page, { allowBase: true });
  const fontAfter = await page.evaluate(() => getComputedStyle(document.querySelector("main p")!).fontSize);
  expect(parseFloat(fontAfter)).toBeGreaterThan(parseFloat(fontBefore));
  const b = (await page.locator("h1").boundingBox())!;
  await dragSelect(page, [b.x - 4, b.y - 4], [b.x + b.width + 4, b.y + b.height + 40]);
  await expect(page.getByTestId("prism-menu")).toBeVisible();
  await shot(page, "a11y-04-strict-csp");
});
