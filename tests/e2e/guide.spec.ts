// Guide me: the spotlight points, the person acts, the guide follows across pages.
import type { Page, Worker } from "@playwright/test";
import path from "node:path";
import { expect, FIXTURES, prismReady, tabMessage, test } from "./harness";

const OUT = path.resolve("evidence/v1");

const card = (page: Page) => page.locator("[data-testid=guide-card]");
const ring = (page: Page) => page.locator("[data-testid=guide-ring]");

async function waitShowing(page: Page) {
  await expect(page.locator("[data-testid=guide]")).toBeVisible({ timeout: 60_000 });
  await expect(ring(page)).toBeVisible();
}

/** The element under the ring's centre, as a real click would hit it (proves the hole lets clicks through). */
async function ringTarget(page: Page) {
  const box = (await ring(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("Guide me walks someone through sending an email, one spotlight at a time, never acting for them", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/guide-mail/`);
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:guide", goal: "Send an email to my son at sam@example.com saying I will call tonight" });
  await waitShowing(page);
  await expect(card(page)).toContainText(/compose/i);
  await page.screenshot({ path: path.join(OUT, "guide-01-compose.png") });

  // Click where the spotlight is: the real Compose link must receive it.
  const at = await ringTarget(page);
  await page.mouse.click(at.x, at.y);
  await page.waitForURL(/compose\.html/, { timeout: 15_000 });

  // On the compose page the guide points at the To field; the person types, then presses Done.
  await waitShowing(page);
  await expect(page.locator("[data-testid=guide]")).toHaveAttribute("data-kind", "type");
  const toField = page.locator("input[name=to]");
  await expect(toField).toHaveValue(""); // Prism never typed it
  await page.screenshot({ path: path.join(OUT, "guide-02-type.png") });
  // Fill whatever the guide is pointing at, the way a person would, until it reaches Send.
  for (let i = 0; i < 6; i++) {
    const kind = await page.locator("[data-testid=guide]").getAttribute("data-kind").catch(() => null);
    if (kind !== "type") break;
    const focused = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name ?? "");
    const value = focused === "to" ? "sam@example.com" : focused === "subject" ? "Tonight" : "I will call you tonight.";
    await page.keyboard.type(value);
    const before = await card(page).textContent();
    await page.locator("[data-testid=guide-done]").click();
    await expect(card(page)).not.toHaveText(before ?? "", { timeout: 60_000 });
    await waitShowing(page);
  }
  // The last step is Send, marked with a caution note; the person presses it.
  await expect(card(page)).toContainText(/send/i);
  await expect(card(page)).toContainText(/check everything/i);
  await page.screenshot({ path: path.join(OUT, "guide-03-send.png") });
  const send = await ringTarget(page);
  await page.mouse.click(send.x, send.y);
  await page.waitForURL(/sent\.html/, { timeout: 15_000 });
  await expect(page.locator("[data-testid=guide-final]")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(OUT, "guide-04-done.png") });
  expect(page.url()).toContain("to=sam%40example.com");
  await page.locator("[data-testid=guide-stop]").click();
  await expect(card(page)).toHaveCount(0);
});

test("Guide me from a blank new tab starts in the popup and asks what it needs", async ({ context, sw, extensionId }) => {
  const blank = await context.newPage();
  await blank.goto("about:blank");
  const id = await sw.evaluate(async () => (await chrome.tabs.query({ url: "about:blank" }))[0]?.id);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 640 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${id}`);
  await popup.getByTestId("popup-guide-goal").fill("Send an email to my son");
  await popup.getByTestId("popup-guide-start").click();
  await expect(popup.getByTestId("popup-guide")).toBeVisible();
  await expect(popup.getByTestId("popup-guide-question")).toBeVisible({ timeout: 60_000 });
  await expect(popup.locator(".guide-box__choices button")).not.toHaveCount(0);
  await popup.screenshot({ path: path.join(OUT, "guide-05-popup-ask.png") });
  await popup.getByTestId("popup-guide-stop").click();
});
