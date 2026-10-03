// Builds the Prism extension into extension/dist (load it with "Load unpacked").
// Usage: node scripts/build.mjs [--watch] [--test]
//   --test  builds a test variant (open shadow root for Playwright, no welcome tab). Output: extension/dist-test
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ext = path.join(root, "extension");
const args = new Set(process.argv.slice(2));
const test = args.has("--test") || process.env.PRISM_TEST === "1";
const out = path.join(ext, test ? "dist-test" : "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { key } = JSON.parse(fs.readFileSync(path.join(ext, "extension-key.json"), "utf8"));
// The hosted helper URL is public configuration, not a secret.
const hostedFile = path.join(ext, "hosted-url.txt");
const hostedUrl = (process.env.PRISM_HOSTED_URL ?? (fs.existsSync(hostedFile) ? fs.readFileSync(hostedFile, "utf8") : "")).trim();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
fs.mkdirSync(path.join(out, "icons"), { recursive: true });

const common = {
  bundle: true,
  target: ["chrome121"],
  jsx: "automatic",
  jsxImportSource: "preact",
  loader: { ".css": "text", ".png": "dataurl" },
  define: {
    __PRISM_VERSION__: JSON.stringify(pkg.version),
    __PRISM_HOSTED_URL__: JSON.stringify(hostedUrl),
    __PRISM_TEST__: String(test),
  },
  sourcemap: test ? "inline" : false,
  legalComments: "none",
  logLevel: "warning",
};

const entries = [
  { in: "src/background/index.ts", out: "background.js", format: "esm" },
  { in: "src/content/index.tsx", out: "content.js", format: "iife" },
  { in: "src/content/early.ts", out: "early.js", format: "iife" },
  { in: "src/popup/main.tsx", out: "popup.js", format: "iife" },
  { in: "src/options/main.tsx", out: "options.js", format: "iife" },
  { in: "src/welcome/main.tsx", out: "welcome.js", format: "iife" },
  { in: "src/options/import-worker.ts", out: "import-worker.js", format: "iife" },
  { in: "src/offscreen/record.ts", out: "offscreen.js", format: "iife" },
];

function copyStatic() {
  fs.copyFileSync(path.join(ext, "src/pages/offscreen.html"), path.join(out, "offscreen.html"));
  for (const page of ["popup", "options", "welcome"]) {
    // Version the favicon URL so Chrome doesn't keep showing a cached old icon after an update.
    const html = fs.readFileSync(path.join(ext, "src/pages", `${page}.html`), "utf8")
      .replace(/href="icons\/(icon-\d+\.png)"/g, `href="icons/$1?v=${pkg.version}"`);
    fs.writeFileSync(path.join(out, `${page}.html`), html);
  }
  const css = fs.readFileSync(path.join(ext, "src/ui/prism-ui.css"), "utf8") + "\n" +
    fs.readFileSync(path.join(ext, "src/ui/pages.css"), "utf8");
  fs.writeFileSync(path.join(out, "pages.css"), css);
  const fonts = {
    "space-grotesk": "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
    "source-serif-4": "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2",
    inter: "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    nunito: "@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2",
    "atkinson-hyperlegible-next": "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2",
    "instrument-serif-italic": "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2",
  };
  for (const [name, file] of Object.entries(fonts)) {
    fs.copyFileSync(path.join(root, "node_modules", file), path.join(out, "fonts", `${name}.woff2`));
  }
  fs.copyFileSync(path.join(ext, "assets/fonts-LICENSE.txt"), path.join(out, "fonts", "LICENSE.txt"));
  for (const f of fs.readdirSync(path.join(ext, "assets/icons"))) {
    fs.copyFileSync(path.join(ext, "assets/icons", f), path.join(out, "icons", f));
  }
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest(), null, 2));
}

function manifest() {
  const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
  return {
    manifest_version: 3,
    name: test ? "Prism (test build)" : "Prism",
    short_name: "Prism",
    version: pkg.version,
    description: "Makes confusing websites calm, clear and easy to use. Tidy any page, point at anything to understand it, and get help with forms.",
    key,
    minimum_chrome_version: "121",
    icons,
    action: { default_popup: "popup.html", default_title: "Prism", default_icon: icons },
    background: { service_worker: "background.js", type: "module" },
    options_ui: { page: "options.html", open_in_tab: true },
    permissions: ["storage", "unlimitedStorage", "activeTab", "scripting", "contextMenus", "offscreen"],
    host_permissions: ["<all_urls>"],
    content_scripts: [
      { matches: ["http://*/*", "https://*/*"], js: ["early.js"], run_at: "document_start" },
      { matches: ["http://*/*", "https://*/*"], js: ["content.js"], run_at: "document_idle" },
    ],
    commands: {
      "start-selection": { suggested_key: { default: "Alt+Shift+P" }, description: "Point at something on the page" },
      "open-chat": { suggested_key: { default: "Alt+Shift+K" }, description: "Open Prism chat" },
    },
    web_accessible_resources: [{ resources: ["fonts/*.woff2"], matches: ["http://*/*", "https://*/*"], use_dynamic_url: true }],
  };
}

async function build() {
  await Promise.all(entries.map((e) => esbuild.build({
    ...common,
    entryPoints: [path.join(ext, e.in)],
    outfile: path.join(out, e.out),
    format: e.format,
  })));
  copyStatic();
  console.log(`Built ${test ? "test " : ""}extension → ${path.relative(root, out)}${hostedUrl ? ` (hosted helper: ${hostedUrl})` : " (local helper)"}`);
}

if (args.has("--watch")) {
  const ctxs = await Promise.all(entries.map((e) => esbuild.context({
    ...common, entryPoints: [path.join(ext, e.in)], outfile: path.join(out, e.out), format: e.format,
  })));
  await Promise.all(ctxs.map((c) => c.watch()));
  copyStatic();
  console.log("Watching for changes…");
} else {
  await build();
}
