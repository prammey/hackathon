import { expect, FIXTURES, helperCalls, shot, tabMessage, test, tidy } from "./harness";

const STYLES = ["clear", "bold", "calm", "soft"] as const;

/** Serialises the page DOM without Prism's own root, for before/after comparison. */
const domSnapshot = () => {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("prism-root").forEach((n) => n.remove());
  return clone.outerHTML;
};

test("cluttered page: tidy with AI, four styles, restore exactly", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await page.waitForLoadState("load");
  // Screenshot first: Playwright's caret hiding adds style="" to inputs, which isn't Prism's doing.
  await shot(page, "cluttered-00-original");
  const before = await page.evaluate(domSnapshot);

  const status = await tidy(sw, page);
  expect(["planned", "cached"]).toContain(status.status);
  await page.waitForTimeout(800);
  for (const style of STYLES) {
    await tabMessage(sw, page, { type: "prism:set-style", styleId: style });
    await page.waitForTimeout(700);
    await shot(page, `cluttered-01-${style}`);
  }

  // The apply link still navigates; the main content is visible; legal text is not hidden.
  await expect(page.locator("#legal-disclosure")).toBeVisible();
  await expect(page.locator("#deadline-notice")).toBeVisible();
  await expect(page.locator("a.btn-apply")).toBeVisible();

  await tabMessage(sw, page, { type: "prism:toggle", on: false });
  await page.waitForTimeout(500);
  const after = await page.evaluate(domSnapshot);
  expect(after).toBe(before);
  const cssLeft = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(cssLeft).toContain("Tahoma");
  await shot(page, "cluttered-02-restored");
});

test("cached layout: reload applies the same plan with zero AI calls", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  const roles1 = await page.evaluate(() => [...document.querySelectorAll("[data-prism-role],[data-prism-collapsed],[data-prism-emphasis]")].map((e) => `${e.getAttribute("data-prism-id")}:${e.getAttribute("data-prism-role")}:${e.getAttribute("data-prism-collapsed")}:${e.getAttribute("data-prism-emphasis")}`).sort());
  const calls = await helperCalls();
  await page.reload();
  const status = await tidy(sw, page);
  expect(status.status).toBe("cached");
  expect(await helperCalls()).toBe(calls);
  const roles2 = await page.evaluate(() => [...document.querySelectorAll("[data-prism-role],[data-prism-collapsed],[data-prism-emphasis]")].map((e) => `${e.getAttribute("data-prism-id")}:${e.getAttribute("data-prism-role")}:${e.getAttribute("data-prism-collapsed")}:${e.getAttribute("data-prism-emphasis")}`).sort());
  expect(roles2).toEqual(roles1);
  await shot(page, "cluttered-03-cached-reload");
});
