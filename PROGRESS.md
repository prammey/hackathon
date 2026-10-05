# Prism — progress tracker

Read this first when resuming work. Specs in `specs/` are the source of truth; implementation changes
are recorded in `specs/02-architecture.md` §9.

## Current state (2026-10-04)
- **v1.0.0.** Post-hackathon product release: Guide me, Read aloud, 12 interface languages, light touch
  vs full makeover, five-section Settings, minified release build.
- Online service: https://prism-helper-677745474657.us-central1.run.app (`/health`, `/demo/`).
- Website and download: https://prism-helper.vercel.app (`release/Prism.zip`).
- Test commands and evidence locations: see README → For developers. Guide me on real sites:
  `node tools/guide-run.mjs <tasks.json> <outDir>`; design review screenshots: `tools/review-scan.mjs`.

## Milestones
| # | Milestone | Status |
| --- | --- | --- |
| M0 | Foundations (build, helper, harness, fixtures, secret scan) | done |
| M1 | Prism identity & shell (logo, icons, UI kit, popup, settings, welcome) | done |
| M2 | Deterministic tidy + restore | done |
| M3 | AI plan, cache, dynamic pages, SPA routes | done |
| M4 | Point at something + Define + Translate (DOM + OCR) | done |
| M5 | Fill out (provenance, apply, undo, no submit) | done |
| M6 | About you + imports + privacy controls | done |
| M7 | Chat + bounded workflows + confirmations + Stop | done |
| M8 | Hardening & polish (a11y, zoom, motion, errors, CSP, public sites) | done |
| M9b | Hosted helper on Cloud Run | done |
| M9 | Packaging & docs | done |

## Acceptance criteria
Evidence = Playwright test in `tests/e2e/` run against the real unpacked extension in Chrome for Testing
153 with live Gemini responses, plus screenshots in `evidence/e2e/`. Final full-suite result:
[`evidence/e2e/final-run-summary.txt`](evidence/e2e/final-run-summary.txt) — 40/41 on the final build; the one
failure was the public-site test's paragraph picker (an animated Wikipedia element), fixed and re-run green.

| ID | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| AC-01 | Four Styles distinct & usable | **passed** | `tidy.spec` (screens `cluttered-01-{clear,bold,calm,soft}.png`); `a11y.spec` contrast + target-size audits per Style (0 failures); `scripts/contrast_check.py` 43/43 |
| AC-02 | Tidy preserves behaviour; restore exact | **passed** | `tidy.spec` (DOM identical after restore); `dynamic.spec` (SPA form works after tidy); `public.spec` (gov.uk, weather.gov, es.wikipedia: zero Prism attributes after restore) |
| AC-03 | Cached reload, zero AI calls | **passed** | `tidy.spec` "cached layout" (helper call count unchanged, identical roles); `dynamic.spec` route back → `cached` |
| AC-04 | Dynamic content stable | **passed** | `dynamic.spec`: 20 s of live feed → 0 AI calls, re-analysis ≤ insertions; route change → exactly 1 plan |
| AC-05 | Region selection gesture | **passed** | `assist.spec`: Alt+drag, key released first, Esc mid-drag, tiny drag ignored, page received 0 clicks, edge placement, 150% zoom; `a11y.spec` keyboard mode; popup/no-hotkey entry |
| AC-06 | Define, Translate, Fill out, Chat end to end | **passed** | `assist.spec`, `chat.spec`, `pages.spec` (hosted service through the extension) |
| AC-07 | Image text + page text understood | **passed** | `assist.spec` OCR translate (`assist-03-translate-image.png`), poster define, Spanish DOM translate; `extra.spec` whole-screen chat |
| AC-08 | Context entered, imported, reviewed, overridden | **passed** | `pages.spec`: About you saved; paste import (secrets dropped); ChatGPT .zip + Claude .json local parsing (user messages only) + AI tidy; "helping someone else" leaves profile unchanged and drives Fill out |
| AC-09 | Form suggestions apply; no submission; undo | **passed** | `assist.spec` Fill out: text/date/select/radio/checkbox/multi-select applied with real events (site state updated), 0 submits, password untouched, Undo restores |
| AC-10 | Bounded chat workflow + cancel | **passed** | `chat.spec`: dynamic-app report with confirmation; two-page application across navigation; asks person to type password; declaration + submit need OK; declining sends nothing (server 0 submissions); Stop halts; prompt injection ignored |
| AC-11 | Keyboard, zoom, reduced motion, error recovery | **passed** | `a11y.spec`: keyboard selection + menu + Esc focus return; popup Tab/Space; reduced motion 0 s transitions; 200% zoom no sideways scroll; AI down → basic tidy + clear error + Try again; strict CSP; `dynamic.spec` hostile plan rejected |
| AC-12 | No secrets in bundle/repo | **passed** | `node scripts/secret-scan.mjs` (repo + `extension/dist*`); no key files exist (ADC locally, service account on Cloud Run) |

## Manual checks still recommended (automation can't do these)
- Real toolbar-button click and Chrome's install/permission dialogs in your own Chrome ("Load unpacked").
- macOS system-level shortcut conflicts for Option+drag (in-browser behaviour is automated).
- A VoiceOver pass over the popup, menu and chat (semantics are tested; speech output isn't).

## Log
- 2026-10-02 — Phase 1: gcloud, ADC, Vertex AI verified; Playwright loads unpacked extensions; specs 01–08.
- 2026-10-03 — Phase 2: M0–M9 built and verified; helper deployed to Cloud Run; plan model switched to
  gemini-3.7-flash after latency measurements; public-site checks (timeanddate.com showed a bot check and
  was replaced by weather.gov — Prism never tries to get past bot checks).
- 2026-10-03 — Reliability: gemini-3.8-flash intermittently returned 504/499 during testing; the helper now
  falls back 3.8 → 3.7 → 3.5-lite with 15 s per attempt. Stop cancels in-flight actions; Esc race fixed.
  Final run: 40/41 + fixed re-run; Vitest 12/12; pytest 7/7; contrast 43/43; secret scan clean.
- 2026-10-03 — v0.3.0 from user feedback: contrast-repair pass + whole-page contrast audits (dark-theme and
  state-portal trap fixtures, all Styles, 0 failures); calmer Neo-Brutalist palette (no yellow overload,
  no overlapping shadows on inline links); clutter hidden instead of faded; hero primary action + Next-step
  bar; word-level selection with surrounding context (Define/Chat explain exactly the selected words);
  markdown-free answers. Fixed id instability that caused extra AI plans on live pages. Regression: 40 passed,
  2 skipped (ilsos.gov and arngren.net unreachable from this network).
- 2026-10-03 — v0.3.1: removed disclaimer copy; visited-link colour rules (white-on-white on berkshirehathaway.com
  reproduced, fixed, verified 12/12 runs incl. pixel checks); main action always wins over secondary styling;
  popup switch updates instantly and stays in sync. Full suite: 57 passed, 2 skipped (unreachable sites).
- 2026-10-03 — v0.4.0: next step always has a breathing ring (no click needed); welcome page gains the
  Refresh hint, a "Never lose your place" section and 14 real demo websites (screened from 85+ important,
  hard-to-use sites with before/after screenshots). Clutter setting removed: Prism always tidies as calmly as
  is safe. Real-site fixes: logos no longer blow up, searches/slideshow arrows/cookie buttons/menu items are
  never the next step, menus keep their own shape, icon-only buttons stay visible, text over photos/video
  stays readable, no boxes-in-boxes in headers, no orphan bullets or picture-only leftovers after folding,
  quieter outlines, dark table rows fixed (contrast flake). Helper redeployed (planner prompt).
- 2026-10-03 — v0.5.0: dictation everywhere (microphone allowed once on Prism's page; recorded in an
  offscreen page, written down by Gemini via /v1/transcribe; Talk buttons in Chat, the next-step box, Fill
  out, Settings and beside any of the website's own text boxes — never password/card/ID fields). Next-step
  dock gains "More" (up to 4 other things to do, each with Show me) and "What do you want to do next?",
  which hands the goal to Chat. Chat can now *emphasize* page parts (new emphasize/clear_emphasis tools:
  bigger, bold, highlighted, breathing outline; works tidied or not; Clear highlights). Settings simplified
  to four sections (How pages look + text size, Talking instead of typing, Your language, About you basics)
  with everything else under "More settings". Helper redeployed.
- 2026-10-04 — v1.0.0: Guide me (spotlight; the person does every action; caution only on final presses;
  follows new tabs; re-plans when the page changes or redraws; dropdown lists and search suggestions stay
  usable; replies in the person's language). Read aloud (chrome.tts). 12 interface languages with a
  first-run picker and right-to-left Arabic. "Never make a site worse": well-designed sites get a light
  touch (bigger text, darker faint text, ads hidden, next step highlighted), old/chaotic pages the full
  makeover; two design-review rounds over ~50 real sites. Real-site Guide me runs: CA DMV home → appointment
  time (11 steps, stops at Confirm); MS Medicaid into the application form (12 steps); usa.gov in Spanish;
  weather.com from a blank tab (done); Amazon scarf into the basket (done). Full suite 76 tests (one flaky
  settings test fixed); Vitest 25/25; pytest 10/10.
