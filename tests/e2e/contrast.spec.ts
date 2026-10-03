// Every visible piece of text on a tidied page must meet WCAG AA against what's actually behind it.
import type { Page } from "@playwright/test";
import path from "node:path";
import { expect, FIXTURES, prismReady, setSettings, tabId, test, tidy } from "./harness";
import { pixelContrast } from "./pixels";

const STYLES = ["clear", "calm", "bold", "soft"] as const;

/** Independent audit (not Prism's own code): all elements with their own visible text. */
async function auditAll(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bgOf = (el: Element | null): { r: number; g: number; b: number } | null => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage.includes("url(")) return null;
        const stops = cs.backgroundImage.match(/rgba?\([^)]+\)/g);
        if (stops) return parse(stops[0]); // gradient band: its first colour
        const c = parse(cs.backgroundColor);
        if (c.a > 0.5) return c;
      }
      const h = parse(getComputedStyle(document.documentElement).backgroundColor);
      return h.a > 0.5 ? h : { r: 255, g: 255, b: 255 };
    };
    const fails: string[] = [];
    let checked = 0;
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("prism-root,prism-fold,svg")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || cs.visibility === "hidden" || el.closest("[data-prism-collapsed]:not([data-prism-open])")) continue;
      if ([...document.querySelectorAll("*")].length && getComputedStyle(el).display === "none") continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const fg = parse(cs.color);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      checked++;
      const size = parseFloat(cs.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio < need) fails.push(`${el.tagName}.${el.className} "${(el as HTMLElement).innerText.slice(0, 40)}" ${ratio.toFixed(2)}`);
    }
    return { checked, fails };
  });
}

for (const style of STYLES) {
  test(`Dark-theme trap page: every visible text passes AA in ${style}`, async ({ context, sw }) => {
    await setSettings(sw, { styleId: style });
    const page = await context.newPage();
    await page.goto(`${FIXTURES}/dark-site/`);
    if (style === "clear") await page.screenshot({ path: path.resolve("evidence/glowup/contrast-dark-original.png") });
    const before = await auditAll(page);
    await tidy(sw, page, { allowBase: true });
    await page.waitForTimeout(800);
    const after = await auditAll(page);
    await page.screenshot({ path: path.resolve(`evidence/glowup/contrast-dark-${style}.png`), fullPage: true });
    expect(before.fails.length).toBeGreaterThan(3); // the page really does contain traps
    expect(after.checked).toBeGreaterThan(12);
    expect(after.fails, after.fails.join("\n")).toEqual([]);
    // The advert is hidden rather than faded.
    await expect(page.locator(".ad")).toBeHidden();
  });
}

test("Every fixture passes the whole-page contrast audit in every Style", async ({ context, sw }) => {
  const pages = ["cluttered-info/", "benefits-form/", "non-english/", "canvas-shop/", "dynamic-app/", "state-portal/", "dark-site/"];
  const failures: string[] = [];
  for (const style of STYLES) {
    await setSettings(sw, { styleId: style });
    for (const p of pages) {
      const page = await context.newPage();
      await page.goto(`${FIXTURES}/${p}`);
      await tidy(sw, page, { allowBase: true });
      await page.waitForTimeout(800);
      const r = await auditAll(page);
      failures.push(...r.fails.map((f) => `${style} ${p}: ${f}`));
      if (p === "state-portal/") await page.screenshot({ path: path.resolve(`evidence/glowup/portal-${style}.png`) });
      await page.close();
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

test("Public: ilsos.gov passes the whole-page contrast audit in every Style", async ({ context, sw }) => {
  const failures: string[] = [];
  for (const style of STYLES) {
    await setSettings(sw, { styleId: style });
    const page = await context.newPage();
    try { await page.goto("https://www.ilsos.gov/", { waitUntil: "load", timeout: 60_000 }); }
    catch { test.skip(true, "ilsos.gov not reachable"); }
    await page.waitForTimeout(1500);
    if (style === "clear") await page.screenshot({ path: path.resolve("evidence/glowup/ilsos-0-original.png") });
    await tidy(sw, page, { allowBase: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.resolve(`evidence/glowup/ilsos-${style}.png`) });
    const r = await auditAll(page);
    failures.push(...r.fails.map((f) => `${style}: ${f}`));
    await page.close();
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

for (let run = 1; run <= 3; run++) {
  test(`Public: berkshirehathaway.com is fully readable in every Style (run ${run})`, async ({ context, sw }) => {
    const failures: string[] = [];
    for (const style of STYLES) {
      await setSettings(sw, { styleId: style });
      const page = await context.newPage();
      try { await page.goto("https://www.berkshirehathaway.com/", { waitUntil: "load", timeout: 45_000 }); }
      catch { test.skip(true, "berkshirehathaway.com not reachable"); }
      await tidy(sw, page, { allowBase: true });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.resolve(`evidence/glowup/berkshire-${style}-run${run}.png`) });
      const r = await auditAll(page);
      failures.push(...r.fails.map((f) => `${style}: ${f}`));
      await page.close();
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}

test("Popup switch turns on immediately and reflects the page (berkshirehathaway.com)", async ({ context, sw, extensionId }) => {
  const page = await context.newPage();
  try { await page.goto("https://www.berkshirehathaway.com/", { waitUntil: "load", timeout: 45_000 }); }
  catch { test.skip(true, "not reachable"); }
  await prismReady(page);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${await tabId(sw, page)}`);
  const sw1 = popup.getByRole("switch", { name: /Tidy this page/ });
  await expect(sw1).toHaveAttribute("aria-checked", "false");
  await sw1.click();
  await expect(sw1).toHaveAttribute("aria-checked", "true", { timeout: 1500 });
  // Reopening the popup agrees with the page.
  await popup.reload();
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "true");
  await popup.getByRole("switch", { name: /Tidy this page/ }).click();
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "false", { timeout: 1500 });
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(false);
});

for (let run = 1; run <= 3; run++) {
  test(`Visited links stay readable on berkshirehathaway.com (pixel check, run ${run})`, async ({ context, sw }) => {
    const page = await context.newPage();
    try {
      for (const u of ["message.html", "reports.html", "letters/letters.html"]) await page.goto(`https://www.berkshirehathaway.com/${u}`, { timeout: 30_000 });
      await page.goto("https://www.berkshirehathaway.com/", { waitUntil: "load", timeout: 30_000 });
    } catch { test.skip(true, "berkshirehathaway.com not reachable"); }
    const failures: string[] = [];
    for (const style of STYLES) {
      await setSettings(sw, { styleId: style });
      await page.reload();
      await tidy(sw, page, { allowBase: true });
      // Make the visited links the page's main actions, as the AI did in the reported case.
      await page.evaluate(() => {
        for (const a of document.querySelectorAll("a")) if (/Message from Warren|Annual & Interim|Warren Buffett.s Letters/.test(a.textContent ?? "")) a.setAttribute("data-prism-emphasis", "primary");
      });
      await page.waitForTimeout(1200);
      for (const name of ["A Message from Warren", "Annual & Interim Reports", "Warren Buffett", "Link to SEC Filings"]) {
        const link = page.locator("a", { hasText: name }).first();
        const r = await pixelContrast(context, link);
        if (r.ratio < 4.5) failures.push(`${style} "${name}": ${r.ratio} (${r.fg} on ${r.bg})`);
      }
      await page.screenshot({ path: path.resolve(`evidence/glowup/visited-${style}-run${run}.png`) });
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
