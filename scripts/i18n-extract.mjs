// Collects every phrase passed to t("…") / tj("…") in extension/src and writes
// extension/src/locales/_source.json (the list translators work from). Run after changing UI text.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "extension/src");
const keys = new Set();
const call = /\b(?:tj?|k)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`)/g;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      for (const m of fs.readFileSync(p, "utf8").matchAll(call)) {
        const lit = m[1];
        const text = lit[0] === "`" ? lit.slice(1, -1) : JSON.parse(lit[0] === "'" ? `"${lit.slice(1, -1).replace(/"/g, '\\"')}"` : lit);
        keys.add(text);
      }
    }
  }
}
walk(src);
const list = [...keys].sort();
fs.writeFileSync(path.join(src, "locales/_source.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`${list.length} phrases → extension/src/locales/_source.json`);
