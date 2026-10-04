// Runs Guide me like a person would: follows each spotlight (clicking or typing where it points), answers
// its questions, and stops before anything that pays/submits/sends (caution steps). Records every step.
// Usage: node tools/guide-run.mjs <tasks.json> <outDir>
//   tasks.json: [{"slug":"amazon-scarf","start":"https://www.amazon.com/" | "blank","goal":"...","language":"English",
//                 "answers":["Gmail"], "typing":{"email":"sam@example.com","search":"warm scarf"}}]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(root, "extension/dist-test");
const [tasksFile, outDir] = process.argv.slice(2);
const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const MAX_STEPS = 12;

function chromeBin() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  for (const d of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const bin = path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(bin)) return bin;
  }
}

const results = [];
for (const task of tasks) {
  const ctx = await chromium.launchPersistentContext("", {
    executablePath: chromeBin(), headless: true, viewport: { width: 1280, height: 860 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  await sw.evaluate((lang) => chrome.storage.local.set({ settings: { helperMode: "local", localUrl: "http://127.0.0.1:8787", languageChosen: true, onboarded: true, translateTo: lang } }), task.language ?? "English");
  const page = await ctx.newPage();
  const rec = { slug: task.slug, goal: task.goal, start: task.start, steps: [], end: "" };
  try {
    if (task.start !== "blank") { await page.goto(task.start, { waitUntil: "domcontentloaded", timeout: 40000 }); await page.waitForTimeout(3000); }
    else await page.goto("about:blank");
    const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({}))
      .find((t) => (u === "blank" ? t.url === "about:blank" : (t.url ?? "").startsWith(u.slice(0, 20))))?.id, task.start);
    await sw.evaluate(({ tabId, goal }) => chrome.runtime.sendMessage({ type: "guide:start", tabId, goal }).catch(() => null), { tabId, goal: task.goal });
    // The page-side spotlight answers through the service worker; read state from there too.
    const state = () => sw.evaluate(async (tabId) => (await chrome.storage.session.get(`guide:${tabId}`))[`guide:${tabId}`] ?? null, tabId);
    let answers = [...(task.answers ?? [])];
    let lastKey = "";
    for (let i = 0; i < 40 && rec.steps.length < MAX_STEPS; i++) {
      await page.waitForTimeout(1500);
      const s = await state();
      if (!s) { rec.end = "guide disappeared"; break; }
      if (s.status === "thinking") continue;
      const key = `${s.status}|${s.step?.instruction}|${s.step?.id}`;
      if (key === lastKey) continue;
      lastKey = key;
      const n = rec.steps.length + 1;
      const shot = path.join(outDir, `${task.slug}-${String(n).padStart(2, "0")}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      const step = { n, status: s.status, kind: s.step?.kind, instruction: s.step?.instruction ?? s.error ?? "", detail: s.step?.detail ?? "", caution: !!s.step?.caution, url: page.url(), shot: path.basename(shot) };
      rec.steps.push(step);
      if (s.status === "done" || s.status === "stuck") { rec.end = s.status; break; }
      if (s.status === "asking") {
        const a = answers.shift() ?? s.step.choices[0] ?? "I'm not sure";
        step.answered = a;
        await sw.evaluate(({ tabId, a }) => chrome.runtime.sendMessage({ type: "guide:answer", tabId, answer: a }).catch(() => null), { tabId, a });
        continue;
      }
      if (s.status !== "showing") continue;
      if (s.step.caution) { rec.end = "stopped before a consequential step (as a careful person would)"; break; }
      // Act like a person on the highlighted element.
      const ring = page.locator("prism-root").locator("[data-testid=guide-ring]");
      const box = await ring.boundingBox().catch(() => null);
      if (s.step.kind === "click" || s.step.kind === "choose") {
        if (!box) { step.note = "no spotlight visible"; rec.end = "no spotlight"; break; }
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        if (s.step.kind === "choose") {
          // A native select needs a value: pick the second option if there is one.
          await page.evaluate((id) => { const el = document.querySelector(`[data-prism-id="${id}"],[data-prism-rid="${id}"]`); if (el instanceof HTMLSelectElement && el.options.length > 1) { el.selectedIndex = 1; el.dispatchEvent(new Event("change", { bubbles: true })); } }, s.step.id);
        }
        await page.waitForTimeout(2500);
      } else if (s.step.kind === "type") {
        const want = Object.entries(task.typing ?? {}).find(([k]) => s.step.instruction.toLowerCase().includes(k))?.[1] ?? task.typing?.default ?? "test";
        step.typed = want;
        await page.keyboard.type(want, { delay: 20 });
        await page.locator("prism-root").locator("[data-testid=guide-done]").click().catch(() => {});
        await page.waitForTimeout(1500);
      } else if (s.step.kind === "read") {
        await page.locator("prism-root").locator("[data-testid=guide-done]").click().catch(() => {});
      }
    }
    if (!rec.end) rec.end = rec.steps.length >= MAX_STEPS ? `stopped after ${MAX_STEPS} steps` : "timeout";
  } catch (e) {
    rec.end = `error: ${String(e).slice(0, 200)}`;
  }
  results.push(rec);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  await ctx.close();
}
console.log(JSON.stringify(results.map((r) => ({ slug: r.slug, steps: r.steps.length, end: r.end }))));
