// Loads the real unpacked Prism test build into Chrome for Testing (Playwright's Chromium).
import { test as base, chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXT = path.resolve("extension/dist-test");
export const FIXTURES = "http://127.0.0.1:4173";
export const EVIDENCE = path.resolve("evidence/e2e");
fs.mkdirSync(EVIDENCE, { recursive: true });

function chromeBin(): string | undefined {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    const bin = path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(bin)) return bin;
  }
  return undefined;
}

type Fixtures = { context: BrowserContext; sw: Worker; extensionId: string };

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      executablePath: chromeBin(),
      headless: process.env.HEADED !== "1",
      viewport: { width: 1280, height: 860 },
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");
    await use(sw);
  },
  extensionId: async ({ sw }, use) => {
    await use(sw.url().split("/")[2]);
  },
});
export const expect = test.expect;

/** Sends a message to Prism's content script in the tab showing `page`. */
export async function tabMessage(sw: Worker, page: Page, message: unknown): Promise<any> {
  const url = page.url();
  return sw.evaluate(async ({ url, message }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === url);
    if (!tab?.id) throw new Error(`No tab for ${url}`);
    return chrome.tabs.sendMessage(tab.id, message);
  }, { url, message });
}

export async function tabId(sw: Worker, page: Page): Promise<number> {
  const url = page.url();
  return sw.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)!.id!, url);
}

export async function prismReady(page: Page) {
  await page.waitForFunction(() => !!document.querySelector("prism-root")?.shadowRoot, null, { timeout: 15_000 });
}

/** Tidies the page and waits until the AI plan (or cache) has been applied. */
export async function tidy(sw: Worker, page: Page, opts: { allowBase?: boolean } = {}) {
  await prismReady(page);
  await tabMessage(sw, page, { type: "prism:toggle", on: true });
  const status = await waitForStatus(sw, page, opts.allowBase ? ["planned", "cached", "base"] : ["planned", "cached"]);
  return status;
}

export async function waitForStatus(sw: Worker, page: Page, wanted: string[], timeout = 90_000) {
  const started = Date.now();
  let last: any;
  while (Date.now() - started < timeout) {
    last = await tabMessage(sw, page, { type: "prism:status" });
    if (wanted.includes(last.status)) return last;
    if (last.status === "base" && !wanted.includes("base") && Date.now() - started > 3000 && !/studying/i.test(last.message)) {
      throw new Error(`Tidy fell back to base: ${last.message}`);
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`Timed out waiting for ${wanted.join("/")}; last status ${last?.status}: ${last?.message}`);
}

export async function helperCalls(): Promise<number> {
  const h = await fetch("http://127.0.0.1:8787/health").then((r) => r.json());
  return h.requests as number;
}

export async function shot(page: Page, name: string) {
  const file = path.join(EVIDENCE, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

/** Drags a selection with the held shortcut (Alt by default). */
export async function dragSelect(page: Page, from: [number, number], to: [number, number], opts: { releaseKeyFirst?: boolean; key?: string } = {}) {
  const key = opts.key ?? "Alt";
  await page.mouse.move(from[0], from[1]);
  await page.keyboard.down(key);
  await page.waitForTimeout(60);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  if (opts.releaseKeyFirst) await page.keyboard.up(key);
  await page.mouse.move(to[0], to[1], { steps: 4 });
  await page.mouse.up();
  if (!opts.releaseKeyFirst) await page.keyboard.up(key);
}
