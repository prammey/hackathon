/**
 * Local (on-device) extraction of self-descriptive statements from pasted text or AI-assistant exports.
 * Only the person's own messages are considered; secrets are dropped; nothing is saved until reviewed.
 */

export interface Candidate {
  id: string;
  text: string;
  origin: string; // e.g. conversation title, or "Pasted text"
}

const SELF = /\b(i am|i'm|i’m|im a|my name|call me|i live|i've lived|i work|i worked|i used to|i retired|i'm retired|retired|i was born|i speak|i read|i prefer|i like|i love|i don't like|i do not like|i hate|i need|i use|i have (a|an|two|three|\d)|i've got|my (mum|mom|mother|dad|father|wife|husband|partner|son|daughter|grandson|granddaughter|carer|job|doctor|pension|eyesight|hearing|condition|goal)|years old|i'm \d{2}|i am \d{2}|i care for|i look after|i help my|i'm learning|i am learning|i struggle|i find it hard|i'm not confident|i am not confident|i'm trying to|i am trying to|i want to)\b/i;
const SECRET = /(password|passcode|\bpin\b|cvv|cvc|sort code|account number|card number|iban|routing number|social security|\bssn\b|national insurance|passport number|api key|token|secret|\b\d{8,}\b|\b(?:\d[ -]?){13,19}\b)/i;
const MEMORY_LINE = /^\s*(?:[-*•]|\d+[.)]|\[\d{4}-\d{2}-\d{2}\])\s*(.+)$/;

export function candidatesFromText(text: string, origin: string, limit = 80): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
    if (t.length < 8 || t.length > 260 || SECRET.test(t)) return;
    const key = t.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: Math.random().toString(36).slice(2, 10), text: t, origin });
  };
  for (const line of text.split(/\r?\n/)) {
    // Memory dumps ("- Lives in Leeds", "[2025-01-02] - Prefers short answers") are facts as written.
    const m = line.match(MEMORY_LINE);
    if (m && m[1].length < 260 && !/^(user|assistant|human|claude|chatgpt):/i.test(m[1])) { push(m[1]); continue; }
    for (const sentence of line.split(/(?<=[.!?])\s+/)) if (SELF.test(sentence)) push(sentence);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** ChatGPT export: walk the visible branch of each conversation and keep only the person's messages. */
export function userTextFromChatGPT(conversations: unknown[]): { title: string; text: string }[] {
  const result: { title: string; text: string }[] = [];
  for (const conv of conversations as any[]) {
    const mapping = conv?.mapping;
    if (!mapping || typeof mapping !== "object") continue;
    const texts: string[] = [];
    let nodeId: string | undefined = conv.current_node;
    let guard = 0;
    while (nodeId && mapping[nodeId] && guard++ < 5000) {
      const msg = mapping[nodeId].message;
      if (msg?.author?.role === "user") {
        const parts = msg.content?.parts ?? [];
        for (const p of parts) if (typeof p === "string") texts.unshift(p);
      }
      nodeId = mapping[nodeId].parent;
    }
    if (texts.length) result.push({ title: String(conv.title ?? "Conversation"), text: texts.join("\n") });
  }
  return result;
}

/** Claude export: keep only messages sent by the person ("human"). */
export function userTextFromClaude(conversations: unknown[]): { title: string; text: string }[] {
  const result: { title: string; text: string }[] = [];
  for (const conv of conversations as any[]) {
    const msgs = conv?.chat_messages;
    if (!Array.isArray(msgs)) continue;
    const texts = msgs
      .filter((m: any) => m?.sender === "human")
      .map((m: any) => (typeof m.text === "string" && m.text) || (Array.isArray(m.content) ? m.content.map((c: any) => c?.text ?? "").join(" ") : ""))
      .filter(Boolean);
    if (texts.length) result.push({ title: String(conv.name ?? "Conversation"), text: texts.join("\n") });
  }
  return result;
}

/** Memory-like data anywhere in an export (Claude states memories are included in exports). */
export function memoryStrings(value: unknown, depth = 0, acc: string[] = []): string[] {
  if (depth > 6 || acc.length > 200) return acc;
  if (Array.isArray(value)) value.forEach((v) => memoryStrings(v, depth + 1, acc));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (/memor|preference|about_me|user_profile|custom_instructions/i.test(k)) {
        if (typeof v === "string") acc.push(...v.split(/\r?\n/));
        else memoryStrings(v, depth + 1, acc);
      } else if (typeof v === "object") memoryStrings(v, depth + 1, acc);
    }
  } else if (typeof value === "string" && depth > 0) acc.push(value);
  return acc;
}

export function detectFormat(data: unknown): "chatgpt" | "claude" | "unknown" {
  if (!Array.isArray(data) || !data.length) return "unknown";
  const first = data[0] as any;
  if (first?.mapping && "current_node" in first) return "chatgpt";
  if (Array.isArray(first?.chat_messages)) return "claude";
  return "unknown";
}
