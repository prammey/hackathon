/**
 * Chat "emphasize": makes chosen parts of the page easy to spot (bigger, bold, highlighter colour, a
 * breathing outline). Works whether or not the page is tidied, because it uses its own stylesheet.
 */
const ATTR = "data-prism-spotlight";
// Repeated so these rules outrank the tidy Style's control rules (both are !important).
const SEL = `:root:root [${ATTR}][${ATTR}][${ATTR}][${ATTR}][${ATTR}]`;

function css(reducedMotion: boolean): string {
  const ring = reducedMotion ? "" : "animation:prism-spot 1.6s ease-in-out infinite!important;";
  return `
${SEL}{background:#FFE866!important;color:#111111!important;-webkit-text-fill-color:#111111!important;font-weight:700!important;font-size:max(1.2em,18px)!important;padding:.2em .45em!important;border-radius:8px!important;outline:4px solid #6D4AFF!important;outline-offset:4px!important;text-decoration:underline!important;scroll-margin:120px!important;${ring}}
${SEL} *{color:#111111!important;-webkit-text-fill-color:#111111!important}
${SEL}:is(a,span,label,button){display:inline-block!important;margin:14px 0!important;line-height:1.3!important}
${SEL}:is(a[href]):visited{color:#111111!important}
@keyframes prism-spot{0%,100%{outline-offset:4px;outline-color:#6D4AFF}50%{outline-offset:10px;outline-color:#6D4AFF66}}`;
}

export function spotlightCount(): number {
  return document.querySelectorAll(`[${ATTR}]`).length;
}

export async function spotlight(elements: Element[]): Promise<void> {
  clearSpotlight(false);
  if (!elements.length) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  await chrome.runtime.sendMessage({ type: "css:apply", key: "spotlight", css: css(reduced) }).catch(() => {});
  for (const el of elements) el.setAttribute(ATTR, "");
  elements[0].scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  dispatchEvent(new CustomEvent("prism:spotlight"));
}

export function clearSpotlight(removeSheet = true): void {
  for (const el of document.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
  if (removeSheet) chrome.runtime.sendMessage({ type: "css:remove", key: "spotlight" }).catch(() => {});
  dispatchEvent(new CustomEvent("prism:spotlight"));
}
