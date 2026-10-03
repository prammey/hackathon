# Verification evidence

Everything here was produced by automated runs of the **real, unpacked Prism extension** loaded into
Chrome for Testing 153 (Playwright's Chromium), talking to the real Prism helper and Gemini on Vertex AI.
No AI responses are mocked. All personal data is synthetic.

| Folder / file | What it shows |
| --- | --- |
| `phase1/` | Phase 1 feasibility probe: a tiny extension loaded and driven (gesture, capture, popup); the OCR test image |
| `e2e/cluttered-00-original.png` → `cluttered-01-*.png` → `cluttered-02-restored.png` | A cluttered page before, in all four Styles, and restored |
| `e2e/assist-*.png` | Selection menu, Define, Translate (image OCR and page text), 150% zoom, Fill out before/after |
| `e2e/chat-*.png` | Chat workflows: confirmation cards, asking the person to type a password, declining submit, Stop, ignored prompt injection, whole-screen question |
| `e2e/popup-*.png`, `settings-*.png`, `welcome-01.png`, `import-*.png` | Extension pages |
| `e2e/a11y-*.png` | Keyboard-only menu, 200% zoom, AI-offline error, strict-CSP page |
| `e2e/dynamic-*.png` | Live-updating app after 20 s; SPA route change |
| `e2e/public-*.png` | Read-only runs on gov.uk, weather.gov and es.wikipedia.org (original / tidied / help card) |
| `e2e/hosted-01-define.png` | Define answered by the online Cloud Run service |
| `e2e/synthetic-*` | Synthetic ChatGPT/Claude export files used by the import tests |
| `e2e/results.json` | Machine-readable results of the latest Playwright run (git-ignored; regenerate with `npx playwright test`) |
