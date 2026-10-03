# Prism — progress tracker

Read this first when resuming work. Specs in `specs/` are the source of truth; implementation changes
are recorded in `specs/02-architecture.md` §9.

## Current state (2026-10-03)
- **Phase 2 complete.** All milestones implemented and verified; online helper deployed.
- Online service: https://prism-helper-677745474657.us-central1.run.app (`/health`, `/demo/`).
- Release zip: `npm run package` → `release/prism-extension-v0.1.0.zip`.
- Test commands and evidence locations: see README → For developers.

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
