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
};

export const STYLES: Record<StyleId, StyleTokens> = {
  bold: {
    id: "bold", name: "Bold", tagline: "Strong shapes and big, clear blocks",
    fontBody: FONT_STACKS.grotesk, fontHeading: FONT_STACKS.grotesk, headingWeight: 700,
    headingSpacing: "-0.01em", scale: { h1: 2.4, h2: 1.75, h3: 1.35, h4: 1.15 }, lh: 1.55, lhHeading: 1.1,
    gap: "1em",
    bg: "#FFF8E7", band: "#FFD43B", bandBorder: "3px solid #0F0F0F",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "3px solid #0F0F0F", cardShadow: "4px 4px 0 #0F0F0F",
    text: "#0F0F0F", muted: "#333333", divider: "#0F0F0F", control: "#0F0F0F", controlWidth: "3px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#1F2EDB", onPrimary: "#FFFFFF", primaryBorder: "#0F0F0F", primaryShadow: "4px 4px 0 #0F0F0F",
    buttonBg: "#FFFFFF", buttonText: "#0F0F0F", buttonBorder: "#0F0F0F", buttonShadow: "3px 3px 0 #0F0F0F",
    pressTransform: "translate(2px, 2px)", pressShadow: "1px 1px 0 #0F0F0F",
    link: "#1F2EDB", linkThickness: "2px",
    danger: "#B00020", success: "#0B6B3A",
    noticeBg: "#FFD43B", noticeBorder: "3px solid #0F0F0F", noticeLeft: "3px solid #0F0F0F",
    noticeShadow: "4px 4px 0 #0F0F0F",
    radiusControl: "0px", radiusCard: "0px",
    focusOutline: "4px solid #0F0F0F", focusShadow: "0 0 0 8px #FFD43B",
    motion: "80ms linear",
    headingAccent: "inset 0 -0.3em 0 #A7F0CF",
    preview: { swatches: ["#FFF8E7", "#FFD43B", "#1F2EDB", "#0F0F0F"] },
  },
  calm: {
    id: "calm", name: "Calm", tagline: "Quiet, spacious and refined",
    fontBody: FONT_STACKS.inter, fontHeading: FONT_STACKS.serif, headingWeight: 600, headingSpacing: "0",
    scale: { h1: 2.2, h2: 1.6, h3: 1.3, h4: 1.12 }, lh: 1.65, lhHeading: 1.2, gap: "1.4em",
    bg: "#FAFAF7", band: "#FAFAF7", bandBorder: "1px solid #E2E2DC",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "1px solid #E2E2DC", cardShadow: "none",
    text: "#1C1C1E", muted: "#56585E", divider: "#E2E2DC", control: "#8A8D93", controlWidth: "1.5px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#1E5E5A", onPrimary: "#FFFFFF", primaryBorder: "#1E5E5A", primaryShadow: "none",
    buttonBg: "#FFFFFF", buttonText: "#1E5E5A", buttonBorder: "#8A8D93", buttonShadow: "none",
    pressTransform: "none", pressShadow: "none",
    link: "#1E5E5A", linkThickness: "1px",
    danger: "#A8261B", success: "#1E6B3D",
    noticeBg: "transparent", noticeBorder: "0 solid transparent", noticeLeft: "3px solid #1E5E5A",
    noticeShadow: "none",
    radiusControl: "6px", radiusCard: "10px",
    focusOutline: "3px solid #1E5E5A", focusShadow: "none",
    motion: "150ms ease-out",
    headingAccent: "none",
    preview: { swatches: ["#FAFAF7", "#FFFFFF", "#1E5E5A", "#1C1C1E"] },
  },
  soft: {
    id: "soft", name: "Soft", tagline: "Gentle raised surfaces you can still see clearly",
    fontBody: FONT_STACKS.nunito, fontHeading: FONT_STACKS.nunito, headingWeight: 800, headingSpacing: "0",
    scale: { h1: 2.3, h2: 1.7, h3: 1.33, h4: 1.13 }, lh: 1.6, lhHeading: 1.2, gap: "1.1em",
    bg: "#E6EBF2", band: "#E6EBF2", bandBorder: "0 solid transparent",
    surface: "#E6EBF2", card: "#E6EBF2", cardBorder: "1px solid rgba(111,122,144,0.25)",
    cardShadow: "-6px -6px 14px rgba(255,255,255,0.85), 6px 6px 14px rgba(150,164,190,0.55)",
    text: "#1D2433", muted: "#465068", divider: "#C3CBD8", control: "#6F7A90", controlWidth: "1.5px",
    field: "#E6EBF2",
    fieldShadow: "inset 3px 3px 7px rgba(150,164,190,0.55), inset -3px -3px 7px rgba(255,255,255,0.9)",
    primary: "#3550C8", onPrimary: "#FFFFFF", primaryBorder: "#2B44B0",
    primaryShadow: "-4px -4px 10px rgba(255,255,255,0.8), 4px 4px 10px rgba(150,164,190,0.6)",
    buttonBg: "#E6EBF2", buttonText: "#1D2433", buttonBorder: "#6F7A90",
    buttonShadow: "-4px -4px 10px rgba(255,255,255,0.85), 4px 4px 10px rgba(150,164,190,0.55)",
    pressTransform: "none",
    pressShadow: "inset 3px 3px 7px rgba(150,164,190,0.6), inset -3px -3px 7px rgba(255,255,255,0.9)",
    link: "#2B44B0", linkThickness: "1.5px",
    danger: "#A3221A", success: "#14663F",
    noticeBg: "#E6EBF2", noticeBorder: "1px solid rgba(111,122,144,0.35)", noticeLeft: "5px solid #3550C8",
    noticeShadow: "-6px -6px 14px rgba(255,255,255,0.85), 6px 6px 14px rgba(150,164,190,0.55)",
    radiusControl: "14px", radiusCard: "22px",
    focusOutline: "3px solid #1D2433", focusShadow: "0 0 0 6px rgba(53,80,200,0.35)",
    motion: "180ms ease-in-out",
    headingAccent: "none",
    preview: { swatches: ["#E6EBF2", "#F7F9FC", "#3550C8", "#1D2433"] },
  },
  clear: {
    id: "clear", name: "Clear", tagline: "Crisp, simple and easy to read",
    fontBody: FONT_STACKS.atkinson, fontHeading: FONT_STACKS.atkinson, headingWeight: 700, headingSpacing: "0",
    scale: { h1: 2.2, h2: 1.6, h3: 1.3, h4: 1.12 }, lh: 1.6, lhHeading: 1.2, gap: "1em",
    bg: "#FFFFFF", band: "#F3F5F8", bandBorder: "1px solid #D9DEE5",
    surface: "#FFFFFF", card: "#F3F5F8", cardBorder: "1px solid #D9DEE5", cardShadow: "none",
    text: "#17202A", muted: "#4B5563", divider: "#D9DEE5", control: "#7C8794", controlWidth: "2px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#0A5BD3", onPrimary: "#FFFFFF", primaryBorder: "#0A5BD3", primaryShadow: "none",
    buttonBg: "#FFFFFF", buttonText: "#0A5BD3", buttonBorder: "#0A5BD3", buttonShadow: "none",
    pressTransform: "none", pressShadow: "none",
    link: "#0A55C4", linkThickness: "1.5px",
    danger: "#C01F1F", success: "#0E7A4E",
    noticeBg: "#EEF4FE", noticeBorder: "1px solid #C9DAF8", noticeLeft: "5px solid #0A5BD3",
    noticeShadow: "none",
    radiusControl: "8px", radiusCard: "12px",
    focusOutline: "3px solid #0A5BD3", focusShadow: "0 0 0 5px #FFFFFF",
    motion: "120ms ease-out",
    headingAccent: "none",
    preview: { swatches: ["#FFFFFF", "#F3F5F8", "#0A5BD3", "#17202A"] },
  },
};

export const STYLE_ORDER: StyleId[] = ["clear", "bold", "calm", "soft"];

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
${P} ${button}{font-family:${t.fontBody}!important;font-weight:700!important;font-size:max(1em,16px)!important;line-height:1.2!important;min-height:var(--p-target)!important;padding:.5em 1.05em!important;border-radius:${t.radiusControl}!important;border:${t.controlWidth} solid ${t.buttonBorder}!important;background:${t.buttonBg}!important;background-image:none!important;color:${t.buttonText}!important;box-shadow:${t.buttonShadow}!important;text-decoration:none!important;text-shadow:none!important;cursor:pointer!important;transition:transform ${t.motion},box-shadow ${t.motion},filter ${t.motion}!important;box-sizing:border-box!important}
${P} ${button} *{color:inherit!important}
${P} [data-prism-c=icon-button]{min-width:var(--p-target)!important;min-height:var(--p-target)!important;border-radius:${t.radiusControl}!important;color:${t.text}!important}
${P} ${button}:hover{filter:brightness(0.94)!important}
${P} ${button}:active{transform:${t.pressTransform}!important;box-shadow:${t.pressShadow}!important}
${P} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(${button.slice(4, -1)},button,input[type=submit]){background:${t.primary}!important;color:${t.onPrimary}!important;border-color:${t.primaryBorder}!important;box-shadow:${t.primaryShadow}!important;font-size:max(1.05em,17px)!important}
${P} :is(button,input[type=submit],input[type=button],input[type=reset])[disabled]{opacity:1!important;filter:none!important;background:${t.surface}!important;color:${t.muted}!important;border-style:dashed!important;cursor:not-allowed!important;box-shadow:none!important}
${P} [data-prism-c=field]{font-family:${t.fontBody}!important;font-size:max(1em,17px)!important;color:${t.text}!important;background-color:${t.field}!important;border:${t.controlWidth} solid ${t.control}!important;border-radius:${t.radiusControl}!important;min-height:var(--p-target)!important;padding:.4em .7em!important;box-shadow:${t.fieldShadow}!important;box-sizing:border-box!important}
${P} textarea[data-prism-c=field]{min-height:5em!important}
${P} [data-prism-c=field]::placeholder{color:${t.muted}!important;opacity:1!important}
${P} [data-prism-c=field][aria-invalid=true]{border-color:${t.danger}!important;border-width:3px!important}
${P} [data-prism-c=check]{accent-color:${t.primary}!important;width:1.35em!important;height:1.35em!important;min-width:1.35em!important;cursor:pointer!important}
${P} :is([data-prism-role=notice],[data-prism-role=required-notice]){background:${t.noticeBg}!important;background-image:none!important;color:${t.text}!important;border:${t.noticeBorder}!important;border-left:${t.noticeLeft}!important;border-radius:${t.radiusCard === "0px" ? "0" : t.radiusControl}!important;box-shadow:${t.noticeShadow}!important;padding:.9em 1.1em!important}
${P} [data-prism-role=error]{color:${t.danger}!important;font-weight:700!important;border-left:5px solid ${t.danger}!important;padding-left:.7em!important}
${P} [data-prism-role=error] *{color:inherit!important}
${P} [data-prism-emphasis=primary]:not(${button.slice(4, -1)}):not(button):not(input){outline:3px solid ${t.primary}!important;outline-offset:6px!important;border-radius:${t.radiusControl}!important}
${P} [data-prism-emphasis=quiet]{opacity:.78!important}
${P} [data-prism-role=clutter]:not([data-prism-collapsed]){opacity:.5!important;filter:grayscale(.7)!important;transition:opacity ${t.motion}!important}
${P} [data-prism-role=clutter]:not([data-prism-collapsed]):is(:hover,:focus-within){opacity:1!important;filter:none!important}
${P} [data-prism-collapsed]:not([data-prism-open]){display:none!important}
${P} [data-prism-step-active]{outline:4px solid ${t.primary}!important;outline-offset:6px!important;border-radius:${t.radiusControl}!important}
${P} :is(main,[data-prism-role=main],article) table${notKeep}{border-collapse:collapse!important;background:${t.surface}!important}
${P} :is(main,[data-prism-role=main],article) :is(td,th)${notKeep}{padding:.5em .75em!important;border:1px solid ${t.divider}!important;text-align:start!important}
${P} :is(main,[data-prism-role=main],article) th${notKeep}{background:${t.card}!important;font-weight:700!important}
${P} :is(main,[data-prism-role=main],article) img{max-width:100%!important;height:auto!important}
${P} hr{border:0!important;border-top:${t.id === "bold" ? "3px solid #0F0F0F" : `1px solid ${t.divider}`}!important}
${P} :focus-visible{outline:${t.focusOutline}!important;outline-offset:3px!important;box-shadow:${t.focusShadow}!important}
${motion ? `${P} *,${P} *::before,${P} *::after{animation-duration:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;scroll-behavior:auto!important}` : ""}
`;
}
