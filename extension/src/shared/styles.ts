/**
 * The four Prism Styles as token sets, and the generator for the page stylesheet.
 * Tokens mirror specs/03-design-system.md; contrast is checked by scripts/contrast_check.py.
 * The stylesheet only targets Prism attributes and standard tags under html[data-prism-on],
 * so removing that attribute (or the sheet) restores the original page.
 */
import type { Settings, StyleId } from "./types";

export interface StyleTokens {
  id: StyleId;
  name: string;
  tagline: string;
  fontBody: string;
  fontHeading: string;
  headingWeight: number;
  headingSpacing: string;
  scale: { h1: number; h2: number; h3: number; h4: number };
  lh: number;
  lhHeading: number;
  gap: string;
  bg: string;
  band: string;
  bandBorder: string;
  surface: string;
  card: string;
  cardBorder: string;
  cardShadow: string;
  text: string;
  muted: string;
  divider: string;
  control: string;
  controlWidth: string;
  field: string;
  fieldShadow: string;
  primary: string;
  onPrimary: string;
  primaryBorder: string;
  primaryShadow: string;
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
  buttonShadow: string;
  pressTransform: string;
  pressShadow: string;
  link: string;
  linkThickness: string;
  danger: string;
  success: string;
  noticeBg: string;
  noticeBorder: string;
  noticeLeft: string;
  noticeShadow: string;
  radiusControl: string;
  radiusCard: string;
  focusOutline: string;
  focusShadow: string;
  motion: string;
  headingAccent: string;
  priceBg: string;
  priceText: string;
  preview: { swatches: string[] };
}

const FONT_STACKS = {
  grotesk: `"Prism Space Grotesk", "Helvetica Neue", Arial, sans-serif`,
  serif: `"Prism Source Serif", Georgia, "Times New Roman", serif`,
  inter: `"Prism Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  nunito: `"Prism Nunito", "Trebuchet MS", "Segoe UI", sans-serif`,
  atkinson: `"Prism Atkinson", Verdana, "Segoe UI", sans-serif`,
};

export const FONT_FILES: Record<string, string> = {
  "Prism Space Grotesk": "fonts/space-grotesk.woff2",
  "Prism Source Serif": "fonts/source-serif-4.woff2",
  "Prism Inter": "fonts/inter.woff2",
  "Prism Nunito": "fonts/nunito.woff2",
  "Prism Atkinson": "fonts/atkinson-hyperlegible-next.woff2",
  "Prism Instrument": "fonts/instrument-serif-italic.woff2",
};

export const STYLES: Record<StyleId, StyleTokens> = {
  clear: {
    id: "clear", name: "Clean Flat", tagline: "Crisp shapes, clear colours, nothing extra",
    fontBody: FONT_STACKS.inter, fontHeading: FONT_STACKS.inter, headingWeight: 700, headingSpacing: "-0.02em",
    scale: { h1: 2.2, h2: 1.6, h3: 1.28, h4: 1.1 }, lh: 1.6, lhHeading: 1.15, gap: "1em",
    bg: "#F6F7FB", band: "#FFFFFF", bandBorder: "1px solid #E4E8F0",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "1px solid #E4E8F0", cardShadow: "0 1px 2px rgba(16,24,40,0.05), 0 4px 16px rgba(16,24,40,0.05)",
    text: "#0F172A", muted: "#475569", divider: "#E4E8F0", control: "#7C8899", controlWidth: "1.5px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#2754E6", onPrimary: "#FFFFFF", primaryBorder: "#2754E6", primaryShadow: "0 4px 12px rgba(39,84,230,0.25)",
    buttonBg: "#FFFFFF", buttonText: "#1E40C8", buttonBorder: "#C7D2FE", buttonShadow: "none",
    pressTransform: "translateY(1px)", pressShadow: "none",
    link: "#1E40C8", linkThickness: "1.5px",
    danger: "#C0262D", success: "#0E7A4E",
    noticeBg: "#EEF2FF", noticeBorder: "1px solid #D9E0FE", noticeLeft: "4px solid #2754E6",
    noticeShadow: "none",
    radiusControl: "12px", radiusCard: "16px",
    focusOutline: "3px solid #2754E6", focusShadow: "0 0 0 6px rgba(39,84,230,0.18)",
    motion: "140ms ease-out",
    headingAccent: "none",
    priceBg: "#EEF2FF", priceText: "#1E40C8",
    preview: { swatches: ["#F6F7FB", "#FFFFFF", "#2754E6", "#0F172A"] },
  },
  bold: {
    id: "bold", name: "Neo-Brutalist", tagline: "Chunky type, thick outlines and blocks of colour",
    fontBody: FONT_STACKS.grotesk, fontHeading: FONT_STACKS.grotesk, headingWeight: 700,
    headingSpacing: "-0.02em", scale: { h1: 2.5, h2: 1.8, h3: 1.35, h4: 1.15 }, lh: 1.55, lhHeading: 1.08,
    gap: "1em",
    bg: "#FFF4DE", band: "#FFD84D", bandBorder: "3px solid #111111",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "3px solid #111111", cardShadow: "6px 6px 0 #111111",
    text: "#111111", muted: "#333333", divider: "#111111", control: "#111111", controlWidth: "3px",
    field: "#FFFFFF", fieldShadow: "3px 3px 0 #111111",
    primary: "#4F46E5", onPrimary: "#FFFFFF", primaryBorder: "#111111", primaryShadow: "5px 5px 0 #111111",
    buttonBg: "#FFD84D", buttonText: "#111111", buttonBorder: "#111111", buttonShadow: "4px 4px 0 #111111",
    pressTransform: "translate(3px, 3px)", pressShadow: "1px 1px 0 #111111",
    link: "#3730C9", linkThickness: "2px",
    danger: "#B00020", success: "#0B6B3A",
    noticeBg: "#FFB8D2", noticeBorder: "3px solid #111111", noticeLeft: "3px solid #111111",
    noticeShadow: "5px 5px 0 #111111",
    radiusControl: "12px", radiusCard: "16px",
    focusOutline: "3px solid #111111", focusShadow: "0 0 0 7px #FFD84D",
    motion: "90ms ease-out",
    headingAccent: "inset 0 -0.32em 0 #A7F3D0",
    priceBg: "#A7F3D0", priceText: "#111111",
    preview: { swatches: ["#FFF4DE", "#FFD84D", "#4F46E5", "#FFB8D2"] },
  },
  calm: {
    id: "calm", name: "Modern Minimalist", tagline: "Quiet, spacious and refined",
    fontBody: FONT_STACKS.inter, fontHeading: FONT_STACKS.serif, headingWeight: 500, headingSpacing: "-0.01em",
    scale: { h1: 2.4, h2: 1.7, h3: 1.3, h4: 1.12 }, lh: 1.7, lhHeading: 1.15, gap: "1.5em",
    bg: "#FAFAF7", band: "#FAFAF7", bandBorder: "1px solid #E8E8E2",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "1px solid #ECECE6", cardShadow: "0 1px 0 rgba(0,0,0,0.02), 0 12px 32px rgba(17,17,17,0.04)",
    text: "#18181B", muted: "#55565C", divider: "#E8E8E2", control: "#8A8B91", controlWidth: "1px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#18181B", onPrimary: "#FFFFFF", primaryBorder: "#18181B", primaryShadow: "none",
    buttonBg: "transparent", buttonText: "#18181B", buttonBorder: "#8A8B91", buttonShadow: "none",
    pressTransform: "none", pressShadow: "none",
    link: "#18181B", linkThickness: "1px",
    danger: "#A8261B", success: "#1E6B3D",
    noticeBg: "#F3F3EE", noticeBorder: "0 solid transparent", noticeLeft: "2px solid #18181B",
    noticeShadow: "none",
    radiusControl: "999px", radiusCard: "20px",
    focusOutline: "2px solid #18181B", focusShadow: "0 0 0 5px rgba(24,24,27,0.12)",
    motion: "180ms ease-out",
    headingAccent: "none",
    priceBg: "#F0F0EA", priceText: "#18181B",
    preview: { swatches: ["#FAFAF7", "#FFFFFF", "#ECECE6", "#18181B"] },
  },
  soft: {
    id: "soft", name: "Neumorphism", tagline: "Soft raised surfaces, with edges you can still see",
    fontBody: FONT_STACKS.nunito, fontHeading: FONT_STACKS.nunito, headingWeight: 800, headingSpacing: "-0.01em",
    scale: { h1: 2.3, h2: 1.7, h3: 1.33, h4: 1.13 }, lh: 1.6, lhHeading: 1.18, gap: "1.15em",
    bg: "#E8ECF4", band: "#E8ECF4", bandBorder: "0 solid transparent",
    surface: "#E8ECF4", card: "#E8ECF4", cardBorder: "1px solid rgba(255,255,255,0.65)",
    cardShadow: "-8px -8px 18px rgba(255,255,255,0.9), 8px 8px 20px rgba(146,160,188,0.55)",
    text: "#1D2433", muted: "#465068", divider: "#C6CEDC", control: "#6F7A90", controlWidth: "1.5px",
    field: "#E8ECF4",
    fieldShadow: "inset 4px 4px 9px rgba(146,160,188,0.55), inset -4px -4px 9px rgba(255,255,255,0.95)",
    primary: "#4153DD", onPrimary: "#FFFFFF", primaryBorder: "#3646C7",
    primaryShadow: "-5px -5px 12px rgba(255,255,255,0.85), 6px 6px 14px rgba(65,83,221,0.35)",
    buttonBg: "#E8ECF4", buttonText: "#1D2433", buttonBorder: "#8D97AC",
    buttonShadow: "-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(146,160,188,0.55)",
    pressTransform: "none",
    pressShadow: "inset 4px 4px 9px rgba(146,160,188,0.6), inset -4px -4px 9px rgba(255,255,255,0.95)",
    link: "#3646C7", linkThickness: "1.5px",
    danger: "#A3221A", success: "#14663F",
    noticeBg: "#E8ECF4", noticeBorder: "1px solid rgba(255,255,255,0.7)", noticeLeft: "5px solid #4153DD",
    noticeShadow: "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 16px rgba(146,160,188,0.5)",
    radiusControl: "16px", radiusCard: "26px",
    focusOutline: "3px solid #1D2433", focusShadow: "0 0 0 7px rgba(65,83,221,0.3)",
    motion: "200ms ease-in-out",
    headingAccent: "none",
    priceBg: "#DCE2FB", priceText: "#2A38B0",
    preview: { swatches: ["#E8ECF4", "#F7F9FC", "#4153DD", "#1D2433"] },
  },
};

export const STYLE_ORDER: StyleId[] = ["clear", "calm", "bold", "soft"];

export function effectiveTokens(styleId: StyleId, settings: Pick<Settings, "extraLegible" | "strongContrast">): StyleTokens {
  const base = { ...STYLES[styleId] };
  if (settings.extraLegible) base.fontBody = FONT_STACKS.atkinson;
  if (settings.strongContrast) {
    Object.assign(base, {
      text: "#000000", muted: "#1A1A1A", control: "#000000", divider: "#5A5A5A",
      cardShadow: "none", buttonShadow: "none", primaryShadow: "none", noticeShadow: "none",
      fieldShadow: "none", buttonBorder: "#000000", cardBorder: `2px solid #000000`,
    });
  }
  return base;
}

/** Font families a Style needs, so the content script only loads those files. */
export function fontsFor(tokens: StyleTokens): string[] {
  return Object.keys(FONT_FILES).filter((family) => tokens.fontBody.includes(family) || tokens.fontHeading.includes(family));
}

export function pageCss(styleId: StyleId, settings: Settings, reducedMotion: boolean): string {
  const t = effectiveTokens(styleId, settings);
  const base = Math.round(18 * settings.textScale);
  const target = settings.bigTargets ? "48px" : "40px";
  const P = "html[data-prism-on]";
  const notKeep = ":not([data-prism-s=keep] *)";
  const text = `:is(p,li,dd,dt,td,th,blockquote,figcaption,label,legend,summary,caption)${notKeep}`;
  const heading = `:is(h1,h2,h3,h4,h5,h6,[role=heading])${notKeep}`;
  const button = `:is([data-prism-c=button],[data-prism-c=button-link])`;
  const linkSel = `a[href]:not([data-prism-c]):not([role=button])${notKeep}`;
  const motion = reducedMotion || settings.reduceMotion === "on";
  const dur = motion ? "0s" : t.motion;

  return `
${P}{--p-base:${base}px;--p-target:${target};color-scheme:light!important;background:${t.bg}!important;${motion ? "" : "scroll-behavior:smooth;"}}
${P} body{background:${t.bg}!important;color:${t.text}!important;font-family:${t.fontBody}!important}
${P} ${text}{font-family:${t.fontBody}!important;color:${t.text}!important;line-height:${t.lh}!important;letter-spacing:normal!important;word-spacing:normal!important}
${P} :is(main,[data-prism-role=main],article) :is(p,li,dd,dt,blockquote,figcaption,td,th,label,legend,summary)${notKeep}{font-size:max(1em,var(--p-base))!important}
${P} :is(main,[data-prism-role=main],article) :is(p,ul,ol,blockquote,dl)${notKeep}{margin-block:0 ${t.gap}!important}
${P} :is(main,[data-prism-role=main],article) p${notKeep}{max-width:70ch!important}
${P} :is(main,[data-prism-role=main],article) li${notKeep}{margin-block:.3em!important}
${P} ${heading}{font-family:${t.fontHeading}!important;color:${t.text}!important;line-height:${t.lhHeading}!important;font-weight:${t.headingWeight}!important;letter-spacing:${t.headingSpacing}!important;text-transform:none!important}
${P} :is(main,[data-prism-role=main],article) h1${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h1}))!important;margin-block:.5em .45em!important;box-shadow:${t.headingAccent}!important}
${P} :is(main,[data-prism-role=main],article) h2${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h2}))!important;margin-block:1.2em .45em!important}
${P} :is(main,[data-prism-role=main],article) h3${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h3}))!important;margin-block:1em .4em!important}
${P} :is(main,[data-prism-role=main],article) :is(h4,h5,h6)${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h4}))!important}
${P} ${linkSel}{color:${t.link}!important;${settings.underlineLinks ? `text-decoration:underline!important;text-decoration-thickness:${t.linkThickness}!important;text-underline-offset:.2em!important;` : ""}}
${P} :is(nav,[data-prism-role=nav],header,[data-prism-role=header]) ${linkSel}{text-decoration:none!important;font-weight:600!important}
${P} ${linkSel}:hover{text-decoration-thickness:3px!important}
${P} :is(nav,[data-prism-role=nav],header,[data-prism-role=header]) a[href]${notKeep}{font-size:max(1em,15px)!important;line-height:1.3!important}
${P} :is([data-prism-s=band],[data-prism-s=card]){font-size:max(1em,15px)!important}
${P} :is([data-prism-role=notice],[data-prism-role=required-notice],[data-prism-role=error]){font-size:max(1em,calc(var(--p-base) * .95))!important;line-height:${t.lh}!important}
${P} [data-prism-s=band]{background:${t.band}!important;background-image:none!important;color:${t.text}!important;border-bottom:${t.bandBorder}!important;box-shadow:none!important}
${P} [data-prism-s=card]{background:${t.card}!important;background-image:none!important;color:${t.text}!important;border:${t.cardBorder}!important;box-shadow:${t.cardShadow}!important;border-radius:${t.radiusCard}!important}
${P} [data-prism-s=plain]{background:${t.surface}!important;background-image:none!important;color:${t.text}!important}
${P} :is([data-prism-s=band],[data-prism-s=card],[data-prism-s=plain]) :is(span,div,strong,b,em,small,time)${notKeep}{color:inherit}
${P} ${button}{font-family:${t.fontBody}!important;font-weight:700!important;font-size:max(1em,16px)!important;line-height:1.2!important;min-height:var(--p-target)!important;padding:.5em 1.05em!important;border-radius:${t.radiusControl}!important;border:${t.controlWidth} solid ${t.buttonBorder}!important;background:${t.buttonBg}!important;background-image:none!important;color:${t.buttonText}!important;box-shadow:${t.buttonShadow}!important;text-decoration:none!important;text-shadow:none!important;cursor:pointer!important;transition:transform ${dur},box-shadow ${dur},filter ${dur}!important;box-sizing:border-box!important}
${P} ${button} *{color:inherit!important}
${P} [data-prism-c=icon-button]{min-width:var(--p-target)!important;min-height:var(--p-target)!important;border-radius:${t.radiusControl}!important;color:${t.text}!important}
${P} ${button}:hover{filter:brightness(0.94)!important}
${P} ${button}:active{transform:${t.pressTransform}!important;box-shadow:${t.pressShadow}!important}
${P} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(${button.slice(4, -1)},button,input[type=submit]){background:${t.primary}!important;color:${t.onPrimary}!important;border-color:${t.primaryBorder}!important;box-shadow:${t.primaryShadow}!important;font-size:max(1.05em,17px)!important}
${P} :is(button,input[type=submit],input[type=button],input[type=reset])[disabled]{opacity:1!important;filter:none!important;background:${t.surface}!important;color:${t.muted}!important;border-style:dashed!important;cursor:not-allowed!important;box-shadow:none!important}
${P} [data-prism-c=field]{font-family:${t.fontBody}!important;font-size:max(1em,17px)!important;color:${t.text}!important;background-color:${t.field}!important;border:${t.controlWidth} solid ${t.control}!important;border-radius:${t.radiusControl}!important;min-height:var(--p-target)!important;padding:.4em .7em!important;box-shadow:${t.fieldShadow}!important;box-sizing:border-box!important}
${P} textarea[data-prism-c=field],${P} select[data-prism-c=field][multiple]{min-height:5em!important;border-radius:min(${t.radiusControl},18px)!important}
${P} :is(${button.slice(4, -1)},[data-prism-c=field])[data-prism-tight]{font-size:max(1em,14px)!important;padding:.25em .45em!important;min-height:32px!important;max-width:100%!important}
${P} [data-prism-c=field]{max-width:100%!important}
${P} [data-prism-c=field]::placeholder{color:${t.muted}!important;opacity:1!important}
${P} [data-prism-c=field][aria-invalid=true]{border-color:${t.danger}!important;border-width:3px!important}
${P} [data-prism-c=check]{accent-color:${t.primary}!important;width:1.35em!important;height:1.35em!important;min-width:1.35em!important;cursor:pointer!important}
${P} :is([data-prism-role=notice],[data-prism-role=required-notice]){background:${t.noticeBg}!important;background-image:none!important;color:${t.text}!important;border:${t.noticeBorder}!important;border-left:${t.noticeLeft}!important;border-radius:calc(${t.radiusCard} - 4px)!important;box-shadow:${t.noticeShadow}!important;padding:1em 1.2em!important}
${P} [data-prism-role=error]{color:${t.danger}!important;font-weight:700!important;border-left:5px solid ${t.danger}!important;padding-left:.7em!important}
${P} [data-prism-role=error] *{color:inherit!important}
${P} [data-prism-emphasis=primary]:not(${button.slice(4, -1)}):not(button):not(input){outline:3px solid ${t.primary}!important;outline-offset:6px!important;border-radius:${t.radiusControl}!important}
${P} [data-prism-emphasis=quiet]{opacity:.78!important}
${P} [data-prism-role=clutter]:not([data-prism-collapsed]){opacity:.5!important;filter:grayscale(.7)!important;transition:opacity ${dur}!important}
${P} [data-prism-role=clutter]:not([data-prism-collapsed]):is(:hover,:focus-within){opacity:1!important;filter:none!important}
${P} [data-prism-collapsed]:not([data-prism-open]){display:none!important}
${P} [data-prism-step-active]{outline:4px solid ${t.primary}!important;outline-offset:6px!important;border-radius:${t.radiusControl}!important}
${P} :is(main,[data-prism-role=main],article) table${notKeep}{border-collapse:collapse!important;background:${t.surface}!important}
${P} :is(main,[data-prism-role=main],article) :is(td,th)${notKeep}{padding:.5em .75em!important;border:1px solid ${t.divider}!important;text-align:start!important}
${P} :is(main,[data-prism-role=main],article) th${notKeep}{background:${t.card}!important;font-weight:700!important}
${P} :is(main,[data-prism-role=main],article) img{max-width:100%!important;height:auto!important}
${P} hr{border:0!important;border-top:${t.id === "bold" ? "3px solid #0F0F0F" : `1px solid ${t.divider}`}!important}
${P} :focus-visible{outline:${t.focusOutline}!important;outline-offset:3px!important;box-shadow:${t.focusShadow}!important}
${restructureCss(t, P + "[data-prism-mode=restructure]", dur)}
${motion ? `${P} *,${P} *::before,${P} *::after{animation-duration:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;scroll-behavior:auto!important}` : ""}
`;
}

/**
 * "Restructure" mode for chaotic pages: pinned canvas blocks and layout tables become a calm,
 * padded card grid in reading order. Only Prism attributes are targeted, so removing them restores
 * the original layout exactly.
 */
function restructureCss(t: StyleTokens, R: string, dur: string): string {
  const card = `background:${t.card}!important;background-image:none!important;border:${t.cardBorder}!important;box-shadow:${t.cardShadow}!important;border-radius:${t.radiusCard}!important`;
  const items = `[data-prism-layout=canvas]>[data-prism-item]`;
  const cells = `table[data-prism-layout=table-grid]>tbody>tr>td`;
  return `
${R} body{background:${t.bg}!important;margin:0!important;padding:0!important}
${R} [data-prism-layout=canvas]{position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;min-height:0!important;max-width:1280px!important;margin:32px auto 64px!important;padding:0 28px!important;display:grid!important;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))!important;gap:22px!important;align-items:start!important;grid-auto-flow:row!important;transform:none!important;background:transparent!important}
${R} ${items}{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;width:auto!important;height:auto!important;min-height:0!important;max-width:none!important;margin:0!important;transform:none!important;z-index:auto!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:10px!important;padding:20px!important;overflow:hidden!important;${card};transition:transform ${dur},box-shadow ${dur}!important}
${R} ${items}:hover{transform:translateY(-2px)!important}
${R} ${items}[data-prism-item=wide]{grid-column:span 2!important}
${R} ${items}[data-prism-item=nav]{grid-column:1/-1!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;padding:16px 18px!important}
${R} ${items}[data-prism-item=nav] br{display:none!important}
${R} ${items}[data-prism-item=nav] :not(a,a *,img,input,select,textarea,button){display:contents!important}
${R} ${items} *{white-space:normal!important}
${R} ${items}>[data-prism-member]{position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;max-width:100%!important;display:block!important}
${R} ${items}[data-prism-item=nav] a[href]{display:inline-flex!important;align-items:center!important;padding:7px 14px!important;border-radius:999px!important;background:${t.surface}!important;border:1px solid ${t.divider}!important;text-decoration:none!important;font-size:15px!important;font-weight:600!important;line-height:1.2!important}
${R} ${items}[data-prism-item=decor]{display:none!important}
${R} ${items}[data-prism-item=form]{grid-column:span 2!important}
${R} :is(${items},${cells}) :is(div,table,tbody,tr,td,span,font,center,p,b,i,a,ul,li)[style],${R} :is(${items},${cells}) :is(table,td,div)[width],${R} :is(${items},${cells}) :is(table,td,div)[height]{width:auto!important;height:auto!important;min-height:0!important;max-width:100%!important}
${R} :is(${items},${cells}) [data-prism-pos]{position:static!important;left:auto!important;top:auto!important}
${R} :is(${items},${cells}) table{border:0!important;border-collapse:collapse!important;background:transparent!important;width:100%!important}
${R} :is(${items},${cells}) td{border:0!important;padding:0!important;background:transparent!important;vertical-align:top!important}
${R} :is(${items},${cells}) :is(div,span,td,font,center,p,b,i,strong,em,small,a){background-color:transparent!important;background-image:none!important;border-color:transparent!important}
${R} :is(${items},${cells}) :is(font,span,b,i,strong,em,small,center,td,div,p,a,li){font-family:${t.fontBody}!important;font-size:max(15px,min(1em,19px))!important;line-height:1.45!important;color:${t.text}!important;text-shadow:none!important;letter-spacing:normal!important}
${R} :is(${items},${cells}) a[href]{color:${t.link}!important;text-decoration-thickness:${t.linkThickness}!important;text-underline-offset:.18em!important}
${R} :is(${items},${cells}) [data-prism-title],${R} :is(${items},${cells}) [data-prism-title] *{font-family:${t.fontHeading}!important;font-size:20px!important;font-weight:${Math.max(600, t.headingWeight)}!important;line-height:1.2!important;letter-spacing:${t.headingSpacing}!important;color:${t.text}!important;display:inline!important}
${R} :is(${items},${cells}) [data-prism-price]{display:inline-flex!important;align-items:center!important;padding:3px 10px!important;border-radius:999px!important;background:${t.priceBg}!important;color:${t.priceText}!important;font-weight:700!important;font-size:15px!important;text-decoration:none!important;margin-top:2px!important}
${R} :is(${items},${cells}) [data-prism-price] *{color:inherit!important;background:transparent!important;font-size:inherit!important;text-decoration:none!important}
${R} :is(${items},${cells}) img{max-width:100%!important;height:auto!important;border-radius:calc(${t.radiusCard} - 6px)!important;align-self:center!important;object-fit:contain!important}
${R} :is(${items},${cells}) img[width][height]{width:auto!important}
${R} [data-prism-hidden]{display:none!important}
${R} prism-text{display:block;font-family:${t.fontBody};font-size:16px;font-weight:600;color:${t.text}}
${R} :is(${items},${cells}) [data-prism-c=field]{width:100%!important}
${R} table[data-prism-layout=table-grid]{display:block!important;width:auto!important;max-width:1280px!important;margin:24px auto!important;border:0!important;background:transparent!important}
${R} table[data-prism-layout=table-grid]>tbody{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))!important;gap:22px!important;padding:0 28px!important}
${R} table[data-prism-layout=table-grid]>tbody>tr{display:contents!important}
${R} ${cells}{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:10px!important;padding:20px!important;width:auto!important;height:auto!important;${card}}
`;
}
