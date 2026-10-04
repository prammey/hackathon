import { strToU8, zipSync } from "fflate";
import fs from "node:fs";
import path from "node:path";
import { dragSelect, EVIDENCE, expect, FIXTURES, prismReady, setSettings, shot, tabId, tabMessage, test, waitForStatus } from "./harness";

test("Popup: tidy switch, style picker, auto-tidy checkbox, helper status", async ({ context, sw, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const id = await tabId(sw, page);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 640 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${id}`);
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "false");
  await expect(popup.getByText("AI connected")).toBeVisible();
  await popup.screenshot({ path: path.join(EVIDENCE, "popup-01-off.png") });
  await popup.getByRole("switch", { name: /Tidy this page/ }).click();
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "true");
  await popup.locator("[data-style=bold]").click();
  await popup.getByLabel(/automatically every time/).check();
  await popup.screenshot({ path: path.join(EVIDENCE, "popup-02-on.png") });
  // Chrome caps popups at 600px tall: everything should fit without scrolling.
  expect(await popup.evaluate(() => document.querySelector("main.popup")!.getBoundingClientRect().height)).toBeLessThanOrEqual(600);
  await waitForStatus(sw, page, ["planned", "cached", "base"]);
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-prism-style"))).toBe("bold");
  // Auto-tidy: a reload is tidied without touching the popup.
  await page.reload();
  await prismReady(page);
  await waitForStatus(sw, page, ["planned", "cached"]);
  await shot(page, "popup-03-auto-tidied-after-reload");
});

test("Popup on a protected page explains what's going on", async ({ context, extensionId, sw }) => {
  const blank = await context.newPage();
  await blank.goto("chrome://version");
  const id = await sw.evaluate(async () => (await chrome.tabs.query({})).find((t) => !t.url || t.url.startsWith("chrome://"))!.id!);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 400 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${id}`);
  await expect(popup.getByText(/browser protects pages like this/)).toBeVisible();
  await popup.screenshot({ path: path.join(EVIDENCE, "popup-04-restricted.png") });
});

test("Settings: enter About you, saved locally, reflected in storage", async ({ context, extensionId, sw }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole("heading", { level: 1, name: /Settings/ })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE, "settings-01-top.png") });
  await page.goto(`chrome-extension://${extensionId}/options.html#about`);
  await page.getByLabel("Your name").fill("Margaret Ellison");
  await page.getByLabel("What should Prism call you?").fill("Margaret");
  await page.getByLabel("Age range").selectOption("70 or over");
  await page.getByLabel("Town or city").fill("Leeds");
  await page.locator("#new-fact").fill("I receive Pension Credit");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByTestId("save-profile").click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  const profile = await sw.evaluate(async () => (await chrome.storage.local.get("profile")).profile);
  expect(profile.name).toBe("Margaret Ellison");
  expect(profile.ageRange).toBe("70 or over");
  expect(profile.extraFacts[0].text).toBe("I receive Pension Credit");
  await page.screenshot({ path: path.join(EVIDENCE, "settings-02-about.png"), fullPage: false });
});

test("Import: pasted ChatGPT memories → review → edit → save (secrets dropped)", async ({ context, extensionId, sw }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html#import`);
  await page.getByTestId("paste-chatgpt").click();
  await page.getByTestId("paste-box").fill([
    "- Lives in Leeds, UK",
    "- Prefers short, simple explanations",
    "- My bank account number is 12345678",
    "- Is applying for Council Tax Reduction",
    "- Password for council site is hunter2",
  ].join("\n"));
  await page.getByTestId("paste-find").click();
  const review = page.getByTestId("import-review");
  await expect(review).toBeVisible();
  const facts = await review.locator(".candidate input.pz-input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(facts).toEqual(["Lives in Leeds, UK", "Prefers short, simple explanations", "Is applying for Council Tax Reduction"]);
  await review.locator(".candidate input.pz-input").first().fill("Lives in Leeds, England");
  await review.locator(".candidate input[type=checkbox]").nth(1).uncheck();
  await page.screenshot({ path: path.join(EVIDENCE, "import-01-review.png") });
  await page.getByTestId("import-save").click();
  await expect(page.getByText(/Saved 2 facts/)).toBeVisible();
  const profile = await sw.evaluate(async () => (await chrome.storage.local.get("profile")).profile);
  expect(profile.extraFacts.map((f: { text: string }) => f.text)).toEqual(["Lives in Leeds, England", "Is applying for Council Tax Reduction"]);
  expect(profile.extraFacts[0].source).toBe("imported-chatgpt");
});

test("Import: ChatGPT export .zip and Claude export .json are parsed locally (user messages only)", async ({ context, extensionId, sw }) => {
  const chatgpt = [{
    title: "Council tax help", current_node: "n3",
    mapping: {
      root: { id: "root", parent: null, children: ["n1"], message: null },
      n1: { id: "n1", parent: "root", children: ["n2"], message: { author: { role: "user" }, content: { content_type: "text", parts: ["I'm 74 and I live alone in Leeds. Can you help me with council tax?"] } } },
      n2: { id: "n2", parent: "n1", children: ["n3"], message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["I am an AI assistant and I live in the cloud."] } } },
      n3: { id: "n3", parent: "n2", children: [], message: { author: { role: "user" }, content: { content_type: "text", parts: ["I prefer short answers because my eyesight is poor."] } } },
    },
  }];
  const zipPath = path.join(EVIDENCE, "synthetic-chatgpt-export.zip");
  fs.writeFileSync(zipPath, zipSync({ "conversations.json": strToU8(JSON.stringify(chatgpt)), "chat.html": strToU8("<html></html>") }));
  const claude = [{ uuid: "c1", name: "Bus pass", chat_messages: [
    { sender: "human", text: "I'm a retired nurse and I'm trying to apply for a bus pass." },
    { sender: "assistant", text: "I'm Claude, I'm happy to help." },
  ] }];
  const claudePath = path.join(EVIDENCE, "synthetic-claude-conversations.json");
  fs.writeFileSync(claudePath, JSON.stringify(claude));

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html#import`);
  await page.getByTestId("file-chatgpt").click();
  await page.getByTestId("import-file").setInputFiles(zipPath);
  const review = page.getByTestId("import-review");
  await expect(review).toBeVisible({ timeout: 30_000 });
  const facts = (await review.locator(".candidate input.pz-input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).join(" | ");
  expect(facts).toContain("I'm 74 and I live alone in Leeds.");
  expect(facts).toContain("I prefer short answers because my eyesight is poor.");
  expect(facts).not.toContain("AI assistant");
  await page.screenshot({ path: path.join(EVIDENCE, "import-02-chatgpt-zip.png") });
  await page.getByTestId("import-save").click();
  await page.getByTestId("file-claude").click();
  await page.getByTestId("import-file").setInputFiles(claudePath);
  await expect(review).toBeVisible({ timeout: 30_000 });
  const claudeFacts = (await review.locator(".candidate input.pz-input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).join(" | ");
  expect(claudeFacts).toContain("retired nurse");
  expect(claudeFacts).not.toContain("I'm Claude");
  // Optional AI tidy-up of the extracted excerpt (real Gemini call).
  await page.getByTestId("import-ai").click();
  await expect(review.getByText(/Tidied by Prism's AI/)).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: path.join(EVIDENCE, "import-03-claude-ai.png") });
  await page.getByTestId("import-save").click();
  const profile = await sw.evaluate(async () => (await chrome.storage.local.get("profile")).profile);
  expect(profile.extraFacts.length).toBeGreaterThanOrEqual(3);
  expect(profile.extraFacts.some((f: { source: string }) => f.source === "imported-claude")).toBe(true);
});

test("Helping someone else: chat override is temporary and the saved profile is unchanged", async ({ context, sw }) => {
  await sw.evaluate(() => chrome.storage.local.set({ profile: { name: "Sam Patel", formOfAddress: "Sam", ageRange: "35–54", country: "England", city: "Bristol", language: "English", otherLanguages: "", readingNeeds: "", background: "", goals: "", addressLine1: "2 Mill Lane", addressLine2: "", postcode: "BS1 4XE", phone: "", email: "", dateOfBirth: "1979-05-02", people: [], extraFacts: [], updatedAt: 0 } }));
  const before = await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get("profile")).profile));
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1300 });
  await page.goto(`${FIXTURES}/benefits-form/`);
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:open-chat" });
  await page.getByTestId("chat-input").fill("I'm helping my mum Joan Patel, she's 81 and lives at 14 Elm Road, Bath BA1 2AB. What should go in the full name box?");
  await page.getByTestId("chat-send").click();
  await expect(page.locator(".msg--notice").filter({ hasText: /Helping someone else/ })).toBeVisible();
  await expect(page.getByTestId("prism-chat")).toHaveAttribute("data-status", /idle|done|waiting-user|waiting-confirm/, { timeout: 120_000 });
  await expect(page.getByTestId("chat-log")).toContainText("Joan");
  await shot(page, "chat-08-helping-someone");
  expect(await sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get("profile")).profile))).toBe(before);
  // Fill out uses the temporary person too.
  await page.getByRole("button", { name: "Close chat" }).click();
  const b = (await page.locator("#full-name").boundingBox())!;
  await dragSelect(page, [b.x - 30, b.y - 30], [b.x + b.width + 40, b.y + b.height + 10]);
  await page.locator("[data-testid=prism-menu] [data-action=fill]").click();
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  await expect(card).toContainText("Joan");
  await shot(page, "assist-09-fill-for-someone-else");
});

test("Welcome page renders and offers a practice page", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  // First run: choose a language, then the welcome page appears in it.
  await page.locator("[data-lang=en]").click();
  await expect(page.getByRole("heading", { name: "Websites, made calm and clear." })).toBeVisible();
  await expect(page.getByText("Nothing on the website is deleted.")).toBeVisible();
  await expect(page.getByRole("img", { name: "refresh button" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Never lose your place" })).toBeVisible();
  await expect(page.getByTestId("try-demo")).toHaveCount(0);
  const sites = page.getByTestId("demo-sites").getByRole("link");
  for (const name of ["Illinois Human Services", "Mississippi Medicaid", "craigslist", "Berkshire Hathaway"]) await expect(sites.filter({ hasText: name })).toHaveCount(1);
  await expect(sites.filter({ hasText: "TreasuryDirect" })).toHaveCount(0);
  await expect(sites).toHaveCount(12);
  for (const link of await sites.all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  await page.screenshot({ path: path.join(EVIDENCE, "welcome-01.png"), fullPage: true });
});

test("Online (hosted) Prism service works through the extension", async ({ context, sw }) => {
  // The local address points nowhere, so only the online service can answer.
  await setSettings(sw, { helperMode: "hosted", localUrl: "http://127.0.0.1:9" });
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const b = (await page.locator("#deadline-notice").boundingBox())!;
  await dragSelect(page, [b.x - 4, b.y - 4], [b.x + b.width + 4, b.y + b.height + 4]);
  await page.locator("[data-testid=prism-menu] [data-action=define]").click();
  const card = page.getByTestId("prism-card");
  await expect(card).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
  await shot(page, "hosted-01-define");

});

test("Choosing a Style before tidying is remembered and applied when tidying turns on", async ({ context, sw, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`${FIXTURES}/cluttered-info/`);
  await prismReady(page);
  const id = await tabId(sw, page);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${id}`);
  await expect(popup.getByRole("switch", { name: /Tidy this page/ })).toHaveAttribute("aria-checked", "false");
  await popup.locator("[data-style=bold]").click();
  await expect(popup.locator("[data-style=bold]")).toHaveAttribute("aria-pressed", "true");
  await popup.waitForTimeout(1500); // survives the popup's status refresh
  await expect(popup.locator("[data-style=bold]")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-prism-on"))).toBe(false);
  await popup.reload();
  await expect(popup.locator("[data-style=bold]")).toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("switch", { name: /Tidy this page/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-prism-style"))).toBe("bold");
});
