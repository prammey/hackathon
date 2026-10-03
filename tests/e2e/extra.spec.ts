import { expect, FIXTURES, prismReady, setSettings, shot, tabMessage, test, tidy } from "./harness";

test("Right-click 'Ask Prism about this' on selected text opens the action menu around it", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  await page.locator("#deadline-notice").selectText();
  // Chrome's context menu can't be clicked by automation; this sends the same message its handler sends.
  await tabMessage(sw, page, { type: "prism:context-ask", selectionText: "Important", srcUrl: "" });
  const menu = page.getByTestId("prism-menu");
  await expect(menu).toBeVisible();
  const rect = (await page.getByTestId("prism-sel-rect").boundingBox())!;
  const notice = (await page.locator("#deadline-notice").boundingBox())!;
  expect(Math.abs(rect.y - notice.y)).toBeLessThan(20);
});

test("Chat can include the whole screen (picture of the page) when asked", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/image-text/`);
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:open-chat" });
  await page.getByLabel("Include the whole screen").check();
  await page.getByTestId("chat-input").fill("What day are bins changing to, according to the green poster on my screen?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("prism-chat")).toHaveAttribute("data-status", /idle|done/, { timeout: 120_000 });
  await expect(page.getByTestId("chat-log")).toContainText(/Thursday/i);
  await shot(page, "chat-09-whole-screen");
});

test("Reading settings reach the page: larger text and extra-legible font", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await setSettings(sw, { styleId: "calm" });
  await tidy(sw, page);
  const normal = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main p")!).fontSize));
  await setSettings(sw, { textScale: 1.5, extraLegible: true });
  await expect.poll(async () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main p")!).fontSize)), { timeout: 10_000 }).toBeGreaterThan(normal * 1.3);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("main p")!).fontFamily)).toContain("Prism Atkinson");
  await shot(page, "settings-03-large-text-applied");
});

test("Judge path: online service + online practice page, tidy and Define", async ({ context, sw }) => {
  const HOSTED = "https://prism-helper-677745474657.us-central1.run.app";
  await setSettings(sw, { helperMode: "hosted", localUrl: "http://127.0.0.1:9" });
  const page = await context.newPage();
  await page.goto(`${HOSTED}/demo/cluttered-info/`);
  const status = await tidy(sw, page);
  expect(["planned", "cached"]).toContain(status.status);
  await shot(page, "judge-01-practice-tidied");
  const b = (await page.locator("#deadline-notice").boundingBox())!;
  const { dragSelect } = await import("./harness");
  await dragSelect(page, [b.x - 4, b.y - 4], [b.x + b.width + 4, b.y + b.height + 4]);
  await page.getByTestId("prism-menu").locator("[data-action=define]").click();
  await expect(page.getByTestId("prism-card")).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  await shot(page, "judge-02-practice-define");
});

/** Viewport box around specific words inside an element (like a person dragging over just those words). */
async function wordsBox(page: import("@playwright/test").Page, selector: string, words: string) {
  return page.evaluate(({ selector, words }) => {
    const el = document.querySelector(selector)!;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const i = n.textContent!.indexOf(words);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + words.length);
        r.startContainer.parentElement!.scrollIntoView({ block: "center", behavior: "instant" });
        const b = r.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      }
    }
    throw new Error("words not found");
  }, { selector, words });
}

test("Selecting just a few words explains those words (Define and Chat), with no markdown symbols", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await tidy(sw, page);
  const b = await wordsBox(page, "main li:nth-of-type(3)", "Jobseeker's Allowance");
  const { dragSelect } = await import("./harness");
  await dragSelect(page, [b.x - 3, b.y - 3], [b.x + b.w + 3, b.y + b.h + 3]);
  await page.getByTestId("prism-menu").locator("[data-action=define]").click();
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  const defineText = await card.innerText();
  expect(defineText.toLowerCase()).toMatch(/job|work|unemploy/);
  expect(defineText).not.toContain("**");
  await shot(page, "words-01-define-jobseekers");
  await page.keyboard.press("Escape");
  await dragSelect(page, [b.x - 3, b.y - 3], [b.x + b.w + 3, b.y + b.h + 3]);
  await page.getByTestId("prism-menu").locator("[data-action=chat]").click();
  await page.getByTestId("chat-input").fill("What is that?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("prism-chat")).toHaveAttribute("data-status", /idle|done/, { timeout: 120_000 });
  const reply = await page.locator(".msg--prism").last().innerText();
  expect(reply.toLowerCase()).toMatch(/job|work|unemploy/);
  expect(await page.getByTestId("chat-log").innerText()).not.toContain("**");
  await shot(page, "words-02-chat-what-is-that");
});
