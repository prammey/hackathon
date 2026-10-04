/** Import context from ChatGPT or Claude: paste or export file → local extraction → review → save. */
import { useRef, useState } from "preact/hooks";
import { getProfile, saveProfile } from "../shared/storage";
import type { FactSource, Profile, Result } from "../shared/types";
import { t, tj } from "../shared/i18n";
import { Icon, Notice, useLanguage } from "../ui/components";
import { type Candidate, candidatesFromText } from "./extract";

type Source = "chatgpt" | "claude" | "other";
type Stage =
  | { kind: "idle" }
  | { kind: "paste"; source: Source }
  | { kind: "reading"; source: Source; text: string }
  | { kind: "review"; source: Source; viaFile: boolean; items: ReviewItem[]; excerpt: string; note?: string }
  | { kind: "saved"; count: number }
  | { kind: "error"; message: string };

interface ReviewItem { id: string; text: string; origin: string; keep: boolean; ai: boolean }

const NAMES: Record<Source, string> = { chatgpt: "ChatGPT", claude: "Claude", other: "other text" };
// "other text" is a description, not a product name, so it is the only one translated.
const sourceName = (source: Source) => (source === "other" ? t("other text") : NAMES[source]);
// Kept in English on purpose: it is text the person pastes into the AI.
const MEMORY_PROMPT = "List everything you remember about me as short bullet points: facts about me, my preferences and my goals. Do not include passwords, bank or card details, or ID numbers.";

export function ImportSection({ onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  useLanguage();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileSource = useRef<Source>("chatgpt");

  function review(source: Source, candidates: Candidate[], viaFile: boolean, note?: string) {
    if (!candidates.length) {
      setStage({ kind: "error", message: t("Prism didn't find anything about you in that. Try pasting your ChatGPT or Claude memories instead, or add facts yourself in “About you”.") });
      return;
    }
    setStage({
      kind: "review", source, viaFile, note,
      items: candidates.map((c) => ({ id: c.id, text: c.text, origin: c.origin, keep: true, ai: false })),
      excerpt: candidates.map((c) => `- ${c.text}`).join("\n").slice(0, 20000),
    });
  }

  function readFile(file: File) {
    const source = fileSource.current;
    setStage({ kind: "reading", source, text: t("Opening {file}…", { file: file.name }) });
    const worker = new Worker("import-worker.js");
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") setStage({ kind: "reading", source, text: m.text });
      if (m.type === "error") { setStage({ kind: "error", message: m.message }); worker.terminate(); }
      if (m.type === "done") {
        worker.terminate();
        const note = m.mismatch
          ? t("This looks like a {format} export rather than {source} — that's fine.", { format: m.format === "chatgpt" ? "ChatGPT" : "Claude", source: sourceName(source) })
          : t("Read {count} conversations.", { count: m.conversations });
        review(source, m.candidates, true, note);
      }
    };
    worker.postMessage({ file, expected: source });
  }

  async function aiTidy(s: Extract<Stage, { kind: "review" }>) {
    setAiBusy(true);
    const result = (await chrome.runtime.sendMessage({ type: "api", path: "/v1/import/extract", body: { text: s.excerpt, source: s.source } })) as Result<{ facts: { field: string; value: string; evidence: string }[] }>;
    setAiBusy(false);
    if (!result?.ok) { setStage({ ...s, note: result?.error?.message ?? t("Prism's AI couldn't help with this right now. You can still save the facts below.") }); return; }
    setStage({
      ...s, note: t("Tidied by Prism's AI."),
      items: result.value.facts.map((f) => ({ id: crypto.randomUUID(), text: f.value, origin: t("From: “{evidence}”", { evidence: f.evidence }), keep: true, ai: true })),
    });
  }

  async function save(s: Extract<Stage, { kind: "review" }>) {
    const profile = await getProfile();
    const source: FactSource = s.source === "chatgpt" ? "imported-chatgpt" : s.source === "claude" ? "imported-claude" : "pasted";
    const kept = s.items.filter((i) => i.keep && i.text.trim());
    const existing = new Set(profile.extraFacts.map((f) => f.text.toLowerCase()));
    const added = kept.filter((i) => !existing.has(i.text.trim().toLowerCase()))
      .map((i) => ({ id: crypto.randomUUID(), text: i.text.trim().slice(0, 300), source, addedAt: Date.now() }));
    await saveProfile({ ...profile, extraFacts: [...profile.extraFacts, ...added] });
    onSaved(await getProfile());
    setStage({ kind: "saved", count: added.length });
    setPaste("");
  }

  return (
    <section id="import" class="section" aria-labelledby="import-h">
      <h3 id="import-h">{t("Import from ChatGPT or Claude")}</h3>
      <p>{t("If you already use ChatGPT or Claude, you can bring in what they know about you. Prism reads it on this computer, shows you everything it found, and saves only what you choose.")}</p>

      {(stage.kind === "idle" || stage.kind === "saved" || stage.kind === "error") && (
        <>
          {stage.kind === "saved" && <Notice tone="ok">{stage.count === 1
            ? t("Saved {count} fact to “About you”. You can review or delete them there at any time.", { count: stage.count })
            : t("Saved {count} facts to “About you”. You can review or delete them there at any time.", { count: stage.count })}</Notice>}
          {stage.kind === "error" && <Notice tone="error">{stage.message}</Notice>}
          <div class="group">
            <h3>{t("Paste text")}</h3>
            <div class="import-buttons">
              <button class="pz-btn" type="button" onClick={() => setStage({ kind: "paste", source: "chatgpt" })} data-testid="paste-chatgpt"><Icon name="copy" /> {t("Paste from ChatGPT")}</button>
              <button class="pz-btn" type="button" onClick={() => setStage({ kind: "paste", source: "claude" })} data-testid="paste-claude"><Icon name="copy" /> {t("Paste from Claude")}</button>
              <button class="pz-btn" type="button" onClick={() => setStage({ kind: "paste", source: "other" })}><Icon name="copy" /> {t("Paste other text")}</button>
            </div>
          </div>
          <div class="group">
            <h3>{t("Import an export file")}</h3>
            <p class="pz-hint" style="margin:0">{t("A .zip or conversations .json file you downloaded from ChatGPT or Claude. It's read on this computer and never uploaded.")}</p>
            <div class="import-buttons">
              <button class="pz-btn" type="button" onClick={() => { fileSource.current = "chatgpt"; fileInput.current?.click(); }} data-testid="file-chatgpt"><Icon name="define" /> {t("ChatGPT export file")}</button>
              <button class="pz-btn" type="button" onClick={() => { fileSource.current = "claude"; fileInput.current?.click(); }} data-testid="file-claude"><Icon name="define" /> {t("Claude export file")}</button>
            </div>
            <input ref={fileInput} type="file" accept=".zip,.json,application/zip,application/json" hidden data-testid="import-file"
              onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) readFile(f); (e.target as HTMLInputElement).value = ""; }} />
          </div>
          <details class="group">
            <summary style="cursor:pointer;font-weight:700">{t("How do I get my information out of ChatGPT or Claude?")}</summary>
            <h3>ChatGPT</h3>
            <ul style="margin:0;padding-left:20px">
              <li>{tj("{label} Settings → Personalization → Memory → Manage memories. Copy them, then use “Paste from ChatGPT”.", { label: <strong>{t("Memories:")}</strong> })}</li>
              <li>{tj("{label} Settings → Personalization → Custom instructions. Copy and paste them.", { label: <strong>{t("Custom instructions:")}</strong> })}</li>
              <li>{tj("{label} Settings → Data controls → Export data. ChatGPT emails you a link (it expires after 24 hours). Download the .zip and choose “ChatGPT export file”.", { label: <strong>{t("Everything:")}</strong> })}</li>
            </ul>
            <h3>Claude</h3>
            <ul style="margin:0;padding-left:20px">
              <li>{tj("{label} Settings → Memory. Copy what's there, then use “Paste from Claude”.", { label: <strong>{t("Memory:")}</strong> })}</li>
              <li>{tj("{label} Settings → Privacy → Export data. Claude emails you a link (it expires after 24 hours). Download the .zip and choose “Claude export file”.", { label: <strong>{t("Everything:")}</strong> })}</li>
            </ul>
            <h3>{t("Or ask the assistant directly")}</h3>
            <p style="margin:0">{t("Paste this into ChatGPT or Claude, then paste its answer into Prism:")}</p>
            <div class="row"><code style="flex:1;padding:10px;background:var(--pz-mist);border-radius:8px">{MEMORY_PROMPT}</code>
              <button class="pz-btn pz-btn--small" type="button" onClick={async () => { await navigator.clipboard.writeText(MEMORY_PROMPT); setCopied(true); }}>{copied ? t("Copied") : t("Copy")}</button></div>
          </details>
        </>
      )}

      {stage.kind === "paste" && (
        <div class="group">
          <h3>{t("Paste from {source}", { source: sourceName(stage.source) })}</h3>
          <label class="pz-field" for="paste-box"><span>{t("Paste the text here")}</span>
            <textarea id="paste-box" class="pz-input" style="min-height:180px" value={paste} onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
              placeholder={t("For example:\n- Lives in Leeds, UK\n- Prefers short, simple explanations\n- Is applying for Pension Credit")} data-testid="paste-box" /></label>
          <div class="row">
            <button class="pz-btn pz-btn--primary" type="button" disabled={!paste.trim()} data-testid="paste-find"
              onClick={() => review(stage.source, candidatesFromText(paste, t("Pasted text"), 120), false)}>{t("Find facts about me")}</button>
            <button class="pz-btn pz-btn--quiet" type="button" onClick={() => setStage({ kind: "idle" })}>{t("Cancel")}</button>
          </div>
        </div>
      )}

      {stage.kind === "reading" && (
        <div class="group" role="status"><div class="pz-progress" aria-hidden="true" /><p style="margin:0">{stage.text}</p>
          <p class="pz-hint" style="margin:0">{t("Large exports can take a minute. Everything stays on this computer.")}</p></div>
      )}

      {stage.kind === "review" && (
        <div class="group" data-testid="import-review">
          <h3>{t("Check what Prism found ({count} selected)", { count: stage.items.filter((i) => i.keep).length })}</h3>
          {stage.note && <p class="pz-hint" style="margin:0">{stage.note}</p>}
          <p style="margin:0">{t("Untick anything that's wrong or private. You can edit the wording. Nothing is saved until you press Save.")}</p>
          {stage.items.map((item) => (
            <div class="candidate">
              <input type="checkbox" checked={item.keep} aria-label={t("Keep: {fact}", { fact: item.text })}
                onChange={(e) => setStage({ ...stage, items: stage.items.map((x) => x.id === item.id ? { ...x, keep: (e.target as HTMLInputElement).checked } : x) })} />
              <div style="display:grid;gap:4px">
                <input class="pz-input" value={item.text} aria-label={t("Fact")}
                  onInput={(e) => setStage({ ...stage, items: stage.items.map((x) => x.id === item.id ? { ...x, text: (e.target as HTMLInputElement).value } : x) })} />
                <span class="evidence">{item.origin}</span>
              </div>
            </div>
          ))}
          <div class="row">
            <button class="pz-btn pz-btn--primary" type="button" data-testid="import-save" onClick={() => save(stage)}>{t("Save {count} facts to About you", { count: stage.items.filter((i) => i.keep).length })}</button>
            {!stage.items.some((i) => i.ai) && (
              <button class="pz-btn" type="button" disabled={aiBusy} onClick={() => aiTidy(stage)} data-testid="import-ai">{aiBusy ? t("Asking Prism's AI…") : t("Let Prism's AI tidy these up")}</button>
            )}
            <button class="pz-btn pz-btn--quiet" type="button" onClick={() => setStage({ kind: "idle" })}>{t("Cancel")}</button>
          </div>
          {!stage.items.some((i) => i.ai) && (
            <details>
              <summary style="cursor:pointer">{t("What would be sent to the AI? ({count} characters)", { count: stage.excerpt.length.toLocaleString() })}</summary>
              <pre style="white-space:pre-wrap;max-height:200px;overflow:auto;background:var(--pz-mist);padding:10px;border-radius:8px;font-size:13px">{stage.excerpt}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
