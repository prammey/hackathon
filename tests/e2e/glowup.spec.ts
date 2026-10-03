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
    // The next step is ringed and breathing before anyone presses "Show me".
    await expect(cta).toHaveAttribute("data-prism-next", "");
    const ring = await cta.evaluate((el) => { const cs = getComputedStyle(el); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), animation: cs.animationName }; });
    expect(ring.style).toBe("solid");
    expect(ring.width).toBeGreaterThanOrEqual(3);
    expect(ring.animation).toContain("prism-ring");
    expect(await page.locator("[data-prism-next]").count()).toBe(1);
    await page.screenshot({ path: path.join(OUT, `cta-${style}.png`) });
  }
  await page.getByTestId("prism-next").getByRole("button", { name: "Show me" }).click();
  await expect(page.locator("a.btn-apply")).toBeFocused();
});

test("Pictures stay inside their boxes' borders in every Style", async ({ context, sw }) => {
  const problems: string[] = [];
  for (const fixture of ["gallery/", "canvas-shop/", "cluttered-info/"]) {
    for (const style of STYLES) {
      await setSettings(sw, { styleId: style });
      const page = await context.newPage();
      await page.goto(`${FIXTURES}/${fixture}`);
      await tidy(sw, page, { allowBase: true });
      await page.waitForTimeout(900);
      const leaks = await page.evaluate(() => {
        const out: string[] = [];
        for (const box of document.querySelectorAll("[data-prism-s=card],[data-prism-s=band],[data-prism-item],prism-group,[data-prism-role=notice]")) {
          const b = box.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          for (const img of box.querySelectorAll("img,video,picture,canvas")) {
            const r = img.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) out.push(`${(img as HTMLImageElement).alt || img.tagName} leaks ${Math.round(r.right - b.right)}px`);
          }
        }
        return out;
      });
      problems.push(...leaks.map((l) => `${fixture} ${style}: ${l}`));
      if (fixture === "gallery/") await page.screenshot({ path: path.join(OUT, `gallery-${style}.png`) });
      await page.close();
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("Answer window can be dragged, moved with the keyboard, and resized", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const b = (await page.locator("#deadline-notice").boundingBox())!;
  await dragSelect(page, [b.x - 4, b.y - 4], [b.x + b.width + 4, b.y + b.height + 4]);
  await page.getByTestId("prism-menu").locator("[data-action=define]").click();
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  const start = (await card.boundingBox())!;
  // Drag by the header.
  const head = card.locator(".answer__grip");
  const hb = (await head.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + 12);
  await page.mouse.down();
  await page.mouse.move(Math.max(60, hb.x + hb.width / 2 - 300), 40, { steps: 8 });
  await page.mouse.up();
  const dragged = (await card.boundingBox())!;
  expect(Math.abs(start.x - dragged.x) + Math.abs(start.y - dragged.y)).toBeGreaterThan(150);
  // Keyboard: arrow keys on the move handle.
  await card.getByTestId("card-move").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const nudged = (await card.boundingBox())!;
  expect(nudged.x).toBeGreaterThan(dragged.x + 20);
  expect(nudged.y).toBeGreaterThan(dragged.y + 20);
  // Resize from the bottom-right corner.
  const grip = (await card.getByTestId("card-resize").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(nudged.x + nudged.width + 120, nudged.y + nudged.height + 80, { steps: 8 });
  await page.mouse.up();
  const resized = (await card.boundingBox())!;
  expect(resized.width).toBeGreaterThan(nudged.width + 80);
  await page.screenshot({ path: path.join(OUT, "card-moved-resized.png") });
});

test("The on-page widget can switch tidying off and back on", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  await page.getByTestId("prism-tab").click();
  const sw1 = page.locator("#panel-tidy-switch");
  await expect(sw1).toHaveAttribute("aria-checked", "true");
  await sw1.click();
  await expect(sw1).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(false);
  await page.screenshot({ path: path.join(OUT, "widget-off.png") });
  await sw1.click();
  await expect(sw1).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(true);
  // Closing the panel leaves the widget available.
  await page.getByRole("button", { name: "Close Prism panel" }).click();
  await expect(page.getByTestId("prism-tab")).toBeVisible();
});

for (let run = 1; run <= 3; run++) {
  test(`craigslist: no overlapping controls in the header, fields look different from buttons (run ${run})`, async ({ context, sw }) => {
    const problems: string[] = [];
    for (const style of STYLES) {
      await setSettings(sw, { styleId: style });
      const page = await context.newPage();
      try { await page.goto("https://chambana.craigslist.org/search/pol", { waitUntil: "load", timeout: 45_000 }); }
      catch { test.skip(true, "craigslist not reachable"); }
      await page.waitForTimeout(1500);
      const collect = () => page.evaluate(() => {
        const els = [...document.querySelectorAll<HTMLElement>("button,input:not([type=hidden]),select,textarea,a[href],label,h1,h2,[data-prism-c]")]
          .filter((e) => !e.closest("prism-root"))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter((b) => b.r.width > 2 && b.r.height > 2 && b.r.top < 600 && getComputedStyle(b.el).visibility !== "hidden")
          // Actually visible: hit-testing its centre lands on it (clipped/hidden menus don't count).
          .filter((b) => { const hit = document.elementFromPoint(b.r.left + b.r.width / 2, b.r.top + b.r.height / 2); return !!hit && (hit === b.el || b.el.contains(hit) || hit.contains(b.el)); });
        const overlaps: string[] = [];
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
          const a = els[i], b = els[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 3 && h > 3) overlaps.push(`${a.el.tagName}"${(a.el.innerText || (a.el as HTMLInputElement).placeholder || "").slice(0, 16)}" × ${b.el.tagName}"${(b.el.innerText || (b.el as HTMLInputElement).placeholder || "").slice(0, 16)}"`);
        }
        const field = document.querySelector("[data-prism-c=field]");
        const button = document.querySelector("[data-prism-c=button]");
        const look = (e: Element | null) => e ? `${getComputedStyle(e).borderTopColor}|${getComputedStyle(e).backgroundColor}|${getComputedStyle(e).boxShadow}` : "";
        return { overlaps, field: look(field), button: look(button) };
      });
      // Only overlaps Prism introduced count (some sites overlap their own hidden menus).
      const baseline = new Set((await collect()).overlaps);
      await tidy(sw, page, { allowBase: true });
      await page.waitForTimeout(1500);
      const result = await collect();
      problems.push(...result.overlaps.filter((o) => !baseline.has(o)).map((o) => `${style}: overlap ${o}`));
      if (result.field && result.button && result.field === result.button) problems.push(`${style}: field looks like button (${result.field})`);
      await page.screenshot({ path: path.join(OUT, `craigslist-${style}-run${run}.png`), clip: { x: 0, y: 0, width: 1280, height: 600 } });
      await page.close();
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
