import { k } from "./i18n";
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
  /** Typing fields get their own outline so they never look like buttons. */
  fieldBorder: string;
  fieldBorderWidth: string;
  fieldRadius: string;
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
    id: "clear", name: "Clean Flat", tagline: k("Crisp shapes, clear colours, nothing extra"),
    fontBody: FONT_STACKS.inter, fontHeading: FONT_STACKS.inter, headingWeight: 700, headingSpacing: "-0.02em",
    scale: { h1: 2.2, h2: 1.6, h3: 1.28, h4: 1.1 }, lh: 1.6, lhHeading: 1.15, gap: "1em",
    bg: "#F6F7FB", band: "#FFFFFF", bandBorder: "1px solid #E4E8F0",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "1px solid #E4E8F0", cardShadow: "0 1px 2px rgba(16,24,40,0.05), 0 4px 16px rgba(16,24,40,0.05)",
    text: "#0F172A", muted: "#475569", divider: "#E4E8F0", control: "#7C8899", controlWidth: "1.5px",
    fieldBorder: "#4F7BEA", fieldBorderWidth: "2px", fieldRadius: "12px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#2754E6", onPrimary: "#FFFFFF", primaryBorder: "#2754E6", primaryShadow: "0 4px 12px rgba(39,84,230,0.25)",
    buttonBg: "#EEF2FF", buttonText: "#1E40C8", buttonBorder: "#D9E0FE", buttonShadow: "0 1px 2px rgba(16,24,40,0.08), 0 4px 10px rgba(39,84,230,0.14)",
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
    id: "bold", name: "Neo-Brutalist", tagline: k("Chunky type, firm outlines and soft blocks of colour"),
    fontBody: FONT_STACKS.grotesk, fontHeading: FONT_STACKS.grotesk, headingWeight: 700,
    headingSpacing: "-0.02em", scale: { h1: 2.4, h2: 1.75, h3: 1.32, h4: 1.13 }, lh: 1.55, lhHeading: 1.1,
    gap: "1em",
    // Calm base (cream + white); colour comes from a soft pastel spread used sparingly, not one loud yellow.
    bg: "#FBF6EC", band: "#FFFFFF", bandBorder: "2.5px solid #1A1A1A",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "2.5px solid #1A1A1A", cardShadow: "4px 4px 0 #1A1A1A",
    text: "#1A1A1A", muted: "#3D3D3D", divider: "#1A1A1A", control: "#1A1A1A", controlWidth: "2.5px",
    fieldBorder: "#3730C9", fieldBorderWidth: "2.5px", fieldRadius: "12px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#4F46E5", onPrimary: "#FFFFFF", primaryBorder: "#1A1A1A", primaryShadow: "3px 3px 0 #1A1A1A",
    buttonBg: "#FFE9A8", buttonText: "#1A1A1A", buttonBorder: "#1A1A1A", buttonShadow: "3px 3px 0 #1A1A1A",
    pressTransform: "translate(2px, 2px)", pressShadow: "1px 1px 0 #1A1A1A",
    link: "#3730C9", linkThickness: "2px",
    danger: "#B00020", success: "#0B6B3A",
    noticeBg: "#FDE2EC", noticeBorder: "2.5px solid #1A1A1A", noticeLeft: "2.5px solid #1A1A1A",
    noticeShadow: "4px 4px 0 #1A1A1A",
    radiusControl: "12px", radiusCard: "16px",
    focusOutline: "3px solid #1A1A1A", focusShadow: "0 0 0 6px #FFE9A8",
    motion: "90ms ease-out",
    headingAccent: "inset 0 -0.3em 0 #C8F0DC",
    priceBg: "#C8F0DC", priceText: "#1A1A1A",
    preview: { swatches: ["#FBF6EC", "#FFE9A8", "#FDE2EC", "#C8F0DC"] },
  },
  calm: {
    id: "calm", name: "Modern Minimalist", tagline: k("Quiet, spacious and refined"),
    fontBody: FONT_STACKS.inter, fontHeading: FONT_STACKS.serif, headingWeight: 500, headingSpacing: "-0.01em",
    scale: { h1: 2.4, h2: 1.7, h3: 1.3, h4: 1.12 }, lh: 1.7, lhHeading: 1.15, gap: "1.5em",
    bg: "#FAFAF7", band: "#FAFAF7", bandBorder: "1px solid #E8E8E2",
    surface: "#FFFFFF", card: "#FFFFFF", cardBorder: "1px solid #ECECE6", cardShadow: "0 1px 0 rgba(0,0,0,0.02), 0 12px 32px rgba(17,17,17,0.04)",
    text: "#18181B", muted: "#55565C", divider: "#E8E8E2", control: "#8A8B91", controlWidth: "1px",
    fieldBorder: "#3D4F8F", fieldBorderWidth: "1.5px", fieldRadius: "12px",
    field: "#FFFFFF", fieldShadow: "none",
    primary: "#18181B", onPrimary: "#FFFFFF", primaryBorder: "#18181B", primaryShadow: "none",
    buttonBg: "#EFEFEA", buttonText: "#18181B", buttonBorder: "#E2E2DA", buttonShadow: "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.07)",
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
    id: "soft", name: "Neumorphism", tagline: k("Soft raised surfaces, with edges you can still see"),
    fontBody: FONT_STACKS.nunito, fontHeading: FONT_STACKS.nunito, headingWeight: 800, headingSpacing: "-0.01em",
    scale: { h1: 2.3, h2: 1.7, h3: 1.33, h4: 1.13 }, lh: 1.6, lhHeading: 1.18, gap: "1.15em",
    bg: "#E8ECF4", band: "#E8ECF4", bandBorder: "0 solid transparent",
    surface: "#E8ECF4", card: "#E8ECF4", cardBorder: "1px solid rgba(255,255,255,0.65)",
    cardShadow: "-8px -8px 18px rgba(255,255,255,0.9), 8px 8px 20px rgba(146,160,188,0.55)",
    text: "#1D2433", muted: "#465068", divider: "#C6CEDC", control: "#6F7A90", controlWidth: "1.5px",
    fieldBorder: "#4153DD", fieldBorderWidth: "1.5px", fieldRadius: "16px",
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

export const STYLE_ORDER: StyleId[] = ["soft", "clear", "calm", "bold"];

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
  // Full makeover only (old or chaotic pages); the light touch keeps a well-designed site's own look.
  const F = `${P}:not([data-prism-touch=light])`;
  const L = `${P}[data-prism-touch=light]`;
  // Text the analyzer measured as smaller than a size (data-prism-fs = its own px): only ever enlarged.
  const below = (px: number) => Array.from({ length: Math.max(0, px - 6) }, (_, i) => `[data-prism-fs="${i + 6}"]`).join(",");
  const chrome = ":is(nav,header,footer,[role=banner],[role=navigation],[role=contentinfo],[data-prism-role=nav],[data-prism-role=header],[data-prism-role=footer])";
  const lightFloor = Math.max(16, Math.round(16 * settings.textScale));
  const sizeRules = [
    `${F} :is(${below(base)}){font-size:var(--p-base)!important}`,
    // Bars and controls grow only to a modest minimum, so menus and buttons don't overflow their space.
    ...Array.from({ length: Math.max(0, base - 6) }, (_, i) => i + 6).map((px) =>
      `${F} :is(${chrome} [data-prism-fs="${px}"],[data-prism-c][data-prism-fs="${px}"],[data-prism-c] [data-prism-fs="${px}"]){font-size:${Math.max(px, 15)}px!important}`),
    `${L} :is(${below(15)}):not(${chrome} *):not([data-prism-c]):not([data-prism-c] *){font-size:${lightFloor}px!important}`,
  ].join("\n");
  const notKeep = ":not([data-prism-s=keep] *)";
  const text = `:is(p,li,dd,dt,td,th,blockquote,figcaption,label,legend,summary,caption)${notKeep}`;
  const heading = `:is(h1,h2,h3,h4,h5,h6,[role=heading])${notKeep}`;
  // Menu bars keep their own control shapes: chips there split dropdowns into pieces.
  const buttonList = "[data-prism-c=button],[data-prism-c=button-link]";
  const inNav = ":is(nav,[role=navigation],[role=menubar],[data-prism-role=nav]) *";
  // :where() keeps these exclusions from raising specificity (so the main-action rule still wins).
  const button = `:is(${buttonList}):where(:not(${inNav}):not([data-prism-own])${notKeep})`;
  const linkSel = `a[href]:not([data-prism-c]):not([role=button]):not([data-prism-role=primary-action]):not([data-prism-role=secondary-action]):not([data-prism-emphasis=primary])${notKeep}`;
  const motion = reducedMotion || settings.reduceMotion === "on";
  const dur = motion ? "0s" : t.motion;
  const motionOk = !motion;

  return `
${sizeRules}
${F}{--p-base:${base}px;--p-target:${target};color-scheme:light!important;background:${t.bg}!important;${motion ? "" : "scroll-behavior:smooth;"}}
${F} body{background:${t.bg}!important;color:${t.text}!important;font-family:${t.fontBody}!important}
${F} ${text}{font-family:${t.fontBody}!important;color:${t.text}!important;line-height:${t.lh}!important;letter-spacing:normal!important;word-spacing:normal!important}
${F} :is(main,[data-prism-role=main],article) :is(p,ul,ol,blockquote,dl)${notKeep}{margin-block:0 ${t.gap}!important}
${F} :is(main,[data-prism-role=main],article) p${notKeep}{max-width:70ch!important}
${F} :is(main,[data-prism-role=main],article) li${notKeep}{margin-block:.3em!important}
${F} ${heading}{font-family:${t.fontHeading}!important;color:${t.text}!important;line-height:${t.lhHeading}!important;font-weight:${t.headingWeight}!important;letter-spacing:${t.headingSpacing}!important;text-transform:none!important}
${F} :is(main,[data-prism-role=main],article) h1[data-prism-hs]${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h1}))!important;margin-block:.5em .45em!important;box-shadow:${t.headingAccent}!important}
${F} :is(main,[data-prism-role=main],article) h2[data-prism-hs]${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h2}))!important;margin-block:1.2em .45em!important}
${F} :is(main,[data-prism-role=main],article) h3[data-prism-hs]${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h3}))!important;margin-block:1em .4em!important}
${F} :is(main,[data-prism-role=main],article) :is(h4,h5,h6)[data-prism-hs]${notKeep}{font-size:max(1em,calc(var(--p-base) * ${t.scale.h4}))!important}
${F} ${linkSel}{color:${t.link}!important;${settings.underlineLinks ? `text-decoration:underline!important;text-decoration-thickness:${t.linkThickness}!important;text-underline-offset:.2em!important;` : ""}}
${F} :is(nav,[data-prism-role=nav],header,[data-prism-role=header]) ${linkSel}{text-decoration:none!important;font-weight:600!important}
${F} ${linkSel}:hover{text-decoration-thickness:3px!important}
${F} :is([data-prism-role=notice],[data-prism-role=required-notice],[data-prism-role=error]){line-height:${t.lh}!important}
${F} [data-prism-s=band]{background:${t.band}!important;background-image:none!important;color:${t.text}!important;border-bottom:${t.bandBorder}!important;box-shadow:none!important}
${F} [data-prism-s=card]{background:${t.card}!important;background-image:none!important;color:${t.text}!important;border:${t.cardBorder}!important;box-shadow:${t.cardShadow}!important;border-radius:${t.radiusCard}!important}
${F} [data-prism-s=plain]{background:${t.surface}!important;background-image:none!important;color:${t.text}!important}
${F} [data-prism-s=card]{box-sizing:border-box!important;max-width:100%!important}
${F} [data-prism-s=card][data-prism-pad]{padding:14px 16px!important}
${F} :is([data-prism-s=card],[data-prism-s=band],[data-prism-role=notice],[data-prism-role=required-notice],[data-prism-c=button-link]) :is(img,video,iframe,picture,canvas,object,embed){max-width:100%!important;object-fit:contain!important;box-sizing:border-box!important}
${F} [data-prism-s=card] > :is(img,picture,video):first-child{border-radius:calc(${t.radiusCard} - 6px)!important}
${F} :is([data-prism-s=band],[data-prism-s=card],[data-prism-s=plain]) :is(span,div,strong,b,em,small,time)${notKeep}{color:inherit}
${F} ${button}{font-family:${t.fontBody}!important;font-weight:700!important;font-size:max(1em,16px)!important;line-height:1.2!important;min-height:var(--p-target)!important;padding:.5em 1.05em!important;border-radius:${t.radiusControl}!important;border:${t.controlWidth} solid ${t.buttonBorder}!important;background:${t.buttonBg}!important;background-image:none!important;color:${t.buttonText}!important;box-shadow:${t.buttonShadow}!important;text-decoration:none!important;text-shadow:none!important;cursor:pointer!important;transition:transform ${dur},box-shadow ${dur},filter ${dur}!important;box-sizing:border-box!important}
${F} ${button} *{color:inherit!important}
${F} :is([data-prism-c=button-link],[data-prism-tight]){box-shadow:none!important}
${F} :is(p,li,td,label,span,small) > [data-prism-c=button-link]{padding:.15em .5em!important;min-height:0!important}
${F} [data-prism-c=icon-button]:where(:not(${inNav}):not([data-prism-own])){min-width:var(--p-target)!important;min-height:var(--p-target)!important;border-radius:${t.radiusControl}!important;color:${t.buttonText}!important;background:${t.buttonBg === "transparent" ? t.surface : t.buttonBg}!important;border:1px solid ${t.buttonBorder}!important}
${F} [data-prism-c=icon-button]:where(:not(${inNav}):not([data-prism-own])) *{color:inherit!important}
${F} ${button}:hover{filter:brightness(0.94)!important}
${F} ${button}:active{transform:${t.pressTransform}!important;box-shadow:${t.pressShadow}!important}
${F} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,input[type=submit],input[type=button],[role=button]){display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:.55em!important;background:${t.primary}!important;background-image:none!important;color:${t.onPrimary}!important;-webkit-text-fill-color:${t.onPrimary}!important;border:${t.controlWidth} solid ${t.primaryBorder}!important;box-shadow:${t.primaryShadow}${motionOk ? `,0 0 0 0 ${t.primary}55` : ""}!important;font-family:${t.fontHeading}!important;font-weight:700!important;line-height:1.2!important;max-width:100%!important;box-sizing:border-box!important;height:auto!important;white-space:normal!important;text-align:center!important;border-radius:${t.radiusControl}!important;text-decoration:none!important;margin-block:.4em!important;cursor:pointer!important;${motionOk ? "animation:prism-breathe 2.6s ease-in-out infinite!important;" : ""}}
${F} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,input[type=submit],input[type=button],[role=button]):not(:is(header,[role=banner],[data-prism-role=header],nav,[role=navigation]) *){font-size:max(20px,1.2em)!important;min-height:56px!important;padding:.8em 1.6em!important}
${F} :is(header,[role=banner],[data-prism-role=header],nav,[role=navigation]) :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,input[type=submit],input[type=button],[role=button]){padding:.45em 1em!important;min-height:40px!important}
${F} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,[role=button])::after{content:"→";font-size:1.05em;transition:transform ${dur}}
${F} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,[role=button]):hover::after{transform:translateX(4px)}
${F} :is([data-prism-role=primary-action],[data-prism-emphasis=primary]):is(a[href],button,input,[role=button]) *{color:inherit!important;-webkit-text-fill-color:inherit!important}
${F} [data-prism-role=secondary-action]:is(a[href],button,[role=button]):where(:not([data-prism-own])):not([data-prism-c=icon-button]):not([data-prism-c=bg-icon]):not([data-prism-emphasis=primary]):not(${inNav}){display:inline-flex!important;align-items:center!important;min-height:44px!important;box-sizing:border-box!important;padding:.45em 1.05em!important;line-height:1.25!important;border:${t.controlWidth} solid ${t.buttonBorder}!important;border-radius:${t.radiusControl}!important;background:${t.buttonBg === "transparent" ? t.surface : t.buttonBg}!important;color:${t.buttonText}!important;font-weight:650!important;text-decoration:none!important;font-size:max(1em,16px)!important}
${visitedCss(t, F, linkSel)}
${F} [data-prism-c=bg-icon]:where(:not([data-prism-own])){background-color:${t.primary}!important;border-radius:${t.radiusControl}!important;min-width:44px!important;min-height:44px!important}
${P} [data-prism-next]{outline:3px solid ${t.primary}!important;outline-offset:5px!important;${motionOk ? "animation:prism-ring 1.8s ease-in-out infinite!important;" : ""}}
${P} [data-prism-next][data-prism-next][data-prism-next]:is([data-prism-role=primary-action],[data-prism-emphasis=primary]){${motionOk ? "animation:prism-ring 1.8s ease-in-out infinite,prism-breathe 2.6s ease-in-out infinite!important;" : ""}}
@keyframes prism-ring{0%,100%{outline-offset:4px;outline-color:${t.primary}}50%{outline-offset:10px;outline-color:${t.primary}66}}
@keyframes prism-breathe{0%,100%{box-shadow:${t.primaryShadow === "none" ? "0 0 0 0 transparent" : t.primaryShadow},0 0 0 0 ${t.primary}40}50%{box-shadow:${t.primaryShadow === "none" ? "0 0 0 0 transparent" : t.primaryShadow},0 0 0 10px ${t.primary}00}}
${F} :is(button,input[type=submit],input[type=button],input[type=reset])[disabled]{opacity:1!important;filter:none!important;background:${t.surface}!important;color:${t.muted}!important;border-style:dashed!important;cursor:not-allowed!important;box-shadow:none!important}
${F} [data-prism-c=field]:where(:not([data-prism-own])){font-family:${t.fontBody}!important;font-size:max(1em,17px)!important;color:${t.text}!important;background-color:${t.field}!important;border:${t.fieldBorderWidth} solid ${t.fieldBorder}!important;border-radius:${t.fieldRadius}!important;min-height:var(--p-target)!important;padding-block:.4em!important;padding-inline:.75em!important;box-shadow:${t.fieldShadow}!important;box-sizing:border-box!important;cursor:text!important}
${F} select[data-prism-c=field]:where(:not([data-prism-own])){padding-right:2.2em!important;cursor:pointer!important}
${F} [data-prism-c=field]:where(:not([data-prism-own])):focus{border-color:${t.primary}!important;box-shadow:${t.fieldShadow === "none" ? "" : `${t.fieldShadow},`}0 0 0 4px ${t.primary}33!important;outline:none!important}
${F} textarea[data-prism-c=field],${F} select[data-prism-c=field]:where(:not([data-prism-own]))[multiple]{min-height:5em!important;border-radius:min(${t.fieldRadius},18px)!important}
${F} :is(${buttonList},[data-prism-c=field],[data-prism-c=icon-button])[data-prism-tight]:where(:not([data-prism-own])){font-size:max(1em,14px)!important;padding-block:.25em!important;padding-inline:.6em!important;min-height:32px!important;min-width:0!important;max-width:100%!important;line-height:1.2!important}
${F} select[data-prism-c=field]:where(:not([data-prism-own]))[data-prism-tight]{padding-right:2em!important}
${F} [data-prism-c=field]:where(:not([data-prism-own])){max-width:100%!important}
${F} [data-prism-c=field]:where(:not([data-prism-own]))::placeholder{color:${t.muted}!important;opacity:1!important}
${F} [data-prism-c=field]:where(:not([data-prism-own]))[aria-invalid=true]{border-color:${t.danger}!important;border-width:3px!important}
${F} [data-prism-c=check]:where(:not([data-prism-own])){accent-color:${t.primary}!important;width:1.35em!important;height:1.35em!important;min-width:1.35em!important;cursor:pointer!important}
${F} :is([data-prism-role=notice],[data-prism-role=required-notice]):not([data-prism-s=keep]){background:${t.noticeBg}!important;background-image:none!important;color:${t.text}!important;border:${t.noticeBorder}!important;border-left:${t.noticeLeft}!important;border-radius:calc(${t.radiusCard} - 4px)!important;box-shadow:${t.noticeShadow}!important;padding:1em 1.2em!important;box-sizing:border-box!important;max-width:100%!important}
${F} [data-prism-role=error]{color:${t.danger}!important;font-weight:700!important;border-left:5px solid ${t.danger}!important;padding-left:.7em!important}
${F} [data-prism-role=error] *{color:inherit!important}
${F} [data-prism-emphasis=quiet]{font-size:.94em!important}
${P} [data-prism-role=clutter]:not([data-prism-open]){display:none!important}
${P} [data-prism-collapsed]:not([data-prism-open]){display:none!important}
${P} [data-prism-step-active]{outline:4px solid ${t.primary}!important;outline-offset:6px!important;border-radius:${t.radiusControl}!important}
${F} :is(main,[data-prism-role=main],article) table${notKeep}{border-collapse:collapse!important;background:${t.surface}!important}
${F} :is(main,[data-prism-role=main],article) :is(td,th)${notKeep}{padding:.5em .75em!important;border:1px solid ${t.divider}!important;text-align:start!important;background-color:transparent!important}
${F} :is(main,[data-prism-role=main],article) th${notKeep}{background:${t.card}!important;font-weight:700!important}
${F} :is(main,[data-prism-role=main],article) img{max-width:100%!important;object-fit:contain!important}
${F} :is(main,[data-prism-role=main],article,[data-prism-s=card],[data-prism-s=band]) :is(img,video)[height]{height:auto!important}
${F} hr{border:0!important;border-top:${t.id === "bold" ? "3px solid #0F0F0F" : `1px solid ${t.divider}`}!important}
${F} :focus-visible{outline:${t.focusOutline}!important;outline-offset:3px!important;box-shadow:${t.focusShadow}!important}
${P} [data-prism-fix=dark][data-prism-fix]{color:${t.text}!important;-webkit-text-fill-color:${t.text}!important;text-shadow:none!important;opacity:1!important}
${P} [data-prism-fix=light][data-prism-fix]{color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;text-shadow:none!important;opacity:1!important}
${P} [data-prism-fix=media][data-prism-fix]{color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 12px rgba(0,0,0,.5)!important;opacity:1!important}
${F} [data-prism-fixbox][data-prism-fixbox]{outline:1px solid ${t.divider}!important;outline-offset:-1px!important;border-radius:${t.radiusControl === "999px" ? "14px" : t.radiusControl}!important}
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

/**
 * Browsers paint visited links using only colour rules that themselves match :visited (a privacy
 * protection), so every link treatment needs a :visited twin or a visited link can end up with white
 * text on a white button. These rules make visited links look exactly like unvisited ones.
 */
function visitedCss(t: StyleTokens, P: string, linkSel: string): string {
  const hero = `a[href]:is([data-prism-role=primary-action],[data-prism-emphasis=primary])`;
  const secondary = `a[href][data-prism-role=secondary-action]:not([data-prism-emphasis=primary])`;
  const btn = `a[href][data-prism-c=button-link]:not([data-prism-role=primary-action]):not([data-prism-emphasis=primary])`;
  const plainLink = linkSel.replace("a[href]", "a[href]:visited");
  return `
${P} ${plainLink}{color:${t.link}!important}
${P} ${btn}:visited{color:${t.buttonText}!important;background-color:${t.buttonBg === "transparent" ? t.surface : t.buttonBg}!important;border-color:${t.buttonBorder}!important}
${P} ${secondary}:visited{color:${t.buttonText}!important;background-color:${t.buttonBg === "transparent" ? t.surface : t.buttonBg}!important;border-color:${t.buttonBorder}!important}
${P} ${hero}:visited{color:${t.onPrimary}!important;background-color:${t.primary}!important;border-color:${t.primaryBorder}!important;outline-color:${t.primary}!important}
${P} a[href][data-prism-fix=dark]:visited{color:${t.text}!important}
${P} a[href]:is([data-prism-fix=light],[data-prism-fix=media]):visited{color:#FFFFFF!important}
${P}[data-prism-mode=restructure] :is([data-prism-layout=canvas]>[data-prism-item],table[data-prism-layout=table-grid]>tbody>tr>td) a[href]:visited{color:${t.link}!important}`;
}
