// Builds the public website (the welcome page + install steps) into site/dist, with the ready-to-load
// extension zip for download. Deploy: cd site/dist && vercel deploy --prod
import { execSync } from "node:child_process";
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/package.mjs", { cwd: root, stdio: "inherit" });
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const dist = path.join(root, "extension/dist");
const out = path.join(root, "site/dist");
// Keep Vercel's project link (and the files it manages) between rebuilds; replace everything else.
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (![".vercel", ".env.local", ".gitignore"].includes(f)) fs.rmSync(path.join(out, f), { recursive: true, force: true });

await esbuild.build({
  entryPoints: [path.join(root, "extension/src/site/main.tsx")],
  outfile: path.join(out, "site.js"),
  bundle: true, minify: true, format: "iife", target: ["es2020"],
  jsx: "automatic", jsxImportSource: "preact",
  loader: { ".css": "text", ".png": "dataurl" },
  define: { __PRISM_VERSION__: JSON.stringify(pkg.version), __PRISM_HOSTED_URL__: '""', __PRISM_TEST__: "false" },
  legalComments: "none", logLevel: "warning",
});
fs.copyFileSync(path.join(dist, "pages.css"), path.join(out, "pages.css"));
fs.cpSync(path.join(dist, "fonts"), path.join(out, "fonts"), { recursive: true });
fs.cpSync(path.join(dist, "icons"), path.join(out, "icons"), { recursive: true });
fs.copyFileSync(path.join(root, "release", `prism-extension-v${pkg.version}.zip`), path.join(out, "Prism.zip"));
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prism — websites, made calm and clear</title>
  <meta name="description" content="Prism is a free Chrome extension that makes confusing websites calm, clear and easy to use.">
  <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png?v=${pkg.version}">
  <link rel="stylesheet" href="pages.css?v=${pkg.version}">
</head>
<body class="pz-scope">
  <div id="app"></div>
  <script src="site.js?v=${pkg.version}"></script>
</body>
</html>
`);
console.log(`Website built → ${path.relative(root, out)}`);
