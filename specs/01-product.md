# 01 — Product: goals, journeys, acceptance criteria

Status: **Draft for Phase 1 review** · Last updated 2026-10-02

## 1. Product statement

Prism is a browser extension that makes confusing websites calm, readable and easy to use, without
breaking them. It restyles the live page, explains anything the person points at, helps fill in forms
using what it knows about them, and can carry out a requested task step by step while asking before
anything consequential.

Primary persona: **Margaret, 74** — uses a laptop for email, her pension portal and video calls; reads
with glasses at 125–150% zoom; is anxious about "pressing the wrong thing"; does not know what a
"modal", "dropdown" or "hotkey" is. Secondary personas: **Dev, 31**, a busy professional who wants
cluttered sites to be pleasant and fast; **Ana, 45**, a recent immigrant reading government pages in
her second language; **Sam, 52**, helping a parent apply for benefits remotely.

## 2. Goals and non-goals

Goals
- G1. Any ordinary website becomes clearer: hierarchy, spacing, readable text, obvious next steps.
- G2. The website keeps working: links, forms, validation, navigation, scripts and state are preserved.
- G3. Every change is reversible in one obvious click; the original page is always one step away.
- G4. Pointing at anything (text, image, form) gives a plain-language answer in seconds.
- G5. Help is personal when the person chooses to share context, and private by default.
- G6. Four distinct, high-quality visual styles; accessibility beats stylistic purity.
- G7. Nothing consequential (submit, pay, delete, send) happens without explicit confirmation.

Non-goals (this release)
- Replacing a website with a generated copy, or running AI-generated JavaScript.
- Working on browser-internal pages, the Chrome Web Store, or the built-in PDF viewer (blocked by the
  browser; see 02-architecture §6).
- Reading a person's ChatGPT/Claude accounts directly (no such official API exists; see 06).
- Mobile browsers and Safari.

## 3. Plain-language vocabulary (used in all UI copy)

| Instead of… | Prism says… |
| --- | --- |
| Enable transformation | **Tidy this page** |
| Restore original / revert DOM | **Show original page** |
| Regenerate plan | **Tidy again from scratch** |
| Aesthetic preset | **Style** |
| Region selection / hotkey | **Point at something** · "Hold **Alt** and drag" (Mac: "Hold **Option** and drag") |
| Context / profile | **About you** |
| Session override | **Just for now** |
| Autofill | **Suggest answers** → **Put these answers in** |
| Agentic action loop | **Do it for me, step by step** |

## 4. User journeys

J1 — First run (≤ 60 seconds, no profile required)
1. Install → a welcome tab opens: one sentence on what Prism does, a large **Try it on this sample
   page** button, and "You don't need to set anything up."
2. Prism asks for permission to work on websites (browser dialog, explained beforehand in plain words
   with the two choices: *only when I click Prism* vs *on all websites*).
3. Optional: choose a Style from four large previews; optional: "Tell Prism about you" (skippable).

J2 — Tidy a cluttered page
1. Click the Prism toolbar icon → popup shows the site name, a big **Tidy this page** switch, the Style
   picker, **Point at something**, and **Settings**.
2. Turn on → within ~1 s a deterministic base tidy applies (typography, spacing, contrast); within a
   few seconds the AI plan refines hierarchy, highlights the main action, folds clutter into labelled
   "Show more" sections. A small Prism tab on the page edge shows status and **Show original page**.
3. The person keeps using the site; reloading the page restores the same layout instantly from cache.

J3 — "What does this mean?" (Define)
1. Hold Alt/Option, drag a box around a confusing paragraph, release → compact menu with
   **Define · Translate · Fill out · Chat**.
2. Define → a card near the box explains in simple language what it means and what to do next here.

J4 — Read a foreign-language page or image (Translate)
1. Drag a box over a Spanish notice (text or picture). Translate → line-by-line translation into the
   person's language; names/numbers preserved; unclear words marked "[unclear]".

J5 — Fill in a form with help (Fill out)
1. Drag over a form section → Fill out → each field explained; suggestions shown with their source
   ("From About you" vs "Prism's guess — please check"); missing facts asked as questions.
2. **Put these answers in** fills the real fields; changed fields are outlined; **Undo** is available.
   The form is never submitted by this action.

J6 — Do a task step by step (Chat)
1. Chat → panel opens with the selected area attached; optional "Include the whole screen".
2. "Help me find my council and report a missed bin collection" → Prism shows its plan, performs
   navigation and typing steps visibly, and stops at "Ready to press **Submit report**? [Yes, press it]
   [No, stop]". **Stop** is always visible.

J7 — Helping someone else
1. In chat: "I'm filling this in for my mum, Joan, she's 81" → Prism confirms "Just for now, I'll use
   Joan's details for this conversation. Your saved profile won't change." with **Save Joan as a person**
   offered but never automatic.

J8 — Restore and recover
1. Popup **Show original page** removes every Prism change. If a tidy fails or looks wrong:
   **Tidy again from scratch** or **Turn off for this site**. A failed plan never leaves the page broken.

## 5. Acceptance criteria

Each criterion is tracked in `PROGRESS.md` as **passed / failed / blocked** with evidence (screenshot
path, test name, log excerpt). "Verified" means exercised in a real loaded extension in Chromium.

| ID | Criterion | Evidence required |
| --- | --- | --- |
| AC-01 | All four Styles render distinctly on each fixture and remain usable (keyboard, contrast ≥ 4.5:1 body text, ≥ 3:1 UI boundaries, targets ≥ 24×24 CSS px, ideally 44) | Screenshot grid 4 styles × 5 fixtures; automated contrast/target audit |
| AC-02 | Tidy preserves links, buttons, form validation, navigation, SPA routing; **Show original page** restores a DOM/style snapshot equal to pre-tidy (minus Prism root) | Playwright: interact before/after, DOM diff check |
| AC-03 | Reloading an unchanged page re-applies the cached plan with **zero** AI calls and identical layout | Backend call counter = 0 on reload; screenshot diff below threshold |
| AC-04 | Dynamic content (infinite list, live clock, SPA route change) causes no repeated AI calls for minor changes, no mutation loop, no visible flicker | Mutation/AI-call counters over 60 s; video or frame screenshots |
| AC-05 | Region selection: hold key + drag draws overlay; works with either release order; Esc cancels; underlying page receives no click; works near edges, while scrolled, at 50–200% zoom; alternative entry point without a hotkey | Playwright gesture tests incl. zoom; screenshots |
| AC-06 | Define, Translate, Fill out, Chat each work end to end with real Gemini responses | Logged backend responses (no mocks) + screenshots |
| AC-07 | Text embedded in images and ordinary DOM text are both understood (Define + Translate) | Image fixture + text fixture results |
| AC-08 | Personal context can be typed, pasted, imported from a ChatGPT/Claude export file, previewed, edited, saved, exported, deleted; chat "just for now" override does not modify saved profile | Playwright flows + storage inspection |
| AC-09 | Fill-out suggestions apply to text, select, checkbox, radio, multi-select controls; site validation reacts; **no submission** occurs; Undo restores previous values | Fixture form with submit counter = 0 |
| AC-10 | Chat performs a bounded multi-step workflow across a navigation; asks before the consequential action; **Stop** halts within one step | Fixture workflow log + screenshots |
| AC-11 | Keyboard-only use of popup, settings, menu, chat; visible focus; reduced-motion respected; usable at 200% zoom; recovery from backend offline, timeouts, invalid AI output, restricted pages | Playwright keyboard tests, emulated reduced motion, error-injection tests |
| AC-12 | No secrets in the extension bundle or repository | Secret scan of `dist/` and git history; manifest review |

## 6. Success measures (qualitative, checked during Phase 2 review)
- A first-time user can tidy a page and get back to the original without reading instructions.
- Every Prism surface is recognisably Prism (logo, colours, voice) in all four Styles.
- No AI-generated text claims to be the website's or a government's official wording.
