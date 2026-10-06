// A remote-controlled Chrome with Prism loaded, for usability sessions run by persona agents.
// Each command is one HTTP GET, so an agent can look (screenshot + list of what's on screen), then act.
// Usage: node tools/persona-browser.mjs <port> <outDir> [--lang Spanish] [--fresh] [--size 1366x768]
//   --fresh   first run: no language chosen yet, opens Prism's welcome page like a new install
// Commands (all GET, answers are JSON):
//   /goto?url=…                 open a website in the main tab
//   /look                       screenshot of the current view + visible text and clickable things with x,y
//   /click?x=&y=                click at a point;  /clicktext?text=…[&exact=1]  click something by its words
//   /type?text=…  /key?key=Enter  /scroll?dy=600  /hover?x=&y=
//   /drag?x1=&y1=&x2=&y2=[&alt=1]   drag a box (alt=1 holds Option/Alt, Prism's "point at something")
//   /popup                      open Prism's toolbar popup for the main tab (becomes the current view)
//   /view?name=main|popup|welcome|options   switch which page commands go to
//   /state                      page address, tidy status, Guide me status
//   /spoken                     what Read aloud has said so far
//   /stop                       close the browser
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const port = Number(args[0]);
const outDir = path.resolve(args[1] ?? "persona-out");
const flag = (name) => args.includes(name);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const [width, height] = opt("--size", "1366x768").split("x").map(Number);
fs.mkdirSync(outDir, { recursive: true });

function chromeBin() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  for (const d of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const bin = path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(bin)) return bin;
  }
}

const EXT = path.join(root, "extension/dist-test");
const ctx = await chromium.launchPersistentContext("", {
  executablePath: chromeBin(), headless: true, viewport: { width, height },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const extId = sw.url().split("/")[2];
const base = { helperMode: "local", localUrl: "http://127.0.0.1:8787" };
await sw.evaluate((s) => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...(settings ?? {}), ...s } })),
  flag("--fresh") ? base : { ...base, languageChosen: true, onboarded: true, translateTo: opt("--lang", "English") });
// Remember what Read aloud says (the voice itself can't be heard here).
await sw.evaluate(() => {
  globalThis.__spoken = [];
  const speak = chrome.tts.speak.bind(chrome.tts);
  chrome.tts.speak = (text, options, cb) => { globalThis.__spoken.push({ text: String(text).slice(0, 400), lang: options?.lang }); return speak(text, options, cb); };
});

await new Promise((r) => setTimeout(r, 1500));
for (const p of ctx.pages()) if (p.url() === "about:blank" && ctx.pages().length > 1) await p.close().catch(() => {});
const views = { main: ctx.pages().find((p) => !p.url().startsWith("chrome-extension://")) ?? await ctx.newPage() };
let opening = 0;
const ownPage = async () => { opening++; try { return await ctx.newPage(); } finally { opening--; } };
let welcome = ctx.pages().find((p) => p.url().includes("welcome.html"));
if (!welcome && flag("--fresh")) { welcome = await ownPage(); await welcome.goto(`chrome-extension://${extId}/welcome.html`); }
if (welcome) views.welcome = welcome;
let current = flag("--fresh") && welcome ? "welcome" : "main";
// A tab the website opens (a link with target=_blank) becomes the main tab; pages the harness opens don't.
ctx.on("page", (p) => {
  if (opening) return;
  p.waitForLoadState("domcontentloaded").then(() => { if (!p.url().startsWith("chrome-extension://")) { views.main = p; current = "main"; } }).catch(() => {});
});
let shotNo = 0;

const page = () => views[current] ?? views.main;
const mainTabId = () => sw.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)?.id, views.main.url());

async function look() {
  const p = page();
  const file = path.join(outDir, `${String(++shotNo).padStart(3, "0")}-${current}.png`);
  await p.screenshot({ path: file }).catch(() => {});
  const seen = await p.evaluate(() => {
    const out = [];
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden"; };
    const walk = (rootNode, where) => {
      for (const el of rootNode.querySelectorAll("a,button,input,select,textarea,[role=button],[role=link],[role=option],[role=radio],[role=switch],[role=tab],summary,label")) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.innerText || el.value || el.placeholder || el.title || "").trim().replace(/\s+/g, " ").slice(0, 70);
        if (!name && !/input|select|textarea/i.test(el.tagName)) continue;
        out.push({ where, tag: el.tagName.toLowerCase(), name, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) });
      }
      for (const host of rootNode.querySelectorAll("*")) if (host.shadowRoot) walk(host.shadowRoot, host.tagName === "PRISM-ROOT" ? "prism" : where);
    };
    walk(document, "page");
    const prism = document.querySelector("prism-root")?.shadowRoot?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1500) ?? "";
    return { title: document.title, text: document.body?.innerText.replace(/\n{2,}/g, "\n").slice(0, 2500) ?? "", prismText: prism, clickable: out.slice(0, 90) };
  }).catch((e) => ({ error: String(e) }));
  return { view: current, url: p.url(), screenshot: file, ...seen };
}

const handlers = {
  async goto(q) { await views.main.goto(q.url, { waitUntil: "domcontentloaded", timeout: 45000 }); current = "main"; await views.main.waitForTimeout(2500); return look(); },
  look,
  async click(q) { await page().mouse.click(Number(q.x), Number(q.y)); await page().waitForTimeout(1500); return look(); },
  async clicktext(q) {
    const p = page();
    const loc = p.getByText(q.text, { exact: q.exact === "1" }).or(p.getByRole("button", { name: q.text })).or(p.getByRole("link", { name: q.text }));
    const target = loc.filter({ visible: true }).first();
    await target.click({ timeout: 8000 });
    await p.waitForTimeout(1500);
    return look();
  },
  async type(q) { await page().keyboard.type(q.text, { delay: 35 }); await page().waitForTimeout(600); return look(); },
  async key(q) { await page().keyboard.press(q.key); await page().waitForTimeout(1500); return look(); },
  async scroll(q) { await page().mouse.wheel(0, Number(q.dy ?? 600)); await page().waitForTimeout(800); return look(); },
  async hover(q) { await page().mouse.move(Number(q.x), Number(q.y)); await page().waitForTimeout(800); return look(); },
  async drag(q) {
    const p = page();
    if (q.alt === "1") await p.keyboard.down("Alt");
    await p.mouse.move(Number(q.x1), Number(q.y1));
    await p.mouse.down();
    await p.mouse.move(Number(q.x2), Number(q.y2), { steps: 12 });
    await p.mouse.up();
    if (q.alt === "1") await p.keyboard.up("Alt");
    await p.waitForTimeout(1200);
    return look();
  },
  async popup() {
    const tabId = await mainTabId();
    if (!views.popup || views.popup.isClosed()) views.popup = await ownPage();
    await views.popup.setViewportSize({ width: 380, height: 640 });
    await views.popup.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
    await views.main.bringToFront();
    current = "popup";
    await views.popup.waitForTimeout(1500);
    return look();
  },
  async view(q) {
    if (q.name === "options" && !views.options) { views.options = await ownPage(); await views.options.goto(`chrome-extension://${extId}/options.html`); }
    if (q.name === "welcome" && !views.welcome) { views.welcome = await ownPage(); await views.welcome.goto(`chrome-extension://${extId}/welcome.html`); }
    if (!views[q.name]) return { error: `no ${q.name} view` };
    current = q.name;
    if (current === "main") await views.main.bringToFront();
    return look();
  },
  async state() {
    const tabId = await mainTabId();
    const guide = tabId ? await sw.evaluate(async (k) => (await chrome.storage.session.get(k))[k] ?? null, `guide:${tabId}`) : null;
    const tidy = tabId ? await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "prism:status" }).catch(() => null), tabId) : null;
    return { url: views.main.url(), tidy, guide: guide && { status: guide.status, step: guide.step, history: guide.history.slice(-5) } };
  },
  async spoken() { return { spoken: await sw.evaluate(() => globalThis.__spoken) }; },
  async stop() { setTimeout(async () => { await ctx.close(); process.exit(0); }, 100); return { ok: true }; },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const name = url.pathname.slice(1);
  const q = Object.fromEntries(url.searchParams);
  let body;
  try {
    body = handlers[name] ? await handlers[name](q) : { error: `unknown command ${name}`, commands: Object.keys(handlers) };
  } catch (e) {
    body = { error: String(e.message ?? e).slice(0, 400), hint: "Try /look to see the screen again." };
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body, null, 1));
}).listen(port, "127.0.0.1", () => console.log(`persona browser ready on http://127.0.0.1:${port} (screens in ${outDir})`));
