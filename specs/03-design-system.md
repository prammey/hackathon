# 03 — Design system: Prism brand and the four Styles

Status: **Implemented**; revised 2026-10-03 (glow-up) — see §7
Contrast values below were computed with the WCAG 2.x relative-luminance formula by
`scripts/contrast_check.py` (run in Phase 1; output in 08 §1). Phase 2 re-checks them on real pages.

## 1. Principles
1. **Clarity over decoration.** Every visual choice must help someone understand or act.
2. **Controls look like controls.** Buttons, fields and links are visibly distinct from text in every
   Style; nothing interactive is identified by colour alone.
3. **Big enough by default.** Base text 18 px, line height ≥ 1.55, line length ≤ 70 characters,
   targets ≥ 44×44 px for Prism UI and ≥ 24×24 px minimum for restyled page controls.
4. **Calm motion.** Motion only explains change (open/close, step progress). `prefers-reduced-motion`
   or the Prism setting "Reduce motion" sets every duration to 0.
5. **Accessibility beats style.** When a Style's ideal look fails contrast, the accessible value wins.

## 2. Prism brand (popup, settings, welcome, selection menu, answer cards, chat, page tab)

The Prism UI keeps one consistent brand system so it is always recognisable, whatever Style the page
uses. It adopts only the current Style's **corner radius** so it sits comfortably on the page.

- **Logo (placeholder, Phase 2 SVG):** an equilateral triangular prism outline in Prism Ink; a single
  white beam enters from the left and leaves the right face as four soft bands (coral, amber, teal,
  blue). Toolbar icons at 16/32/48/128 px use a simplified mark (solid triangle + three bands) that stays
  legible at 16 px. The spectrum colours appear **only** in the logo and the Style previews.
- **Name lockup:** "Prism" in Atkinson Hyperlegible Next Bold, Prism Ink.

| Token | Value | Use |
| --- | --- | --- |
| `--prism-ink` | `#1B1F3B` | text, logo, outlines |
| `--prism-ink-muted` | `#4A4F6A` | secondary text |
| `--prism-paper` | `#FFFFFF` | panel background |
| `--prism-mist` | `#F3F4FA` | inset areas, hover |
| `--prism-violet` | `#4B3FD1` | primary buttons, selection outline |
| `--prism-violet-tint` | `rgba(75,63,209,0.14)` | selection fill |
| `--prism-focus` | `#1B1F3B` ring 3 px + 2 px `#FFFFFF` gap | all focus states |
| `--prism-ok` / `--prism-warn` / `--prism-danger` | `#11704F` / `#8A4B00` / `#B3261E` | status (always with an icon + words) |
| spectrum | coral `#FF7A59`, amber `#FFC24B`, teal `#2BB3A3`, blue `#3D7BFD` | logo only |
| type | Atkinson Hyperlegible Next 18/28 body, 600 labels, 22–28 titles | all Prism UI |
| spacing | 4, 8, 12, 16, 24, 32 | — |
| elevation | `0 8px 28px rgba(27,31,59,.18)` + 1 px `#C9CBE0` border | floating menu, cards, chat |

Prism UI components: Button (primary/secondary/quiet/danger), Switch (with on/off words), Segmented
Style picker (four live thumbnails), Card, Menu (four actions with icon + word), Chat bubble, Step
list, Inline notice, Progress indicator (indeterminate bar + words, never a spinner alone),
Field-change highlight, Page tab (edge tab: Prism logo + "Tidied · Show original").

## 3. How a Style is applied to a website
A Style is a **token set + rule set**. The tidy engine tags page elements with Prism roles
(`data-prism-role="primary-action|secondary-action|nav|main|aside|notice|required-notice|form|field|
error|step|clutter|media|table|footer"`) and injects one stylesheet:
- **Base layer** (all Styles): readable font size, line height, measure, spacing rhythm, consistent
  form control sizing, visible focus, underlined links in text, `scroll-behavior` (unless reduced motion),
  table readability, image max-width. Scoped under `html[data-prism-on]` with high specificity
  (`:where()` for low-risk resets, explicit `!important` only on a vetted property list).
- **Style layer:** the tokens below drive role-specific rules (e.g. `primary-action` becomes the
  Style's primary button, `notice` becomes a callout block, `clutter` collapses behind a labelled
  disclosure).
- Restyling never sets `display:none` on content tagged `required-notice`, `error`, `notice`,
  form fields, or anything with `role=alert|status`, `aria-live`, `required`, `aria-invalid`.

## 4. The four Styles — tokens

All four share the spacing scale `--sp: 4 8 12 16 24 32 48 64` (px) and base text 18 px. Values in
**bold** were adjusted for contrast.

### 4.1 Neo-brutalist — "Bold"
Character: confident, blocky, high-contrast; thick borders, flat colour blocks, hard offset shadows.

| Token | Value |
| --- | --- |
| Fonts | headings **Space Grotesk 700**, body **Space Grotesk 500** → falls back to system grotesk |
| Type scale | 18 / 22 / 28 / 36 / 48, line-height 1.55 body, 1.1 headings; headings tight letter-spacing −0.01em; no all-caps body |
| `bg` / `surface` | `#FFF8E7` / `#FFFFFF` |
| `text` / `text-muted` | `#0F0F0F` / `#333333` |
| `border` | `#0F0F0F`, 3 px (controls, cards), 2 px (dividers) |
| `primary` / `on-primary` | `#1F2EDB` / `#FFFFFF` |
| `link` | `#1F2EDB`, 2 px underline offset 3 px |
| blocks | callout yellow `#FFD43B`, info mint `#A7F0CF`, section pink `#FFC2D6` (text always `#0F0F0F`) |
| `danger` / `success` | `#B00020` / `#0B6B3A` |
| radii | 0 (buttons, inputs, cards) |
| shadows | `4px 4px 0 #0F0F0F` (cards, primary), pressed: translate(2px,2px) + `2px 2px 0` |
| focus | 4 px solid `#0F0F0F` outline + 4 px `#FFD43B` outer ring |
| motion | 80 ms linear (press only) |
| States | hover: block colour fill; active: pressed shadow; disabled: diagonal hatch + "Not available" tooltip text |

### 4.2 Modern Minimalist — "Calm"
Character: quiet, spacious, refined; hairlines, restrained single accent, elegant serif headings.

| Token | Value |
| --- | --- |
| Fonts | headings **Source Serif 4 600**, body **Inter 400/500** |
| Type scale | 18 / 21 / 26 / 32 / 40, line-height 1.65 body, 1.2 headings; measure 64ch |
| `bg` / `surface` | `#FAFAF7` / `#FFFFFF` |
| `text` / `text-muted` | `#1C1C1E` / `#56585E` |
| `border` | decorative hairline `#E2E2DC` 1 px; **control border `#8A8D93`** 1.5 px |
| `primary` / `on-primary` | `#1E5E5A` / `#FFFFFF` |
| `link` | `#1E5E5A`, 1 px underline offset 4 px |
| `danger` / `success` | `#A8261B` / `#1E6B3D` |
| radii | 6 px controls, 10 px cards |
| shadows | none; cards separated by whitespace + hairline |
| focus | 3 px `#1E5E5A` outline, 3 px offset |
| motion | 150 ms ease-out |
| Spacing | section gap 64, block gap 24 (×1.5 the other Styles) |
| States | hover: underline/raise background to `#F1F1EC`; active: darken primary 8%; disabled: `#8A8D93` text + "Not available" |

### 4.3 Neumorphism — "Soft"
Character: soft extruded surfaces; restrained depth. **Accessibility guard:** every control has a
visible border and text label; depth is decoration only.

| Token | Value |
| --- | --- |
| Fonts | headings and body **Nunito 600/500** (rounded, friendly) |
| Type scale | 18 / 22 / 27 / 34 / 42, line-height 1.6 |
| `bg` / `surface` | `#E6EBF2` / `#E6EBF2` (same plane, depth via shadow) |
| `text` / `text-muted` | `#1D2433` / `#465068` |
| `border` | **controls `#6F7A90` 1.5 px** (≥3:1 on bg); decorative none |
| `primary` / `on-primary` | `#3550C8` / `#FFFFFF` |
| `link` | `#2B44B0`, underline |
| raised shadow | `-6px -6px 14px rgba(255,255,255,.85), 6px 6px 14px rgba(150,164,190,.55)` |
| inset shadow (inputs) | `inset 3px 3px 7px rgba(150,164,190,.55), inset -3px -3px 7px rgba(255,255,255,.9)` |
| `danger` / `success` | `#A3221A` / `#14663F` |
| radii | 14 px controls, 22 px cards, 999 px chips |
| focus | 3 px solid `#1D2433` + 6 px `rgba(53,80,200,.35)` halo |
| motion | 180 ms ease-in-out (press sinks: raised → inset) |
| States | hover: stronger shadow; active: inset; disabled: flat (no shadow) + dashed border + "Not available" |

### 4.4 Clean Flat — "Clear"
Character: crisp, simple shapes, clear colours, zero depth; maximal legibility.

| Token | Value |
| --- | --- |
| Fonts | headings and body **Atkinson Hyperlegible Next 400/700** |
| Type scale | 18 / 22 / 26 / 32 / 40, line-height 1.6 |
| `bg` / `surface` | `#FFFFFF` / `#F3F5F8` |
| `text` / `text-muted` | `#17202A` / `#4B5563` |
| `border` | controls `#7C8794` 2 px; dividers `#D9DEE5` |
| `primary` / `on-primary` | `#0A5BD3` / `#FFFFFF` |
| secondary button | `#FFFFFF` bg, `#0A5BD3` 2 px border and text |
| `link` | `#0A55C4`, underline |
| `danger` / `success` / `warn` | `#C01F1F` / `#0E7A4E` / `#8F5200` |
| radii | 8 px controls, 12 px cards |
| shadows | none |
| focus | 3 px `#0A5BD3` outline + 2 px white gap |
| motion | 120 ms ease-out |
| States | hover: bg tint `#E8F0FD`; active: darken 10%; disabled: `#F3F5F8` bg + **`#5B6270`** text + "Not available" |

## 5. Accessibility modifiers (Settings → Reading & accessibility)
- **Text size:** 100 / 115 / 130 / 150 % (multiplies the 18 px base; page zoom still works on top).
- **Extra-legible font:** forces Atkinson Hyperlegible Next for body in every Style.
- **Stronger contrast:** text → pure ink, borders +1 px and darker, removes Soft shadows.
- **Reduce motion:** follows the OS by default; can be forced on.
- **Underline all links:** default on.
- **Bigger click targets:** min 44×44 px for page controls (padding only, never layout-breaking widths).

## 6. Voice and microcopy
- Short sentences, everyday words, second person ("You can…").
- Always say what will happen before it happens ("This will put 4 answers into the form. It will not
  send the form.").
- Errors say what went wrong, what Prism did about it, and the next step, without blame.
- Never present AI text as the website's or a government's words; answers carry a small
  "Prism's explanation" label.


## 7. Revision 2026-10-03 — glow-up (implemented)
- **Prism UI** is now smoky off-black + purple: bg `#131218`, surfaces `#1C1A23`/`#26232F`, text `#F4F2F9`,
  muted `#ABA5BC`, accent `#A78BFA`, buttons `#6D4AFF` (white text 5.2:1), radii 14–24 px, soft violet glow.
  UI text in Inter; the **Prism** wordmark and display headings in **Instrument Serif Italic**.
- **Style names** use the real aesthetic names: Clean Flat (`clear`), Modern Minimalist (`calm`),
  Neo-Brutalist (`bold`), Neumorphism (`soft`). Internal ids are unchanged so saved preferences survive.
- All Styles are rounder (controls 12–16 px, cards 16–26 px; Minimalist uses pill buttons).
- **Restructure mode** (`html[data-prism-mode=restructure]`) for chaotic pages: canvas blocks and layout
  tables become a card grid; product fragments are grouped; titles and prices are highlighted.
- All colour pairs re-verified by `scripts/contrast_check.py`.
