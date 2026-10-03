import { expect, FIXTURES, helperCalls, shot, tabMessage, test, tidy, waitForStatus } from "./harness";

test("Dynamic app: live updates cause no extra AI calls and no runaway re-analysis", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/dynamic-app/`);
  await tidy(sw, page);
  const callsAfterTidy = await helperCalls();
  const before = await tabMessage(sw, page, { type: "prism:debug" });
  const feedBefore = await page.evaluate(() => (window as any).__fixture.feedItems);
  await page.waitForTimeout(20_000);
  const after = await tabMessage(sw, page, { type: "prism:debug" });
  const feedAfter = await page.evaluate(() => (window as any).__fixture.feedItems);
  const inserted = feedAfter - feedBefore;
  expect(inserted).toBeGreaterThanOrEqual(10);
  // Re-analysis is debounced and bounded by the number of insertions — never a loop.
  expect(after.analyzeRuns - before.analyzeRuns).toBeLessThanOrEqual(inserted + 1);
  expect(after.planRequests).toBe(before.planRequests);
  expect(await helperCalls()).toBe(callsAfterTidy);
  // New feed items are styled as soon as they appear (they inherit the Style via tags/CSS).
  const newest = await page.evaluate(() => getComputedStyle(document.querySelector(".feed-item")!).fontFamily);
  expect(newest).toMatch(/Prism Inter/);
  await shot(page, "dynamic-01-after-20s");
});

test("Dynamic app: SPA route change gets its own plan; going back reuses the cached one", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/dynamic-app/`);
  await tidy(sw, page);
  const d0 = await tabMessage(sw, page, { type: "prism:debug" });
  await page.getByRole("link", { name: "Report a missed bin" }).first().click();
  await page.waitForURL(/\/dynamic-app\/report$/);
  await expect.poll(async () => (await tabMessage(sw, page, { type: "prism:debug" })).routeChanges, { timeout: 15_000 }).toBeGreaterThan(d0.routeChanges);
  await waitForStatus(sw, page, ["planned", "cached"]);
  await shot(page, "dynamic-02-route-report");
  const d1 = await tabMessage(sw, page, { type: "prism:debug" });
  expect(d1.planRequests, d1.planReasons.join(", ")).toBe(d0.planRequests + 1);
  // The form on the new route still works after tidying.
  await page.locator("#addr").fill("14 Larkspur Close");
  await page.locator("#bin").selectOption("Blue bin");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator("#report-status")).toContainText("received");
  // Back to the first route: cached plan, no new AI request.
  await page.goBack();
  await page.waitForURL(/\/dynamic-app\/$/);
  await expect.poll(async () => (await tabMessage(sw, page, { type: "prism:debug" })).routeChanges, { timeout: 15_000 }).toBeGreaterThan(d1.routeChanges);
  const status = await waitForStatus(sw, page, ["cached", "planned"]);
  expect(status.status).toBe("cached");
  expect((await tabMessage(sw, page, { type: "prism:debug" })).planRequests).toBe(d1.planRequests);
});

test("Invalid or hostile plans are rejected safely", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page, { allowBase: true });
  const formId = await page.evaluate(() => document.querySelector("form")?.closest("[data-prism-id]")?.getAttribute("data-prism-id") ?? document.querySelector("input[type=search]")!.getAttribute("data-prism-id"));
  const mainId = await page.evaluate(() => document.querySelector("main")!.getAttribute("data-prism-id"));
  const legalId = await page.evaluate(() => document.querySelector("#legal-disclosure")!.getAttribute("data-prism-id"));
  const result = await tabMessage(sw, page, {
    type: "prism:test-plan",
    plan: {
      pagePurpose: "test", primaryTask: "test", isOfficialSite: false,
      roles: [{ id: "pdoesnotexist", role: "clutter" }, { id: mainId, role: "clutter" }],
      emphasis: [],
      collapse: [{ ids: [mainId, formId, "pghost"], label: "Everything", reason: "other" }],
      protect: [legalId], steps: [],
    },
  });
  expect(result.rejectedRatio).toBeGreaterThan(0.5);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("input[type=search]")).toBeVisible();
  await expect(page.locator("#legal-disclosure")).toBeVisible();
});
