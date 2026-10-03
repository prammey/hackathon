// Read-only checks on real public websites (no forms submitted, no sign-in). Public sites change,
// so these are evidence of behaviour on the day they ran, not regression tests.
import type { Page } from "@playwright/test";
import { dragSelect, expect, shot, tabMessage, test, tidy } from "./harness";

const SITES = [
  { name: "gov-uk", url: "https://www.gov.uk/council-tax-reduction", official: true, action: "define" },
  { name: "weather-gov", url: "https://www.weather.gov/", official: true, action: "define" },
  { name: "es-wikipedia", url: "https://es.wikipedia.org/wiki/Ayuntamiento", official: false, action: "translate" },
];

const snapshot = () => {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("prism-root").forEach((n) => n.remove());
  return [...clone.querySelectorAll("*")].filter((e) => [...e.attributes].some((a) => a.name.startsWith("data-prism"))).length;
};

async function firstParagraph(page: Page) {
  const p = page.locator("main p, #content p, article p, p").filter({ hasText: /\w{4,}.*\w{4,}.*\w{4,}/ }).first();
  await p.scrollIntoViewIfNeeded();
  return (await p.boundingBox())!;
}

for (const site of SITES) {
  test(`Public site (${site.name}): tidy, restore, ${site.action}`, async ({ context, sw }) => {
    const page = await context.newPage();
    try {
      await page.goto(site.url, { waitUntil: "load", timeout: 45_000 });
    } catch {
      test.skip(true, `${site.url} could not be loaded from this network today`);
    }
    await page.waitForTimeout(1500);
    // Never try to get past bot checks or CAPTCHAs: skip the site instead.
    const blocked = await page.locator("text=/verify you are human|are you a robot|captcha/i").count();
    test.skip(blocked > 0, `${site.url} showed a bot check to the automated browser`);
    await shot(page, `public-${site.name}-0-original`);
    const status = await tidy(sw, page, { allowBase: true });
    await page.waitForTimeout(1000);
    await shot(page, `public-${site.name}-1-tidied`);
    if (site.official) expect(status.isOfficial).toBe(true);
    await tabMessage(sw, page, { type: "prism:toggle", on: false });
    await page.waitForTimeout(500);
    expect(await page.evaluate(snapshot)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(false);
    const b = await firstParagraph(page);
    await dragSelect(page, [b.x - 4, b.y - 4], [b.x + Math.min(b.width, 700) + 4, b.y + b.height + 4]);
    await page.getByTestId("prism-menu").locator(`[data-action=${site.action}]`).click();
    const card = page.getByTestId("prism-card");
    await expect(card).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
    await shot(page, `public-${site.name}-2-${site.action}`);
  });
}
