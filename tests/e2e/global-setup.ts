import { execSync } from "node:child_process";

export default async function globalSetup() {
  execSync("node scripts/build.mjs --test", { stdio: "inherit" });
  const health = await fetch("http://127.0.0.1:8787/health").then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    throw new Error("The Prism helper is not running on http://127.0.0.1:8787. Start it with scripts/start-helper.sh — AI tests use the real Gemini service.");
  }
}
