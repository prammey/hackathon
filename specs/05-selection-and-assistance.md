# 05 — Region selection, contextual assistance, workflow automation

Status: **Draft for Phase 1 review** · Last updated 2026-10-02

## 1. "Point at something" — the selection gesture

### 1.1 Default shortcut and alternatives
- **Default:** hold **Alt** (Windows/Linux) / **Option ⌥** (macOS) and drag. Detected in the content
  script via `KeyboardEvent.code` (`AltLeft`/`AltRight`), not `key` (Option changes `key` on macOS).
- Configurable in Settings → Pointing: Alt/Option · Shift+Alt · Ctrl+Shift (Win/Linux) /
  Control+Option (Mac). Cmd and Ctrl-alone are not offered (Cmd swallows keyups on macOS; Ctrl+click is
  right-click on macOS; Ctrl/Cmd+click opens new tabs).
- Known conflicts to **verify on this Mac in Phase 2** (not assumed): Option+click on a link in Chrome
  downloads it (Prism suppresses the click while armed); Option+drag on selected text may start a
  drag-copy; Alt alone on Windows focuses the browser menu (Prism only arms on Alt **with** a pointer
  press, and calls `preventDefault` on that keyup). Results go into `PROGRESS.md`.
- **No-hotkey entry points** (visible, for anyone who struggles with held keys):
  1. Popup button **Point at something** → page enters selection mode: banner "Drag a box around what
     you want help with · Esc to cancel"; a plain drag (no key) draws the box; one selection, then exits.
  2. Prism page tab (edge tab) → same button.
  3. Right-click menu **Ask Prism about this** on selected text or an image (`contextMenus`) → opens the
     action menu with that element as the region.
  4. Keyboard-only: `chrome.commands` shortcut **Alt+Shift+P** (suggested; user-remappable) starts
  selection mode; arrow keys move/resize a default box; Enter confirms.

### 1.2 Gesture state machine
```
idle ──key down──▶ armed (cursor: crosshair, page clicks blocked by a transparent full-viewport
                    catcher in the Shadow root)
armed ──pointerdown──▶ dragging ──pointermove──▶ dragging (draw rect)
dragging ──pointerup──▶ complete   (key may already be released or still held — both fine)
armed ──key up (no drag)──▶ idle
any ──Esc / window blur / visibilitychange / >60 s──▶ idle (overlay removed, nothing sent)
complete ──rect < 8×8 px──▶ idle (treated as an accidental click: nothing happens, no page click)
complete ──▶ menu open
```
- Release order: if the key is released mid-drag, dragging continues until pointerup (natural for
  people who let go of the key early). Completion = pointerup.
- The catcher layer swallows pointer/click/contextmenu events while armed/dragging and uses
  `setPointerCapture`, so the page never receives the click. It also blocks text selection.
- **Iframes:** content script runs in same-origin and permitted frames (`all_frames`); a drag that
  starts in a frame is converted to top-frame coordinates via frame offset messages. Cross-origin
  frames without permission: the top-frame catcher covers them while armed, so selection still works
  visually; DOM text inside them is unavailable → screenshot is used.
- Scrolling during drag: wheel scroll is allowed; the rect is stored in **document** coordinates and
  clipped to the visible viewport at capture time (only what is visible can be captured).
- Zoom/DPR: rect in CSS px; crop scale = `capturedImage.width / window.innerWidth` (covers page zoom
  and devicePixelRatio). Verified at 50/100/150/200% zoom in Phase 2.
- Visuals: translucent fill `--prism-violet-tint`, 2 px solid `--prism-violet` outline + 1 px white
  inner outline (visible on dark and light pages), size label "Selected area", corner handles appear
  after completion so the box can be adjusted before choosing an action.

### 1.3 The action menu
- Exactly four primary actions, as large buttons with icon + word: **Define · Translate · Fill out ·
  Chat**. Secondary small controls: **Adjust area**, **Close (Esc)**.
- Placement: prefers below-right of the rect; flips above/left to stay fully in the viewport; if the rect
  covers most of the screen, the menu docks to the nearest screen edge. Never covers the rect when
  avoidable. Keyboard: focus moves to "Define"; arrows/Tab cycle; Esc closes and returns focus.
- "Fill out" is disabled with explanation "No form fields in this area" if none detected (still
  visible so the set of four is stable).

## 2. Understanding the selected content (shared for all actions)

`RegionContext` built by the content script:
- `domText`: visible text of nodes intersecting the rect (≥ 30% overlap), in reading order, max 6 KB,
  excluding Prism root, `aria-hidden`, offscreen, and password/payment field contents.
- `controls`: form controls inside the rect: `{id, type, label, required, options[] (≤50), current
  state (checked/selected), constraints (pattern/min/max/maxlength), errorText}`. **Text-field values
  are included only for Fill out and only if non-sensitive** (excluded: `type=password`,
  `autocomplete` in {current-password, new-password, one-time-code, cc-*}, fields labelled like card
  number/CVV/PIN/SSN).
- `images`: count and alt text of images/canvas/video in rect.
- `pageInfo`: title, origin, Prism's pagePurpose, language.
- `screenshot`: cropped PNG/JPEG of the rect, captured with Prism overlay hidden (overlay set to
  `visibility:hidden`, two animation frames, capture, restore; ≤ 2 captures/s per Chrome limit). Sent
  when the rect contains images/canvas/video, when `domText` is short (< 40 chars) or for Chat "include
  screen". Resolution: crop ≤ 1600 px long edge; `mediaResolution` HIGH for Translate/Define of image
  text, MEDIUM otherwise.
- Failure modes → friendly fallback: capture blocked (restricted page or missing permission) → "Prism
  can't take a picture of this page. Here's what it could read from the text instead." + offer
  "Allow Prism on this site"; no text and no picture → explain and suggest selecting a smaller area or
  copying the text into Chat.

## 3. Define
- Output schema `DefineAnswer { summary (≤ 2 sentences), explanation (plain-language, ≤ 120 words),
  terms: [{term, meaning}] (≤ 6), whatToDoHere?: string, uncertain: string[] }`.
- Reading level target: about age 12 (Settings → "Explain things: simply / normally / in detail").
- Uses profile only where relevant (language, reading preference, stated goals). Never states facts
  about the person that were not provided.
- Card: title "What this means", body, terms list, "What you can do here" box, buttons **Explain more
  simply**, **Ask a follow-up** (opens Chat with context), **Copy**, **Close**. Label "Prism's
  explanation — not the website's words".

## 4. Translate
- Destination: profile language by default; dropdown in the card to change (remembered per site).
- Output `TranslateAnswer { sourceLanguage, lines: [{source, translation, unclear: bool, note?}],
  preserved: [names/numbers kept as-is] }`. Unclear source → `[unclear]` + note, never guessed.
- Card shows side-by-side (wide) or stacked pairs (narrow); toggle "Show original" per line; **Read
  aloud** uses the browser's `speechSynthesis` (local) if available.
- Text inside images: screenshot path (verified in Phase 1: Spanish image → correct English, 3.5 s).

## 5. Fill out
1. Detect controls in the region (text, textarea, select, multi-select, checkbox, radio group, date,
   number, email, tel). Unsupported/protected: file inputs, password, payment card, captcha, signature
   pads, cross-origin frames → explained, not filled.
2. AI returns `FillAnswer { fields: [{ id, explanation, suggestion?: {value | optionValues[] | checked},
   source: enum(profile|session-context|page|inference), evidenceQuote?: string, confidence:
   enum(high|medium|low) }], questions: [{ fieldId, question }] }`.
   - Suggestions with `source=inference` are labelled "Prism's guess — please check" and are **not
     pre-ticked** for applying. `profile`/`session-context` suggestions show which fact they came from.
   - Missing facts → questions; the person can answer inline ("Answer just for now" vs "Save to About
     you").
3. Review card lists each field with a checkbox (pre-ticked only for profile/session sources), the
   proposed value and why.
4. **Put these answers in** applies ticked items: focus → set via native value setter → dispatch
   `input` + `change` (+ `blur` for validation) → for selects set `selected` + `change`; for radios/
   checkboxes `.click()` only if state must change (respects the site's handlers). Each field briefly
   outlined in Prism violet with a "Changed by Prism" tag; summary "4 fields filled. The form has not
   been sent."
5. **Undo** restores recorded previous values with the same event sequence.
6. Submit buttons are never clicked by Fill out. A guard asserts no `submit` event fired during apply
   (verified with a fixture submit counter).

## 6. Chat and bounded workflow automation

### 6.1 Panel
- Docked in-page panel (Shadow DOM), right side by default, 380–480 px, resizable, keyboard reachable
  (**Alt+Shift+C** command to focus). Header: Prism logo, "Chat about: Selected area" chip (with
  thumbnail), toggle **Include the whole screen**, **Stop** button (visible whenever Prism is acting),
  **Close**.
- Conversation memory is per tab (`storage.session`), cleared on tab close; not stored long-term.

### 6.2 Action loop
Allowed tool set (function calling, mode `VALIDATED`, `allowed_function_names` enforced):
`click(id)`, `type(id, text)`, `select(id, values[])`, `check(id, checked)`, `scroll(to: id|up|down)`,
`navigate(url)` (same-site, or a link present on the page), `wait(ms ≤ 3000)`, `read_page()`
(returns fresh Outline delta), `ask_user(question)`, `finish(summary)`.

Loop: plan shown as numbered steps → for each model action: **validate** (element exists, visible,
enabled, inside current page, action type matches element) → **classify risk** → execute → wait for
settle (network idle via mutation quiet 500 ms, or navigation complete) → observe (Outline delta,
validation errors, URL) → send result to model → next.

Risk classification (deterministic first, model's opinion second; the stricter wins):
- **Consequential → confirm:** clicking a submit button / `form.requestSubmit`, buttons or links whose
  name matches pay|buy|purchase|order|checkout|confirm|submit|send|delete|remove|cancel
  subscription|sign|agree|accept|apply|transfer|book, navigation to another site, any action on a page
  with payment fields. Confirmation card shows the concrete action ("Press **Submit application** on
  gov.example") with **Yes, do it** / **No, stop here**.
- **Routine → proceed (visible):** typing into fields, choosing options, scrolling, following ordinary
  links within the site, opening disclosures.
- **Never:** entering passwords or payment details, solving CAPTCHAs, downloading files, changing
  account security settings. Prism tells the person to do these themselves and waits.

Limits: max 20 actions per request, 10 minutes, 3 consecutive failures → stop and explain. **Stop**
cancels the pending model call (AbortController) and prevents the next action; verified to halt
within one step. Navigation: loop state in `storage.session`; the content script on the new page
reconnects and resumes after the page settles (or reports if the new page is restricted).

Prompt-injection policy: page text is passed as quoted untrusted data with a fixed preamble; the
model's tool calls are checked against the user's stated goal and the policy above in code. If page
text appears to instruct Prism ("ignore previous instructions", "send your data to…"), Prism shows
"This page contains instructions aimed at assistants. Prism ignored them." and continues the user's goal.

### 6.3 "Helping someone else" / temporary context
- Chat recognises statements like "I'm filling this in for my dad" and the explicit chip **Helping
  someone else** → creates a **session persona** (`storage.session`, per tab) used instead of the saved
  profile for this conversation. Banner: "Using Joan's details just for now. Your saved profile is
  unchanged." Offer: **Save as a person in About you** (explicit, never automatic).
