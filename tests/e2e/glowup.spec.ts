// Visual review captures for the redesign (evidence/glowup). Also asserts the restructure on a
// canvas-layout public site (arngren.net) and that restore still returns the original exactly.
import path from "node:path";
import { dragSelect, expect, FIXTURES, prismReady, setSettings, tabId, tabMessage, test, tidy } from "./harness";

const OUT = path.resolve("evidence/glowup");
const STYLES = ["clear", "calm", "bold", "soft"] as const;

test("arngren.net: canvas layout is reflowed into a card grid in every Style, and restores exactly", async ({ context, sw }) => {
  const page = await context.newPage();
  try { await page.goto("https://arngren.net/", { waitUntil: "load", timeout: 60_000 }); }
  catch { test.skip(true, "arngren.net not reachable"); }
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => document.querySelector("#root")!.getAttribute("style"));
  const status = await tidy(sw, page, { allowBase: true });
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-prism-mode"))).toBe("restructure");
  const items = await page.evaluate(() => document.querySelectorAll("[data-prism-item]").length);
  expect(items).toBeGreaterThan(100);
  // Items are now in normal flow (not absolutely positioned).
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("[data-prism-item=card]")!).position)).toBe("relative");
  for (const style of STYLES) {
    await tabMessage(sw, page, { type: "prism:set-style", styleId: style });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `arngren-2-${style}.png`) });
  }
  await page.evaluate(() => scrollTo(0, 1400));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "arngren-3-soft-scrolled.png") });
  await tabMessage(sw, page, { type: "prism:toggle", on: false });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => [...e.attributes].some((a) => a.name.startsWith("data-prism"))).length)).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#e0")!).position)).toBe("absolute");
  expect(await page.evaluate(() => document.querySelector("#root")!.getAttribute("style"))).toBe(before);
  void status;
});

test("Redesign captures: fixtures in each Style, Prism UI surfaces", async ({ context, sw, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  for (const style of STYLES) {
    await tabMessage(sw, page, { type: "prism:set-style", styleId: style });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `cluttered-${style}.png`) });
  }
  await page.getByTestId("prism-tab").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "ui-panel.png") });
  await page.keyboard.press("Escape");
  const b = (await page.locator("#deadline-notice").boundingBox())!;
  await dragSelect(page, [b.x - 6, b.y - 6], [b.x + b.width + 6, b.y + b.height + 6]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "ui-menu.png") });
  await page.getByTestId("prism-menu").locator("[data-action=define]").click();
  await expect(page.getByTestId("prism-card")).toHaveAttribute("data-status", /ready|error/, { timeout: 90_000 });
  await page.screenshot({ path: path.join(OUT, "ui-define.png") });

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${await tabId(sw, page)}`);
  await expect(popup.getByRole("switch")).toBeVisible();
  await popup.waitForTimeout(400);
  await popup.screenshot({ path: path.join(OUT, "ui-popup.png") });
  const welcome = await context.newPage();
  await welcome.setViewportSize({ width: 1280, height: 900 });
  await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
  await welcome.waitForTimeout(600);
  await welcome.screenshot({ path: path.join(OUT, "ui-welcome.png"), fullPage: true });
  await welcome.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(welcome.getByRole("heading", { level: 1 })).toBeVisible();
  await welcome.waitForTimeout(600);
  await welcome.screenshot({ path: path.join(OUT, "ui-settings.png") });
  void prismReady; void setSettings;
});

test("Canvas-layout shop (local fixture): fragments grouped into product cards; restore is exact", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/canvas-shop/`);
  await prismReady(page);
  await page.screenshot({ path: path.join(OUT, "canvas-0-original.png") });
  const snapshot = () => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("prism-root").forEach((n) => n.remove());
    return clone.outerHTML;
  };
  const before = await page.evaluate(snapshot);
  await tidy(sw, page, { allowBase: true });
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-prism-mode"))).toBe("restructure");
  const groups = await page.evaluate(() => [...document.querySelectorAll("prism-group")].map((g) => ({
    img: !!g.querySelector("img"), price: !!g.querySelector("[data-prism-price]"), text: (g as HTMLElement).innerText.slice(0, 40),
  })));
  expect(groups.filter((g) => g.img && g.price).length).toBeGreaterThanOrEqual(15);
  // Nothing on the board is absolutely positioned any more.
  expect(await page.evaluate(() => [...document.querySelectorAll("#root > *, prism-group > *")].filter((e) => getComputedStyle(e).position === "absolute").length)).toBe(0);
  for (const style of STYLES) {
    await tabMessage(sw, page, { type: "prism:set-style", styleId: style });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `canvas-1-${style}.png`) });
  }
  // A product link still works after the reflow.
  await page.locator("a[href='#p3']").click();
  expect(page.url()).toContain("#p3");
  await page.goBack();
  await tabMessage(sw, page, { type: "prism:toggle", on: false });
  await page.waitForTimeout(400);
  expect(await page.evaluate(snapshot)).toBe(before);
});

test("The page's main action is the most prominent thing, in every Style", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  for (const style of STYLES) {
    await tabMessage(sw, page, { type: "prism:set-style", styleId: style });
    await page.waitForTimeout(900);
    const cta = page.locator("a.btn-apply");
    await cta.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForTimeout(300);
    const box = (await cta.boundingBox())!;
    const font = await cta.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const other = (await page.locator("a[href='#paper']").boundingBox())!;
    const otherFont = await page.locator("a[href='#paper']").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(box.height).toBeGreaterThanOrEqual(52);
    expect(font).toBeGreaterThanOrEqual(20);
    expect(box.height).toBeGreaterThan(other.height);
    expect(font).toBeGreaterThan(otherFont * 1.15);
    await expect(page.getByTestId("prism-next")).toContainText("Start your application");
    await page.screenshot({ path: path.join(OUT, `cta-${style}.png`) });
  }
  await page.getByTestId("prism-next").getByRole("button", { name: "Show me" }).click();
  await expect(page.locator("a.btn-apply")).toBeFocused();
});
