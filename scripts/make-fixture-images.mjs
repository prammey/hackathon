// Renders fixture images whose text exists only as pixels (for OCR tests).
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const images = {
  "aviso-es.png": { w: 760, h: 300, html: `<div style="width:760px;height:300px;box-sizing:border-box;padding:26px 32px;background:#fff4d6;border:6px solid #b42318;font-family:Georgia">
    <div style="font:bold 34px Georgia;color:#b42318">AVISO IMPORTANTE</div>
    <div style="font:24px Georgia;color:#222;margin-top:14px">Corte de agua programado el martes 21 de octubre</div>
    <div style="font:24px Georgia;color:#222;margin-top:8px">de 9:00 a 14:00 en las calles Mayor y Real.</div>
    <div style="font:20px Georgia;color:#444;margin-top:18px">Llene recipientes con antelación. Información: 900 123 456</div></div>` },
  "bin-poster.png": { w: 760, h: 340, html: `<div style="width:760px;height:340px;box-sizing:border-box;padding:28px;background:#14532d;color:#ecfdf5;font-family:Impact,Arial Black,sans-serif;transform:rotate(-0deg)">
    <div style="font-size:44px;letter-spacing:1px">YOUR BIN DAY IS CHANGING</div>
    <div style="font:bold 26px Arial;margin-top:14px">From Monday 3 November 2026, black bins will be</div>
    <div style="font:bold 26px Arial">collected on <span style="background:#facc15;color:#111;padding:0 6px">THURSDAYS</span> instead of Tuesdays.</div>
    <div style="font:20px Arial;margin-top:22px;opacity:.9">Recycling stays the same. Put bins out by 7am.</div>
    <div style="font:16px Arial;margin-top:10px;opacity:.8">Ashbridge Borough Council (fictional)</div></div>` },
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
const page = await browser.newPage();
for (const [file, spec] of Object.entries(images)) {
  await page.setViewportSize({ width: spec.w, height: spec.h });
  await page.setContent(`<html><body style="margin:0">${spec.html}</body></html>`);
  await page.screenshot({ path: path.join(root, "fixtures/image-text", file) });
}
await browser.close();
console.log("Fixture images written");
