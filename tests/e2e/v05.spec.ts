// v0.5: chat emphasize, richer next steps, dictation, simpler settings.
import type { Page, Worker } from "@playwright/test";
import path from "node:path";
import { expect, FIXTURES, prismReady, tabMessage, test, tidy } from "./harness";

const OUT = path.resolve("evidence/v05");

async function openChat(sw: Worker, page: Page) {
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:open-chat" });
  await expect(page.locator("[data-testid=prism-chat]")).toBeVisible();
}

async function say(page: Page, text: string) {
  await page.locator("[data-testid=chat-input]").fill(text);
  await page.locator("[data-testid=chat-send]").click();
}

const spotlit = (page: Page) => page.evaluate(() => [...document.querySelectorAll("[data-prism-spotlight]")].map((e) => (e as HTMLElement).innerText.trim()));

test("Chat can emphasize the link someone is looking for, with tidying off", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/classifieds/`);
  await openChat(sw, page);
  await say(page, "emphasize the navigation link relating to pro guitarists");
  await expect(page.locator("[data-testid=prism-chat]")).toHaveAttribute("data-status", /done|idle/, { timeout: 120_000 });
  await expect.poll(() => spotlit(page), { timeout: 10_000 }).toContain("musicians");
  const look = await page.locator("[data-prism-spotlight]").first().evaluate((el) => {
    const cs = getComputedStyle(el); return { bg: cs.backgroundColor, weight: cs.fontWeight, size: parseFloat(cs.fontSize), outline: cs.outlineStyle };
  });
  expect(look.bg).toBe("rgb(255, 232, 102)");
  expect(Number(look.weight)).toBeGreaterThanOrEqual(700);
  expect(look.size).toBeGreaterThanOrEqual(18);
  expect(look.outline).toBe("solid");
  await page.screenshot({ path: path.join(OUT, "emphasize-classifieds.png") });
  await page.locator("[data-testid=clear-highlights]").click();
  await expect.poll(() => spotlit(page)).toEqual([]);
});

test("Emphasize also works on a tidied page and doesn't disturb the tidy styles", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/classifieds/`);
  await tidy(sw, page, { allowBase: true });
  await openChat(sw, page);
  await say(page, "Where can I find bicycles for sale? Highlight it please.");
  await expect(page.locator("[data-testid=prism-chat]")).toHaveAttribute("data-status", /done|idle/, { timeout: 120_000 });
  await expect.poll(() => spotlit(page), { timeout: 10_000 }).toContain("bikes");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(true);
  const bg = await page.locator("[data-prism-spotlight]").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(255, 232, 102)");
  await page.screenshot({ path: path.join(OUT, "emphasize-tidied.png") });
});

test("Next step dock: more options, and 'What do you want to do next?' finds it for you", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  const dock = page.getByTestId("prism-next");
  await expect(dock).toContainText("Start your application");
  await dock.getByTestId("next-toggle").click();
  const options = page.getByTestId("next-more").locator("li");
  await expect.poll(() => options.count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, "next-more.png") });
  await options.first().getByRole("button", { name: "Show me" }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? "")).not.toBe("BODY");
  await page.getByTestId("next-goal").fill("where can I get a paper form?");
  await page.getByTestId("next-go").click();
  await expect(page.locator("[data-testid=prism-chat]")).toBeVisible();
  await expect(page.locator("[data-testid=prism-chat]")).toHaveAttribute("data-status", /done|idle/, { timeout: 120_000 });
  await expect.poll(() => spotlit(page), { timeout: 10_000 }).toEqual(expect.arrayContaining([expect.stringMatching(/paper/i)]));
  await page.screenshot({ path: path.join(OUT, "next-ask.png") });
});

async function talk(page: Page, button: ReturnType<Page["locator"]>) {
  await button.click();
  await expect(button).toHaveAttribute("data-phase", "listening");
  await page.waitForTimeout(3500); // the recorded sentence lasts about 2.5 s
  await button.click();
  await expect(button).toHaveAttribute("data-phase", "idle", { timeout: 45_000 });
}

test("Dictation: turned on once in Settings, then works in Settings, Chat and a website's own text box", async ({ context, sw, extensionId }) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByRole("switch", { name: "Let me talk instead of typing" }).click();
  await expect(settings.getByRole("switch", { name: "Let me talk instead of typing" })).toHaveAttribute("aria-checked", "true");
  await talk(settings, settings.getByTestId("settings-talk"));
  await expect(settings.getByTestId("settings-heard")).toContainText(/opening hours/i);
  await settings.screenshot({ path: path.join(OUT, "dictation-settings.png") });

  const page = await context.newPage();
  await page.goto(`${FIXTURES}/benefits-form/`);
  await prismReady(page);
  let inputs = 0;
  await page.exposeFunction("countInput", () => { inputs++; });
  await page.evaluate(() => document.querySelector("input[type=text],textarea")!.addEventListener("input", () => (window as unknown as { countInput: () => void }).countInput()));
  const field = page.locator("input[type=text],textarea").first();
  await field.focus();
  const pageTalk = page.locator("[data-testid=page-talk] button");
  await expect(pageTalk).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "dictation-page-field.png") });
  await talk(page, pageTalk);
  await expect(field).toHaveValue(/opening hours/i);
  expect(inputs).toBeGreaterThan(0);

  // Never offered on a password box.
  await page.evaluate(() => { const p = document.createElement("input"); p.type = "password"; p.id = "pw"; document.body.prepend(p); });
  await page.locator("#pw").focus();
  await page.waitForTimeout(400);
  await expect(page.locator("[data-testid=page-talk]")).toHaveCount(0);

  await tabMessage(sw, page, { type: "prism:open-chat" });
  await talk(page, page.getByTestId("chat-talk"));
  await expect(page.getByTestId("chat-input")).toHaveValue(/opening hours/i);
});

test("Settings page is short and simple; the rest is under More settings", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const visibleH2 = await page.locator("h2:visible").allInnerTexts();
  expect(visibleH2).toEqual(["How pages look", "Talking instead of typing", "Your language", "About you"]);
  await expect(page.getByRole("heading", { name: "Tidying" })).toBeHidden();
  await page.screenshot({ path: path.join(OUT, "settings-simple.png"), fullPage: true });
  await page.getByTestId("more-settings").click();
  for (const h of ["Tidying", "Pointing at things", "Reading", "Import from ChatGPT or Claude", "Privacy & your data", "Prism service"]) {
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  }
  await page.goto(`chrome-extension://${extensionId}/options.html#import`);
  await page.reload();
  await expect(page.getByTestId("paste-chatgpt")).toBeVisible();
});
