/**
 * Web Worker: reads a ChatGPT/Claude export (.zip or .json) entirely on this computer and returns
 * candidate facts. Large files are streamed so the page stays responsive.
 */
import { Unzip, UnzipInflate } from "fflate";
import { JSONParser } from "@streamparser/json";
import {
  type Candidate, candidatesFromText, detectFormat, memoryStrings, userTextFromChatGPT, userTextFromClaude,
} from "./extract";

type Msg = { file: File; expected: "chatgpt" | "claude" };

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
const MAX_BYTES = 1024 * 1024 * 1024;

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { file, expected } = e.data;
  try {
    if (file.size > MAX_BYTES) throw new Error("That file is larger than 1 GB. Prism can't read it.");
    const jsonFiles: { name: string; data: Uint8Array }[] = [];
    if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
      await unzipJson(file, jsonFiles);
    } else {
      jsonFiles.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
    }
    if (!jsonFiles.length) throw new Error("Prism couldn't find any conversation files in that export.");

    const candidates: Candidate[] = [];
    let conversations = 0;
    let format: string = "unknown";
    for (const jf of jsonFiles) {
      post({ type: "progress", text: `Reading ${jf.name}…` });
      const items = await parseTopLevelArray(jf.data);
      const detected = detectFormat(items);
      if (detected !== "unknown") format = detected;
      const threads = detected === "chatgpt" ? userTextFromChatGPT(items) : detected === "claude" ? userTextFromClaude(items) : [];
      conversations += threads.length;
      for (const t of threads.slice(-400)) candidates.push(...candidatesFromText(t.text, t.title, 6));
      const memories = memoryStrings(items.length ? items : await parseAny(jf.data)).join("\n");
      if (memories) candidates.push(...candidatesFromText(memories, `${jf.name} (memories)`, 60));
    }
    const unique = dedupe(candidates).slice(0, 120);
    post({ type: "done", candidates: unique, conversations, format, mismatch: format !== "unknown" && format !== expected });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Prism couldn't read that file." });
  }
};

function dedupe(list: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = c.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function unzipJson(file: File, out: { name: string; data: Uint8Array }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = new Unzip((entry) => {
      // Only conversation and profile/memory JSON; skip images, audio and HTML copies.
      if (!/\.json$/i.test(entry.name) || !/(conversation|memor|user|project|profile)/i.test(entry.name)) return;
      const chunks: Uint8Array[] = [];
      entry.ondata = (err, chunk, final) => {
        if (err) return reject(err);
        chunks.push(chunk);
        if (final) {
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const data = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { data.set(c, off); off += c.length; }
          out.push({ name: entry.name, data });
        }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    const reader = file.stream().getReader();
    const pump = async () => {
      let read = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { unzip.push(new Uint8Array(0), true); break; }
        read += value.length;
        post({ type: "progress", text: `Opening the export… ${Math.round((read / file.size) * 100)}%` });
        unzip.push(value);
      }
      setTimeout(resolve, 0);
    };
    pump().catch(reject);
  });
}

/** Streams a top-level JSON array, emitting one element at a time (works for multi-hundred-MB files). */
async function parseTopLevelArray(data: Uint8Array): Promise<unknown[]> {
  const items: unknown[] = [];
  const parser = new JSONParser({ paths: ["$.*"], keepStack: false });
  parser.onValue = ({ value }) => { items.push(value); };
  const step = 4 * 1024 * 1024;
  try {
    for (let i = 0; i < data.length; i += step) parser.write(data.subarray(i, i + step));
  } catch {
    return [];
  }
  return items;
}

async function parseAny(data: Uint8Array): Promise<unknown> {
  if (data.length > 50 * 1024 * 1024) return null;
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { return null; }
}
