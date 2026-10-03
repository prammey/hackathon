// Renders the Prism toolbar icons (PNG) from an SVG mark using Playwright's Chromium.
// Usage: CHROME_BIN=<path> node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Simplified mark that stays legible at 16px: solid ink prism + three spectrum bands.
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FFFFFF"/>
  <path d="M4 35 L21 32" stroke="#1B1F3B" stroke-width="5" stroke-linecap="round"/>
  <path d="M29 7 L52 52 L6 52 Z" fill="#1B1F3B" stroke="#1B1F3B" stroke-width="4" stroke-linejoin="round"/>
  <path d="M29 20 L41 44 L17 44 Z" fill="#4B3FD1"/>
  <path d="M44 30 L61 22" stroke="#FF7A59" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M45 36 L61 36" stroke="#FFC24B" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M44 42 L61 50" stroke="#2BB3A3" stroke-width="5.5" stroke-linecap="round"/>
</svg>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
  await page.locator("svg").screenshot({ path: path.join(root, "extension/assets/icons", `icon-${size}.png`), omitBackground: true });
}
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(`<html><body style="margin:0">${svg(512)}</body></html>`);
await page.locator("svg").screenshot({ path: path.join(root, "extension/assets/icons", "icon-512.png") });
await browser.close();
console.log("Icons written to extension/assets/icons");
