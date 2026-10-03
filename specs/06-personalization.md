# 06 — Personalization, imports, data handling, settings

Status: **Draft for Phase 1 review** · Last updated 2026-10-02

## 1. "About you" profile (all optional)
Prism works fully with an empty profile. Onboarding offers "Tell Prism a little about you (optional,
2 minutes)" and **Skip**.

Fields (each optional, each with a short "Why Prism asks" hint):
- Name and how to address you ("Margaret", "Mrs Patel", "Sam").
- Age range (under 18 · 18–34 · 35–54 · 55–69 · 70+) — used only to tune explanations; exact age
  optional.
- Location: country, region/city (free text) — for forms and local context.
- Languages: preferred reading language; other languages understood.
- Reading & accessibility: text size, "Explain things simply / normally / in detail", dyslexia-friendly
  font, low vision, colour vision notes, prefer reduced motion, uses a screen reader.
- Background & goals: free text ("Retired teacher, applying for a bus pass and managing my pension").
- Form details (for Fill out): address lines, postcode, phone, email, date of birth — each clearly
  labelled "used only to suggest form answers". **No passwords, PINs, card numbers, bank numbers,
  national ID/SSN** — these fields do not exist, and the extractor drops such values if found.
- **People I help** (optional list): named persona entries with the same fields, selectable in chat.

Every fact carries provenance: `{value, source: typed|imported-chatgpt|imported-claude|pasted|chat,
addedAt, confirmed: true}`. Only confirmed facts are used.

## 2. Imports from ChatGPT or Claude
No official API exposes a person's ChatGPT or Claude memories to third parties (OpenAI: none;
Anthropic: none; Sign in with ChatGPT gives identity only). Prism therefore offers exactly two honest
paths, both complete:

### 2.1 Paste
- Labelled buttons with neutral icons (clipboard glyph) and text: **Paste from ChatGPT**, **Paste from
  Claude**, **Paste other text**. Provider logos are **not** used unless written permission is obtained
  (OpenAI and Anthropic brand terms restrict use; see 08 §3). Footnote: "Prism isn't affiliated with or
  endorsed by OpenAI or Anthropic. ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic."
- Help text shows how to get the text out:
  - ChatGPT: Settings → Personalization → Memory → Manage memories (copy), and Custom instructions.
  - Claude: Settings → Memory (copy topics), or ask Claude "Write out your memories of me verbatim".
  - A copyable prompt: "List everything you remember about me as short bullet points: facts, preferences,
    goals. Do not include passwords or financial details."

### 2.2 Export file
- **Import a ChatGPT export (.zip)** / **Import a Claude export (.zip)** — the person requests their own
  export from the provider (ChatGPT: Settings → Data controls → Export data; Claude: Settings → Privacy
  → Export data), downloads the zip (links expire after 24 h), and selects it in Prism.
- Parsing happens **locally** in a Web Worker in the settings page:
  - Zip read with a streaming unzip; only `conversations*.json` and memory/profile-like files are
    read; images/audio skipped. Size limit 1 GB with progress bar and cancel.
  - Streaming JSON parse (exports can exceed 100 MB).
  - ChatGPT: walk the active branch (`current_node` → parents) of each conversation; keep only
    `author.role === "user"` text parts.
  - Claude: keep `sender === "human"` messages; also read memory data if present (Anthropic states
    memory is included in exports; exact filename unverified → detect by content).
  - File names/structures are not hard-coded: detection by shape, tolerant of missing fields.
- Candidate extraction:
  1. Local heuristics select self-descriptive sentences ("I am…", "I live in…", "my mum…", "I prefer…")
     and drop anything resembling secrets (password, PIN, card/bank numbers, tokens) via regex.
  2. Optional AI step: the person sees **exactly** the excerpt to be sent (capped at ~20 KB) and taps
     **Summarise with Prism AI**; Gemini returns `ProfileCandidates { facts: [{field, value,
     evidenceQuote}] }`. Without consent, only the local heuristic list is shown.
- **Review screen:** every candidate fact with its evidence quote, editable value, target field
  dropdown, and Keep / Discard. Nothing is saved until **Save selected**. Raw export content is
  discarded from memory after review.

## 3. Using context
- Each AI request includes only the profile fields relevant to the action (e.g. Translate: languages;
  Define: reading level, age range, goals; Fill out: form details + names; Chat: summary + requested
  fields). The helper prompt states which facts are user-provided and forbids inventing others.
- **Session context** (chat "just for now", helping someone else) lives in `storage.session` per tab
  and overrides profile fields for that tab only. Persistent changes require an explicit **Save to
  About you** confirmation showing the before/after values.

## 4. Data handling
| Data | Where stored | Sent to AI? | Retention |
| --- | --- | --- | --- |
| Profile & people | `chrome.storage.local` (this browser) | Relevant fields per request | Until deleted |
| Imported raw exports | Memory only during import | Only the excerpt the person approves | Discarded after review |
| Tidy plans | `storage.local` (LRU) | — (they are AI output) | Until evicted/cleared |
| Page outline | Memory | Yes, for tidy (no form values) | Not stored |
| Region text/screenshot | Memory | Yes, for that request | Not stored |
| Chat history | `storage.session` per tab | Yes, during the conversation | Cleared when tab closes |
| Settings | `storage.local` | No | Until changed |

- The local helper keeps no logs of payloads by default (only timings and status codes). Debug logging,
  if turned on, redacts profile values and form values.
- Vertex AI: Google states it does not train on customer data; inputs may be cached in memory up to
  24 h per project (can be disabled by a project admin) and may be retained up to 90 days only if
  flagged by abuse classifiers. The global endpoint has no data-residency guarantee. This is shown in
  Settings → Privacy in plain words, with links to Google's pages.
- Settings → Privacy: **See what Prism stores** (readable view), **Export my data** (JSON download),
  **Delete everything** (two-step confirm), per-section delete.
- Passwords/authentication secrets: never read from pages into AI context; never stored; the
  extractor and form-context builder both filter them (unit-tested).

## 5. Settings page structure
1. **Style** — four large previews (live mini-page in each style); default style; per-site overrides list.
2. **Tidying** — when to tidy (only when I click / always on these sites / everywhere), Saved layouts (list, clear one, clear all), Always tidy from scratch. Prism always tucks away as
   much clutter as is safe (no clutter-level setting), for the calmest page.
3. **Pointing** — shortcut choice with live test area ("Try it here"), the keyboard command shortcut
   (with link to the browser's shortcuts page), selection-mode help.
4. **About you** — profile form, people I help, import (paste/file), review & edit.
5. **Language** — Prism's interface language (English in this release; others listed as future),
   translation default.
6. **Reading & accessibility** — modifiers from 03 §5.
7. **Privacy & data** — explanation, export, delete, what is sent where.
8. **Prism helper** — connection status, how to start it, model in use, today's request count.
