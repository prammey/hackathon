# 07 — Implementation milestones and browser verification plan

Status: **Draft for Phase 1 review** · Last updated 2026-10-02
Progress is tracked in `PROGRESS.md` (milestone status + acceptance table with evidence links) so work
can resume after context compaction. Each milestone ends with: automated checks green, real-browser
run with screenshots in `evidence/<milestone>/`, `PROGRESS.md` updated, local commit.

## 1. Milestones

| # | Milestone | Contents | Exit check |
| --- | --- | --- | --- |
| M0 | Foundations | Repo layout, `.gitignore` (incl. `.env`, `dist/`, `.venv/`), TypeScript + esbuild build, helper venv with FastAPI + google-genai, `/health` + one real Gemini call, Playwright harness that loads the built extension in Chrome for Testing, secret-scan script, test fixtures server | `npm run check` (typecheck + unit + build) and `pytest` green; extension loads; helper answers |
| M1 | Prism identity & shell | Logo SVG + icons 16–128, brand tokens, UI kit (button, switch, card, menu, notice), popup (status, Tidy switch, Style picker, Point at something, Settings), settings skeleton, welcome page, helper status | Screenshots of popup/settings/welcome; keyboard pass |
| M2 | Deterministic tidy + restore | Analyzer, Outline, base tidy, four Style stylesheets, journal, **Show original page**, health check + auto-recovery | AC-01 (no-AI part), AC-02 on all fixtures |
| M3 | AI plan, cache, dynamics | `/v1/plan`, schema validation both sides, plan apply, cache with validation, per-site prefs, mutation governor, SPA routes, AI budget | AC-03, AC-04; invalid-plan injection test |
| M4 | Point at something + Define + Translate | Gesture state machine, overlay, menu placement, capture + crop (zoom/DPR), RegionContext, `/v1/assist`, answer cards, alt entry points, context menu, command shortcut | AC-05, AC-06 (Define/Translate), AC-07 |
| M5 | Fill out | Control detection, suggestions with provenance, questions, apply with events, change highlight, Undo, no-submit guard | AC-09 |
| M6 | About you + imports + privacy | Profile UI, people I help, paste import, zip import worker, AI extraction with consent, review screen, export/delete | AC-08 (persistent part) |
| M7 | Chat + workflows | Docked panel, SSE streaming, tool loop, risk classifier, confirmations, Stop, navigation resume, session persona, prompt-injection notice | AC-06 (Chat), AC-08 (override), AC-10 |
| M8 | Hardening & polish | Keyboard/focus audit, zoom 50–200%, reduced motion, error/offline/timeout/429 states, strict-CSP and iframe fixtures, public-page checks, visual polish pass on 4 Styles × 5 fixtures | AC-01, AC-11 |
| M9b | Hosted helper | Dockerfile, Cloud Run deploy (after explicit approval), service account, rate limits + daily cap verified, budget alert, extension default switched to hosted URL | Extension works on a fresh profile with no local helper |
| M9 | Packaging & docs | Release zip of `dist/`, helper start script, install guide for non-technical users, setup guide, `.env.example`, limitations, final acceptance run, secret scan | AC-12; all ACs passed or explicitly blocked with reason |

## 2. Test layers
1. **Unit (Vitest, extension):** pageKey/structureHash normalisation, plan validator (fuzzed invalid
   plans), risk classifier, sensitive-field filter, import parsers (synthetic ChatGPT/Claude exports),
   menu placement math, coordinate/crop conversion.
2. **Unit (pytest, helper):** schemas, prompt assembly (untrusted-content delimiting), Origin check, rate
   limits, model fallback on timeout/429 (with a stubbed transport — labelled as stub).
3. **Extension E2E (Playwright, real loaded extension):** Chrome for Testing 153 (Playwright's
   bundled build; Google-branded Chrome cannot side-load via flags since v137). Headed runs for
   screenshots; headless for fast regression. Extension pages opened by URL
   (`chrome-extension://<id>/popup.html`). Two modes, clearly separated:
   - **Live AI** (default for acceptance): real helper + real Gemini. Records request counts and
     latencies; stored outputs used as evidence.
   - **Fixture AI** (labelled `FIXTURE`): recorded responses replayed by the helper for deterministic
     regression of UI/engine logic. Never counted as acceptance evidence for AI features.
4. **Visual review:** screenshot grid per milestone; I inspect each image and record issues/fixes in
   `PROGRESS.md`.

## 3. Fixtures (local, served from `fixtures/` on 127.0.0.1)
| Fixture | Purpose |
| --- | --- |
| `cluttered-info/` | Council/utility-style info page: mega-nav, cookie banner, promo bars, sidebar link farm, carousel, important deadline notice, legal disclosure |
| `benefits-form/` | Multi-step application: text/select/multi-select/checkbox/radio/date, inline validation, required markers, error summary, submit counter, step 2 on another URL |
| `dynamic-app/` | SPA with client routing, live-updating list, infinite scroll, timer, modal |
| `image-text/` | Notices rendered as images/canvas (English + Spanish), scanned-letter style image |
| `non-english/` | Spanish government-style page with a form |
| `strict-csp/` | `Content-Security-Policy: default-src 'self'` page with form |
| `iframes/` | Same-origin and cross-origin frames incl. an embedded form |

Synthetic persona for tests: "Margaret Ellison, 74, Leeds, UK" with fictional address/phone — never
real personal data.

## 4. Public-page checks (read-only; no forms submitted, no accounts)
- A cluttered public informational site (e.g. a local-news or recipe page with heavy ads).
- A public government information page (e.g. gov.uk or usa.gov article) — checks the "still the
  official site" labelling.
- A non-English public page (e.g. es.wikipedia.org article).
- A public page with text in images (e.g. a poster/infographic page).
Results recorded with screenshots; public sites change, so these are evidence of behaviour on the day,
not regression tests.

## 5. What automated tests cannot prove (manual checks, recorded honestly)
- **OS-level shortcut conflicts** (macOS system shortcuts, input methods): Playwright synthesises key
  events inside the browser, bypassing the OS. Phase 2 will check in-browser conflicts automatically and
  list OS-level checks for a 2-minute manual test in the person's own Chrome.
- Real toolbar-icon click (`activeTab` grant via the action button) and Chrome's permission dialogs
  are not clickable from Playwright; tested by calling the same code paths, plus a manual checklist.
- Screen reader experience: semantic checks automated (roles/names/focus order); a real VoiceOver pass
  is listed as a manual check.

## 6. Definition of done for the product
All AC-01…AC-12 are **passed** with evidence, or **blocked** with the concrete limitation and what was
implemented instead; no placeholder AI responses; install guide followed from scratch on a clean
Chrome for Testing profile succeeds.
