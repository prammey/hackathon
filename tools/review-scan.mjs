// Design review scanner: loads the real Prism test build, opens each site, and saves BEFORE and AFTER
// screenshots in every Style (top of page and one screen down), plus objective checks.
// Usage: node tools/review-scan.mjs <sites.json> <outDir>
//   sites.json: [{"slug":"amazon","url":"https://www.amazon.com/"}, ...]
// Needs the local helper (scripts/start-helper.sh) and `node scripts/build.mjs --test`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(root, "extension/dist-test");
const [sitesFile, outDir] = process.argv.slice(2);
const sites = JSON.parse(fs.readFileSync(sitesFile, "utf8"));
const STYLES = (process.env.STYLES ?? "soft,clear,calm,bold").split(",");
fs.mkdirSync(outDir, { recursive: true });

function chromeBin() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  for (const d of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const bin = path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (fs.existsSync(bin)) return bin;
  }
}

const ctx = await chromium.launchPersistentContext("", {
  executablePath: chromeBin(), headless: true, viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
await sw.evaluate(() => chrome.storage.local.set({ settings: { helperMode: "local", localUrl: "http://127.0.0.1:8787", languageChosen: true, onboarded: true } }));

const tabMsg = (page, msg) => sw.evaluate(async ({ url, msg }) => {
  const [tab] = await chrome.tabs.query({ url: url.split("#")[0] + "*" });
  return chrome.tabs.sendMessage(tab.id, msg);
}, { url: page.url(), msg });

const checks = (page) => page.evaluate(() => {
  const vw = innerWidth;
  const hScroll = document.documentElement.scrollWidth - vw > 4;
  // Overlapping visible controls (buttons/links/fields drawn on top of each other).
  const ctrls = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select")]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 4 && r.height > 4 && r.top < innerHeight && r.bottom > 0);
  let overlaps = 0;
  for (let i = 0; i < ctrls.length && i < 300; i++) for (let j = i + 1; j < ctrls.length && j < 300; j++) {
    const a = ctrls[i], b = ctrls[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 6 && h > 6) overlaps++;
  }
  const fixes = document.querySelectorAll("[data-prism-fix]").length;
  const folded = document.querySelectorAll("[data-prism-collapsed]:not([data-prism-open])").length;
  return { hScroll, overlaps, fixes, folded };
});

const results = [];
for (const site of sites) {
  const rec = { slug: site.slug, url: site.url, shots: [] };
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 40000 });
    rec.http = resp?.status();
    await page.waitForTimeout(3500);
    rec.title = await page.title();
    await page.screenshot({ path: path.join(outDir, `${site.slug}-before.png`) });
    await page.evaluate(() => scrollBy(0, innerHeight * 0.9));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, `${site.slug}-before-2.png`) });
    await page.evaluate(() => scrollTo(0, 0));
    rec.beforeChecks = await checks(page);
    await page.waitForFunction(() => !!document.querySelector("prism-root"), null, { timeout: 15000 });
    await tabMsg(page, { type: "prism:set-style", styleId: STYLES[0] });
    await tabMsg(page, { type: "prism:toggle", on: true });
    let st;
    for (let i = 0; i < 60; i++) {
      st = await tabMsg(page, { type: "prism:status" });
      if (st.status === "planned" || st.status === "cached") break;
      await page.waitForTimeout(1000);
    }
    rec.status = st?.status;
    rec.nextStep = st?.nextStep;
    for (const style of STYLES) {
      await tabMsg(page, { type: "prism:set-style", styleId: style });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(1500);
      const top = path.join(outDir, `${site.slug}-${style}.png`);
      await page.screenshot({ path: top });
      await page.evaluate(() => scrollBy(0, innerHeight * 0.9));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, `${site.slug}-${style}-2.png`) });
      await page.evaluate(() => scrollTo(0, 0));
      rec.shots.push({ style, checks: await checks(page) });
    }
  } catch (e) {
    rec.error = String(e).slice(0, 300);
  }
  results.push(rec);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  await page.close();
}
await ctx.close();
console.log(JSON.stringify(results.map((r) => ({ slug: r.slug, http: r.http, status: r.status, error: r.error })), null, 0));
