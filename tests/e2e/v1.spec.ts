// v1: languages everywhere (first-run picker, right-to-left), Read aloud.
import type { Worker } from "@playwright/test";
import path from "node:path";
import { expect, FIXTURES, prismReady, setSettings, tabMessage, test, tidy } from "./harness";

const OUT = path.resolve("evidence/v1");

/** Record what Read aloud asks the computer to say, instead of actually speaking. */
async function spyOnSpeech(sw: Worker) {
  await sw.evaluate(() => {
    const g = globalThis as unknown as { __tts: { text: string; lang?: string }[] };
    g.__tts = [];
    chrome.tts.speak = ((text: string, opts?: chrome.tts.TtsOptions) => {
      g.__tts.push({ text, lang: opts?.lang });
      setTimeout(() => opts?.onEvent?.({ type: "end" } as chrome.tts.TtsEvent), 50);
    }) as typeof chrome.tts.speak;
  });
}
const spoken = (sw: Worker) => sw.evaluate(() => (globalThis as unknown as { __tts: { text: string; lang?: string }[] }).__tts);

test("First run asks for a language; choosing العربية turns Prism's pages and the on-page UI Arabic, right to left", async ({ context, sw, extensionId }) => {
  await setSettings(sw, { languageChosen: false, translateTo: "English" });
  const welcome = await context.newPage();
  await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
  await expect(welcome.locator(".lang-pick__btn")).toHaveCount(12);
  await welcome.screenshot({ path: path.join(OUT, "lang-01-picker.png") });
  await welcome.locator("[data-lang=ar]").click();
  await expect(welcome.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(welcome.locator("h2#how-h")).not.toHaveText("How to use Prism");
  await welcome.screenshot({ path: path.join(OUT, "lang-02-welcome-ar.png"), fullPage: true });

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(settings.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(settings.locator("h2#style-h")).not.toHaveText("How pages look");

  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page, { allowBase: true });
  await expect(page.locator("prism-root")).toHaveAttribute("dir", "rtl");
  const label = await page.locator("[data-testid=prism-next] .nextstep__label").first().innerText();
  expect(label).not.toMatch(/next step/i);
  await page.screenshot({ path: path.join(OUT, "lang-03-page-ar.png") });

  // Back to English everywhere.
  await setSettings(sw, { translateTo: "English" });
  await expect(settings.locator("h2#style-h")).toHaveText("How pages look");
  await expect(page.locator("prism-root")).toHaveAttribute("dir", "ltr");
});

test("Read aloud: answers, chat replies and the whole page are read with the right voice language", async ({ context, sw }) => {
  await spyOnSpeech(sw);
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page, { allowBase: true });
  await page.locator("[data-testid=prism-tab]").click();
  await page.getByRole("button", { name: "Read this page to me" }).click();
  await expect.poll(async () => (await spoken(sw)).length).toBe(1);
  const [first] = await spoken(sw);
  expect(first.text).toContain("Council Tax Reduction");
  expect(first.text).not.toContain("Show app download banner"); // Prism's own fold buttons aren't read
  expect(first.lang).toBe("en");
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:open-chat" });
  await page.locator("[data-testid=chat-input]").fill("In one sentence, what is this page for?");
  await page.locator("[data-testid=chat-send]").click();
  await expect(page.locator("[data-testid=prism-chat]")).toHaveAttribute("data-status", /done|idle/, { timeout: 120_000 });
  await page.locator(".msg--prism [data-testid=read-aloud]").last().click();
  await expect.poll(async () => (await spoken(sw)).length).toBe(2);
  expect((await spoken(sw))[1].text.length).toBeGreaterThan(10);
});
