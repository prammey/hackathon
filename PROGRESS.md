# Prism — progress tracker

Read this first when resuming work. Specs in `specs/` are the source of truth.

## Current state
- **Phase:** 1 complete; Q1–Q3 answered 2026-10-02 (cache on; hosted helper preferred; packages,
  fonts, commits approved; GitHub `prammey/hackathon`). Awaiting explicit Phase 2 go-ahead and
  approval to deploy the hosted helper (M9b).
- **Next step after go-ahead:** M0 Foundations.

## Milestones
| # | Milestone | Status |
| --- | --- | --- |
| M0 | Foundations | not started |
| M1 | Prism identity & shell | not started |
| M2 | Deterministic tidy + restore | not started |
| M3 | AI plan, cache, dynamics | not started |
| M4 | Point at something + Define + Translate | not started |
| M5 | Fill out | not started |
| M6 | About you + imports + privacy | not started |
| M7 | Chat + workflows | not started |
| M8 | Hardening & polish | not started |
| M9b | Hosted helper (Cloud Run) | not started — needs deploy approval |
| M9 | Packaging & docs | not started |

## Acceptance criteria (from specs/01-product.md §5)
| ID | Status | Evidence |
| --- | --- | --- |
| AC-01 Four Styles distinct & usable | pending | — |
| AC-02 Tidy preserves behaviour; restore exact | pending | — |
| AC-03 Cached reload, zero AI calls | pending | — |
| AC-04 Dynamic content stable | pending | — |
| AC-05 Region selection gesture | pending | Phase 1 probe: Alt+drag captured, click suppressed (`evidence/phase1/`) |
| AC-06 Four actions end to end | pending | — |
| AC-07 Image text + page text understood | pending | Phase 1: Gemini OCR+translate on image OK (`evidence/phase1/ocr-test-image.png`) |
| AC-08 Context enter/import/review/override | pending | — |
| AC-09 Form suggestions, no submission, undo | pending | — |
| AC-10 Bounded chat workflow + cancel | pending | — |
| AC-11 Keyboard, zoom, reduced motion, recovery | pending | — |
| AC-12 No secrets in bundle/repo | pending | — |

## Log
- 2026-10-02 — Phase 1: installed gcloud, ADC sign-in, Vertex AI enabled, Gemini 3.8 Flash verified
  (text, image OCR, JSON schema, function calling, streaming). Playwright + Chrome for Testing loads a
  real unpacked extension (headless + headed). Specs 01–08 written. Contrast check: 43/43 pass.
