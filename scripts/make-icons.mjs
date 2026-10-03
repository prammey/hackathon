// Generates Prism's icons from the logo artwork (extension/assets/logo-source.png, 960×960).
// Uses macOS `sips` for high-quality downscaling. Usage: node scripts/make-icons.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "extension/assets/logo-source.png");
const targets = [
  ...[16, 32, 48, 128, 512].map((s) => [s, path.join(root, "extension/assets/icons", `icon-${s}.png`)]),
  [96, path.join(root, "extension/src/ui/logo-96.png")], // embedded in the UI (2× for 48 px display)
];
for (const [size, out] of targets) {
  execFileSync("sips", ["-s", "format", "png", "-z", String(size), String(size), src, "--out", out], { stdio: "ignore" });
}
console.log("Icons written from logo-source.png");
