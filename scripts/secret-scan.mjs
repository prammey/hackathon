// Fails if anything that looks like a credential is in the repository files or the built extension.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PATTERNS = [
  [/ya29\.[0-9A-Za-z_-]{20,}/, "Google OAuth access token"],
  [/"refresh_token"\s*:/, "OAuth refresh token"],
  [/"client_secret"\s*:/, "OAuth client secret"],
  [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, "private key"],
  [/"type"\s*:\s*"service_account"/, "service account key file"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/sk-[A-Za-z0-9]{32,}/, "API secret key"],
  [/gh[opsu]_[A-Za-z0-9]{30,}/, "GitHub token"],
];
const tracked = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
const built = ["extension/dist", "extension/dist-test"].flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
let problems = 0;
for (const file of [...new Set([...tracked, ...built])]) {
  if (!fs.existsSync(file) || /\.(png|woff2|jpg|ico)$/.test(file) || file === "scripts/secret-scan.mjs") continue;
  const text = fs.readFileSync(file, "utf8");
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) { console.error(`✗ ${file}: looks like a ${label}`); problems++; }
  }
}
for (const forbidden of [".env", "helper/.env"]) if (tracked.includes(forbidden)) { console.error(`✗ ${forbidden} is tracked by git`); problems++; }
console.log(problems ? `${problems} possible secret(s) found` : `Secret scan clean (${tracked.length} repo files, ${built.length} built files)`);
process.exit(problems ? 1 : 0);
