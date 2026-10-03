# 02 — Architecture, compatibility, permissions, AI integration, data flows

Status: **Implemented** (Phase 2) · Last updated 2026-10-03 — see *Changes during implementation* at the end
Sources: Chrome extension docs (developer.chrome.com/docs/extensions), MDN WebExtensions, Playwright
extension testing docs, Vertex AI docs; plus capability probes run on this machine (see 08 §1).
Items marked **[verify]** were not confirmed by official docs and get a Phase 2 test.

## 1. Shape of the system

```
┌──────────────────────────── Browser (Chromium MV3) ─────────────────────────────┐
│                                                                                  │
│  Popup ──┐        Options/Settings page        Welcome/onboarding page           │
│          │                 │                              │                      │
│          ▼                 ▼                              ▼                      │
│   ┌────────────────── Service worker (background) ───────────────────┐           │
│   │ router · permission manager · plan cache · AI client · action-loop│           │
│   │ state (storage.session) · screenshot crop (OffscreenCanvas)       │           │
│   └───────▲──────────────────────────▲─────────────────────▲─────────┘           │
│           │ runtime messages/ports    │ fetch (Origin check) │                     │
│  ┌────────┴────────── Content script (per page, isolated world) ───────┐          │
│  │ page analyzer → outline · tidy engine (attrs + 1 stylesheet) ·      │          │
│  │ mutation governor · selection overlay · menu/cards/chat panel       │          │
│  │ (all Prism UI in one closed Shadow DOM root) · action executor      │          │
│  └─────────────────────────────────────────────────────────────────────┘          │
└───────────────────────────────────────────┬──────────────────────────────────────┘
                                            │ http://127.0.0.1:8787 (JSON, SSE)
                          ┌─────────────────▼─────────────────┐
                          │ Prism helper (local backend)       │
                          │ Python · FastAPI · google-genai    │
                          │ schema validation (pydantic)       │
                          │ Application Default Credentials    │
                          └─────────────────┬─────────────────┘
                                            │ HTTPS (Google auth)
                                   Vertex AI · Gemini (global endpoint)
```

Why this shape: it is the simplest arrangement that keeps Google credentials off the extension, works
on every ordinary site, and avoids running remote code. The backend is thin: prompt templates,
model routing, schema validation, rate limiting. All page manipulation is deterministic code
shipped in the extension.

## 2. Components

### 2.1 Extension (TypeScript, Manifest V3)
- **Build:** TypeScript compiled with esbuild into `extension/dist/` (no framework needed for the
  content script). Extension pages (popup, settings, welcome) use Preact for small, typed UI.
- **Service worker** (`src/background/`): message router; permission manager; plan cache
  (`chrome.storage.local`, LRU); AI client to the helper; per-tab state in `chrome.storage.session`;
  screenshot capture via `chrome.tabs.captureVisibleTab` and crop with `OffscreenCanvas`; action-loop
  coordinator that survives page navigations.
- **Content script** (`src/content/`): analyzer, tidy engine, mutation governor, selection overlay,
  menu/answer cards, chat panel, action executor. All Prism UI lives in one closed Shadow DOM host
  (`<prism-root>`) with constructable stylesheets, so page CSS cannot leak in and Prism CSS cannot leak
  out. Fonts are embedded as data URLs (nothing web-accessible, no fingerprinting surface).
- **Popup** (`src/popup/`), **Settings** (`src/options/`), **Welcome** (`src/welcome/`).
- **Chat surface decision:** the chat panel is docked **inside the page** (Shadow DOM), not
  `chrome.sidePanel`. Reasons: (a) it opens directly from the in-page selection menu without the
  side panel's user-gesture relay risk; (b) it sits next to the selected area and can point at elements;
  (c) side panel `captureVisibleTab` with `activeTab` is reported unreliable. The panel can be docked
  left/right and resized; it follows the person across navigations within a workflow.

### 2.2 Prism helper (local backend)
- Python 3.10+ in a project virtualenv; FastAPI + uvicorn bound to **127.0.0.1:8787 only**.
- `google-genai` SDK with `vertexai=True`, using ADC (`~/.config/gcloud/application_default_credentials.json`
  created by `gcloud auth application-default login`). No key files, nothing secret in the repo.
- Endpoints: `GET /health`, `POST /v1/plan` (tidy plan), `POST /v1/assist` (define/translate/fill),
  `POST /v1/chat` (SSE stream; action-loop turn), `POST /v1/import/extract` (profile facts from
  pasted/exported text).
- **Caller check:** only requests whose `Origin` is `chrome-extension://<Prism ID>` are accepted (the
  ID is fixed by a public `key` in the manifest). Web pages cannot forge `Origin`; Chrome's Local Network
  Access rules additionally block public sites from reaching localhost. Per-minute and per-day request
  caps protect the person's Google credits.
- **Two deployment modes, same code** (decided 2026-10-02, see 08 §3): **Hosted** on Cloud Run
  (`us-central1`, attached service account with only `roles/aiplatform.user`, no key files) so judges
  need no setup; **On this computer** on `127.0.0.1:8787` with ADC for development. On the public URL
  the Origin check is not trusted alone: per-install and per-IP rate limits, a global daily cap,
  payload limits, max 2 instances and a budget alert protect the credits.
- Starts with one command (`./prism-helper start`); optional macOS login item in Phase 2 for
  non-technical use. Status shown in the popup ("Prism helper: connected").

## 3. Browser compatibility

| Browser | Status in this release |
| --- | --- |
| Google Chrome (current stable) | **Target.** Install via "Load unpacked" (developer mode) or packaged zip. |
| Chromium / Chrome for Testing 153 | **Automated verification target** (Playwright). Google-branded Chrome removed `--load-extension` in Chrome 137, so automation uses Playwright's bundled Chrome for Testing. |
| Microsoft Edge, Brave | Expected to work (same MV3 APIs); **not verified** — not installed on this machine. |
| Firefox | **Not supported in this release.** Needs `background.scripts`, `sidebarAction`, and different host-permission UX; documented as follow-up. |
| Safari, mobile | Out of scope. |

## 4. Permissions (least privilege)

Manifest `permissions`: `storage`, `activeTab`, `scripting`, `contextMenus`, `unlimitedStorage`
(plan cache + imported context; bounded by our own LRU).
Manifest `optional_host_permissions`: `https://*/*`, `http://*/*`.
Manifest `host_permissions`: `http://127.0.0.1:8787/*` (the helper only).

Access modes, explained to the person on the welcome page:
1. **Only when I click Prism** (default, no broad access): toolbar click grants `activeTab` for that
   tab; Prism injects its content script and can tidy, select and capture *on that page until it is
   left*. The hold-and-drag hotkey works after the first click on that page.
2. **Always on for this site**: `permissions.request({origins:[site]})` from a button (user gesture);
   Prism registers its content script for that origin, so cached tidy re-applies on reload and the
   hotkey works immediately.
3. **Always on for every website**: request `https://*/*, http://*/*`; hotkey and auto-tidy everywhere.

`captureVisibleTab` requires `activeTab` or all-sites access per docs; whether a single-site grant is
enough is **[verify]**; if not, Prism asks for a one-time toolbar click or all-sites access with a clear
explanation. `debugger` is **not** used (cannot be optional, alarming warning and infobar).

## 5. AI integration (verified on this machine — see 08 §1)

| Use | Model (Vertex, location `global`) | Settings | Measured |
| --- | --- | --- | --- |
| Tidy plan | `gemini-3.8-flash` | JSON schema output, `thinkingLevel: LOW` | structured output OK |
| Define / Translate / Fill out (text + image) | `gemini-3.8-flash` | JSON schema, image inline, LOW | OCR+translate 3.5 s |
| Chat + action loop | `gemini-3.8-flash` | function calling, SSE streaming, LOW | tool call 1.8 s |
| Fast fallback (timeouts, 429) | `gemini-3.5-flash-lite` | no thinking | ~0.8 s |
| Profile extraction from imports | `gemini-3.8-flash` | JSON schema, LOW | — |

Rules
- `thinkingLevel: LOW` always set (default thinking measured 3.5–5.5 s and one 41.6 s outlier;
  `MINIMAL` is rejected by this model). Timeouts: 20 s non-streaming, first SSE byte ≤ 15 s; one retry
  on the fallback model with exponential backoff on HTTP 429.
- Every response is validated twice: pydantic on the helper, a matching validator in the extension
  before anything touches the page. Invalid → one repair attempt → safe failure message.
- Prompts carry page content inside a clearly delimited **untrusted** block; policies (what actions are
  allowed, when to confirm) are enforced in extension code, never trusted to the model.
- Gemini's own "Computer Use" tool is **not** used: our bounded action schema on DOM element ids is
  smaller, auditable, and works without screenshots of every step.

## 6. Unsupported or degraded surfaces (shown to the person as friendly messages)

| Surface | Behaviour |
| --- | --- |
| `chrome://` pages, new tab, Chrome Web Store, other extensions | "Prism can't change this page — the browser protects it." Popup still opens Settings. |
| Built-in PDF viewer, view-source | Same message; region capture may still work via toolbar click **[verify]**. |
| `file://` pages | Works only if "Allow access to file URLs" is on; popup explains how. |
| Cross-origin iframes (e.g. embedded payment forms) | Tidy styles the frame box, not its inside; Fill out explains but cannot fill fields inside protected frames unless Prism has access to that frame's site. |
| Closed shadow DOM components | Styled at their boundary only; contents described via screenshot. |
| Canvas/WebGL apps (maps, editors) | Not restyled; Define/Translate work via screenshot. |
| Pages with very strict CSP | `scripting.insertCSS` used for page styles (author origin); Prism UI uses adopted stylesheets in Shadow DOM. **[verify]** on a strict-CSP fixture. |

## 7. Data flows

DF-1 Tidy: content script builds a **page outline** (landmarks, headings, nav, forms with labels and
types, buttons/links text, text-block summaries, element ids `p-123`; **no form values**, no hidden
inputs, no password/payment fields' contents) → SW cache lookup → (miss) helper `/v1/plan` → Gemini →
validated **TidyPlan** → cached → applied by tidy engine. Optional small low-res screenshot only when
the outline is too thin (canvas-heavy pages), never cached.

DF-2 Region assist: selection rect (CSS px) → content script extracts DOM text/controls intersecting the
rect (excluding Prism UI) → SW captures visible tab, crops to rect at device pixel ratio (Prism overlay
hidden during capture) → helper `/v1/assist` with {action, text, controls, image?, profile subset,
language} → validated answer → card UI. Images are sent only when the region has images/canvas or the
DOM text is insufficient; never stored.

DF-3 Chat/action loop: user message + attached context → helper `/v1/chat` (SSE) → model proposes
**one** action from the allowed set → extension validates (target exists, visible, enabled, policy) →
consequential? ask → perform → observe (new outline delta, errors) → next turn. State lives in
`storage.session` so it survives navigation; hard caps: 20 steps, 10 minutes, Stop at any time.

DF-4 Imports: file read locally in the settings page (ZIP/JSON parsed in a Web Worker) → only
user-authored messages and memory-like statements kept → optional AI extraction of candidate facts on a
size-capped excerpt (person sees exactly what will be sent) → review/edit screen → saved to
`storage.local`. Raw exports are never uploaded or stored.

What leaves the computer: only the request payloads above, sent to the local helper and from there to
Google Vertex AI in the person's own Google Cloud project. Vertex AI does not use customer prompts to
train models (to be cited in 06 with the official reference). Nothing goes to any Prism server — there
is none.

## 8. Repository layout (proposed)

```
prism/
  specs/                 # these documents (source of truth)
  PROGRESS.md            # milestone + acceptance tracker with evidence links
  extension/
    src/{background,content,popup,options,welcome,shared}/
    src/shared/schemas.ts      # mirrors backend schemas
    src/styles/presets/        # 4 design systems as token files
    assets/icons/              # Prism logo + icons
    dist/                      # build output (git-ignored)
  helper/
    prism_helper/{app.py,models.py,prompts/,routing.py}
    tests/
    .env.example               # no secrets; project id + location only
  fixtures/                    # local test sites (cluttered, form, SPA, image-text, non-English, strict CSP)
  tests/e2e/                   # Playwright tests that load the real unpacked extension
  evidence/                    # screenshots and logs referenced by PROGRESS.md
  scripts/                     # build, package, start helper, secret scan
```


## 9. Changes during implementation (2026-10-03)

| Area | Spec said | Built | Why |
| --- | --- | --- | --- |
| Host access | `optional_host_permissions`, request per site | `host_permissions: ["<all_urls>"]` at install; users can still restrict via Chrome's site access ("On click" / specific sites) | Hold-and-drag and auto re-apply of cached layouts need the content script on every page; per-site prompts can't be triggered from an in-page gesture, and judges need zero-setup. Chrome's built-in site access control preserves user choice. |
| Plan model | `gemini-3.8-flash` | `gemini-3.7-flash` for page plans; 3.8 Flash for Define/Translate/Fill/Chat; `gemini-3.5-flash-lite` fallback | Measured on the same plan request: 3.8 Flash 13–25 s (one 504), 3.7 Flash ≈5 s with the best plan quality, Flash-Lite 2.6 s. |
| Timeouts | 20 s / 15 s first byte | 20 s per model attempt, then fallback; extension timeout 45 s | Chat turns are non-streaming (1–3 s typical); SSE streaming was not needed. |
| Helper hosting | Local only (proposed) | Cloud Run (`us-central1`) + local mode | Decision 2026-10-02: judges should need no setup. |
| Chat surface | In-page panel | In-page panel (as specified) | — |
| Fonts | data URLs or web-accessible | `FontFace` API with `web_accessible_resources` + `use_dynamic_url` | Keeps page CSS small; dynamic URLs limit fingerprinting. |
| Dark headers | (not specified) | Dark, full-width branded strips with a logo keep their colours | Preserves site identity (e.g. GOV.UK header) and avoids white-on-light logos. |
