# 04 — Page transformation ("Tidy"), restoration and caching

Status: **Draft for Phase 1 review** · Last updated 2026-10-02

## 1. Strategy: restyle in place, never rebuild

"Rewrite the website" is delivered as a **visual and usability outcome**, not by replacing the
document. The page's own DOM nodes, event listeners, framework state, forms and scripts are kept.
Prism changes only:

1. **Prism attributes** on existing elements (`data-prism-role`, `data-prism-emphasis`,
   `data-prism-collapsed`, `data-prism-id`).
2. **One Prism page stylesheet** inserted with `chrome.scripting.insertCSS` (author origin), scoped to
   `html[data-prism-on]`, generated from the Style tokens + the plan.
3. **Additive Prism UI** in the closed Shadow DOM root: the page tab, "Show more" disclosure
   buttons, and an optional **Next step** guide.
4. **Bounded visual reordering** via CSS only (`order` within flex/grid parents Prism verifies, or
   `display:contents` wrappers that Prism does *not* create) — DOM nodes are never moved between parents
   by default. A plan may request a **sticky emphasis** for a primary action (CSS `position: sticky`),
   never a cloned button.

Why: moving or cloning nodes breaks framework reconciliation (React/Vue keyed lists), event
delegation and form association; CSS + attributes are fully reversible by removal.

### What is never done
- No AI-generated JavaScript, CSS text or selectors are executed or injected. The AI returns **data**
  (roles, emphasis, collapse groups, labels) that refers to Prism element ids; the extension maps
  that data onto its own pre-written CSS rules.
- `display:none` is never applied to protected content: errors, alerts, live regions, required-field
  markers, labels, legal/disclosure text (detected by role/ARIA + keyword heuristics + AI flag),
  consent banners' decline buttons, or any focusable form control.
- No invented website text. Prism-added labels ("Main action", "More links") are visibly Prism's.
- Government/official-looking pages get a persistent tag on the Prism page tab: "Tidied by Prism —
  this is still the official site, only the look has changed."

## 2. Pipeline

```
page idle ─▶ Analyzer ─▶ Outline + fingerprints ─▶ cache? ─┬─ hit & valid ─▶ apply plan
                                                          └─ miss ─▶ Base tidy now ─▶ AI plan ─▶ validate ─▶ apply ─▶ cache
```

### 2.1 Analyzer (deterministic, content script)
- Waits for `document_idle` + a 300 ms quiet period (no large mutations) or 2 s max.
- Walks the rendered DOM (skipping Prism root, invisible nodes, `aria-hidden` subtrees except for
  classification) and assigns `data-prism-id` to "interesting" nodes: landmarks, headings, nav lists,
  forms and controls, buttons, prominent links, text blocks, images with alt/captions, tables, iframes,
  ad/clutter candidates (sticky banners, carousels, iframes from ad hosts, repeated link farms).
- Produces the **Outline** (JSON, typically 2–15 KB): page title, URL path, lang, element list with
  `{id, tag, role, accessibleName (≤80 chars), textSample (≤160 chars), box (rounded viewport rect),
  visibility, interactive, formInfo{type, label, required, hasError} (no values)}`, plus heuristic
  hints (likely primary action, likely clutter).
- Computes fingerprints:
  - **pageKey** = origin + normalised path (numeric/uuid segments → `:id`, query keys kept but values
    dropped except an allow-list like `page`, `tab`, `step`).
  - **structureHash** = hash of the landmark/heading/form skeleton (tags, roles, heading text, form
    field labels/types) — robust to ad rotation, counters, timestamps.
- Restricted pages, PDFs, canvas-only apps → Outline marked `thin`; Prism offers Define/Translate but
  explains "This page can't be tidied, but you can still point at things to ask about them."

### 2.2 Base tidy (deterministic, instant, no AI)
Applied immediately on activation so the person sees improvement within ~1 s:
readable text size/line-height/measure, link underlines, form control sizing and visible borders,
focus rings, spacing rhythm, heuristic emphasis of the likely primary action, collapse of obvious
clutter (sticky promo bars, autoplay carousels → paused + collapsed), table readability.

### 2.3 AI plan (Gemini, structured output)
Request: Outline + Style id + relevant preferences (text size, reduce clutter level, language) + plan
schema version. **No form values, no screenshots by default.**

`TidyPlan` (validated JSON schema, v1):
```
{
  version: 1,
  pagePurpose: string (≤140),                // shown in page tab: "Council tax payment page"
  primaryTask: string (≤140),
  roles: [{ id, role: enum(PrismRole) }] (≤400),
  emphasis: [{ id, level: enum(primary|secondary|quiet) }] (≤40),
  collapse: [{ ids: [id] (≤60), label: string (≤40), reason: enum(ads|related-links|promo|social|repeated-nav|cookie-info) }] (≤12),
  protect: [id] (≤200),                      // AI-flagged must-stay-visible
  steps: [{ id, label (≤60) }] (≤12),        // ordered next-step guide for forms/workflows
  readingOrder: [{ parentId, childIds: [id] }] (≤8),   // optional CSS-order hints, validated
  notes: string (≤300)                       // for debugging, never shown as fact
}
```
Validation (helper with pydantic **and** extension before apply):
- Schema, size bounds, enums; every id must exist in the current Outline.
- `collapse` may not contain protected ids (Prism heuristics ∪ plan.protect) or focused elements, and
  may not collapse > 40% of main-content text.
- `readingOrder` only accepted if the parent is a flex/grid container and children are its direct
  children; otherwise dropped (not fatal).
- Any failure: drop the offending item; if > 30% of items invalid, reject the plan, keep Base tidy, show
  "Prism kept a simple tidy for this page" with **Try again**.

### 2.4 Apply / restore
- Apply = set attributes in one `requestAnimationFrame` batch + swap stylesheet. A **change journal**
  records every attribute Prism set (element ref, attribute, previous value).
- Restore (**Show original page**) = remove stylesheet, replay journal backwards, remove Prism UI,
  remove `data-prism-on`. Verified by a test comparing serialized DOM (minus Prism root) and computed
  styles before/after.
- Failure recovery: apply runs inside try/catch per step; any exception or a **health check**
  failure (main content height collapsed to < 30% of original, primary form controls hidden or
  zero-sized, layout overflow causing horizontal scroll > 20% wider than viewport) triggers automatic
  restore of that step and a notice.

## 3. Dynamic pages and route changes (mutation governor)
- One `MutationObserver` on `document.body` (childList + subtree; attributes only for `class`,
  `style`, `hidden`, `aria-*` on Prism-tagged elements). Mutations caused by Prism are ignored via a
  re-entrancy flag + Prism attribute filter.
- New nodes are classified **locally** with the plan's rules (role patterns learned from the plan:
  e.g. "children of the list tagged `related-links` are collapsed") — no AI call.
- SPA route changes detected by `navigation` API events where available, `popstate`, `pushState`
  wrapper in the isolated world via `navigation.onnavigate`, and URL polling fallback (1 s) →
  recompute pageKey + structureHash → cache lookup → AI only on a miss.
- **AI call budget** per tab: max 1 plan request per pageKey+structureHash; structural change must
  exceed a threshold (> 25% of skeleton changed and stable for 1.5 s) before a new request; hard cap
  6 plan requests per tab per 10 minutes. Minor changes (counters, clocks, lazy images, ads) never
  trigger AI.
- Flicker prevention: Prism's styles target attributes, so newly inserted nodes are styled as soon as
  they are tagged (≤ 1 animation frame). For cached plans on reload, the content script registered at
  `document_start` inserts the Style's base stylesheet early (for "Always on" sites) to avoid a flash of
  the untidied page; plan roles are applied at idle.

## 4. Caching

**Default (proposed): stable cached transformations.** A conflict exists between the explicit caching
requirement and a later "no cache" remark — see 08 §4 Q1. Until resolved, caching is on by default and
the settings expose **Clear saved layouts** and a per-site **Always tidy from scratch** option.

- Store: `chrome.storage.local` key `plan:<pageKey>`, value `{planVersion, styleId, prefsHash,
  structureHash, outlineIdsSignature, plan, createdAt, lastUsedAt, hits}`. LRU cap 500 plans / 8 MB.
- Cache key match requires: same pageKey, same planVersion (bumped when schema or engine rules change),
  same styleId, same prefsHash (text size, clutter level, language). A Style switch reuses the
  **roles** (style-independent) and only regenerates nothing — roles are Style-agnostic, so switching
  Style is instant and needs no AI. (StyleId is therefore only part of the key for Style-specific
  hints; v1 plans have none.)
- **Validation on reuse:** recompute structureHash; if equal → apply. If different but ≥ 85% of plan
  ids resolve to elements with the same tag+role+accessibleName signature → apply the resolvable part
  and schedule a background refresh (only if AI budget allows). Otherwise the plan is **stale** → Base
  tidy + fresh AI plan; stale plans never partially apply below the threshold.
- Element re-identification across reloads: ids are re-derived deterministically from a stable
  signature (landmark path + tag + role + accessible name + sibling index), so the same element gets
  the same `data-prism-id` on an unchanged page.
- **Never cached:** form values, screenshots, selected-region content, chat, profile data. Plans
  contain only ids, roles, short labels and Prism-generated summaries of page purpose.
- Controls: popup **Tidy again from scratch** (deletes this page's plan and regenerates); Settings
  → Saved layouts: list by site, delete one, delete all.

## 5. Per-site preferences
`site:<origin>` → `{ tidy: 'off' | 'on-click' | 'always', styleId?, clutterLevel?, fromScratch? }`.
Popup shows these for the current site with plain words: "On this site: Tidy automatically every time".

## 6. Testing hooks (Phase 2)
- `window.postMessage`-free test API exposed only in test builds via `chrome.runtime` messages:
  get journal, get AI call counter, force plan, inject invalid plan.
- Fixtures: cluttered news/info page, multi-step form with validation, SPA with route changes and a
  live-updating list, image-text page, non-English page, strict-CSP page.
