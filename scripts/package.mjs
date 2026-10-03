// Builds the extension and zips extension/dist into release/prism-extension-v<version>.zip
import { execSync } from "node:child_process";
import { zipSync } from "fflate";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/build.mjs", { cwd: root, stdio: "inherit" });
const dist = path.join(root, "extension/dist");
const files = {};
const walk = (dir, prefix = "") => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel);
    else files[`prism/${rel}`] = new Uint8Array(fs.readFileSync(path.join(dir, e.name)));
  }
};
walk(dist);
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.mkdirSync(path.join(root, "release"), { recursive: true });
const out = path.join(root, "release", `prism-extension-v${version}.zip`);
fs.writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`Packaged ${Object.keys(files).length} files → ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
