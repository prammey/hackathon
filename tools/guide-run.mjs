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
    await page.bringToFront();
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
    // Commands go from an extension page, exactly as the Prism popup sends them.
    const extId = sw.url().split("/")[2];
    const ext = await ctx.newPage();
    await ext.goto(`chrome-extension://${extId}/options.html`);
    const send = (m) => ext.evaluate((m) => chrome.runtime.sendMessage(m).catch(() => null), m);
    await page.bringToFront();
    await send({ type: "guide:start", tabId, goal: task.goal });
    // The page-side spotlight answers through the service worker; read state from there too.
    let cur = page;
    let curTab = tabId;
    ctx.on("page", async (p) => { if (p.url().startsWith("chrome-extension://")) return; cur = p; });
    const state = async () => {
      // The guide may have moved to a tab the click opened.
      const found = await sw.evaluate(async () => {
        const all = await chrome.storage.session.get(null);
        const k = Object.keys(all).find((k) => k.startsWith("guide:"));
        return k ? all[k] : null;
      });
      if (found && found.tabId !== curTab) curTab = found.tabId;
      return found;
    };
    let answers = [...(task.answers ?? [])];
    let lastKey = "";
    for (let i = 0; i < 150 && rec.steps.length < MAX_STEPS; i++) {
      await cur.waitForTimeout(1500);
      const s = await state();
      if (!s) { rec.end = "guide disappeared"; break; }
      if (s.status === "thinking") continue;
      const key = `${s.status}|${s.step?.instruction}|${s.step?.id}|${s.history.length}`;
      if (key === lastKey) continue;
      lastKey = key;
      const n = rec.steps.length + 1;
      const pg = cur;
      const shot = path.join(outDir, `${task.slug}-${String(n).padStart(2, "0")}.png`);
      await pg.screenshot({ path: shot }).catch(() => {});
      const step = { n, status: s.status, kind: s.step?.kind, instruction: s.step?.instruction ?? s.error ?? "", detail: s.step?.detail ?? "", caution: !!s.step?.caution, url: pg.url(), shot: path.basename(shot) };
      rec.steps.push(step);
      if (s.status === "done" || s.status === "stuck") { rec.end = s.status; break; }
      if (s.status === "asking") {
        const a = answers.shift() ?? s.step.choices[0] ?? "I'm not sure";
        step.answered = a;
        await send({ type: "guide:answer", tabId: curTab, answer: a });
        continue;
      }
      if (s.status !== "showing") continue;
      const warned = await pg.locator("prism-root").locator(".guide-card--caution").count().catch(() => 0);
      step.caution = step.caution || warned > 0;
      if (step.caution) { rec.end = "stopped before a consequential step (as a careful person would)"; break; }
      // Act like a person on the highlighted element.
      // Click where the highlighted element really is (after its scroll settles), as a person would.
      await pg.waitForTimeout(800);
      const box = await pg.evaluate((id) => {
        // The spotlight marks what the person sees (a hidden checkbox's label, for example).
        const el = document.querySelector("[data-prism-guide]") ?? document.querySelector(`[data-prism-id="${id}"],[data-prism-rid="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const hit = top === el || el.contains(top) ? "target" : `${top?.tagName}.${String(top?.className).slice(0, 40)}`;
        return r.width && r.height ? { x: r.left, y: r.top, width: r.width, height: r.height, hit } : null;
      }, s.step.id).catch(() => null);
      if (s.step.kind === "click" || s.step.kind === "choose") {
        if (!box) { step.note = "no spotlight visible"; rec.end = "no spotlight"; break; }
        step.hit = box.hit;
        await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        if (s.step.kind === "choose") {
          // A native select needs a value: pick the second option if there is one.
          await pg.evaluate((id) => { const el = document.querySelector(`[data-prism-id="${id}"],[data-prism-rid="${id}"]`); if (el instanceof HTMLSelectElement && el.options.length > 1) { el.selectedIndex = 1; el.dispatchEvent(new Event("change", { bubbles: true })); } }, s.step.id);
          await pg.keyboard.press("Escape").catch(() => {});
          await pg.locator("prism-root").locator("[data-testid=guide-done]").click({ timeout: 3000 }).catch(() => {});
        }
        await pg.waitForTimeout(2500);
      } else if (s.step.kind === "type") {
        const want = Object.entries(task.typing ?? {}).find(([k]) => s.step.instruction.toLowerCase().includes(k))?.[1] ?? task.typing?.default ?? "test";
        step.typed = want;
        // A person clicks into the box first (old sites clear "Enter location..." on click).
        if (box) await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await pg.keyboard.type(want, { delay: 20 });
        await pg.locator("prism-root").locator("[data-testid=guide-done]").click().catch(() => {});
        await pg.waitForTimeout(1500);
      } else if (s.step.kind === "read") {
        await pg.locator("prism-root").locator("[data-testid=guide-done]").click().catch(() => {});
      }
    }
    if (!rec.end) { rec.end = rec.steps.length >= MAX_STEPS ? `stopped after ${MAX_STEPS} steps` : "timeout"; const s = await state(); rec.last = s && { status: s.status, step: s.step, error: s.error, history: s.history.slice(-4) }; }
  } catch (e) {
    rec.end = `error: ${String(e).slice(0, 200)}`;
  }
  results.push(rec);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  await ctx.close();
}
console.log(JSON.stringify(results.map((r) => ({ slug: r.slug, steps: r.steps.length, end: r.end }))));
