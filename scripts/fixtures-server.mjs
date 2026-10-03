// Serves fixtures/ on http://127.0.0.1:4173 with a strict CSP on /strict-csp/ and a submission counter.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const port = Number(process.env.FIXTURES_PORT ?? 4173);
const stats = { submissions: [] };
const types = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json" };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/__stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(stats));
  }
  if (url.pathname === "/__reset") { stats.submissions = []; res.writeHead(204); return res.end(); }
  if (req.method === "POST" && url.pathname === "/submit") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      stats.submissions.push({ at: Date.now(), form: url.searchParams.get("form"), fields: Object.fromEntries(new URLSearchParams(body)) });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html lang="en"><head><title>Received</title></head><body><main><h1>Application received</h1><p>Reference: TEST-${stats.submissions.length}</p></main></body></html>`);
    });
    return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    // SPA fallback for the dynamic app
    if (url.pathname.startsWith("/dynamic-app/")) file = path.join(root, "dynamic-app/index.html");
    else { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
  }
  const headers = { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" };
  if (url.pathname.startsWith("/strict-csp/")) headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'";
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Fixtures on http://127.0.0.1:${port}`));
