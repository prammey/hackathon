/**
 * How much Prism changes a page. By default Prism keeps a site's own design and fixes what's hard
 * (small text, low contrast, clutter, a buried next step): reviews of 60 real sites showed that
 * repainting a modern site makes it worse far more often than better. The full Style makeover runs
 * by itself only on genuinely old or chaotic pages, and anywhere the person switches it on.
 */
export type Touch = "full" | "light";

export function detectTouch(layoutMode: string): Touch {
  if (layoutMode !== "refine") return "full"; // pinned canvases and layout tables need the reflow
  const legacyTags = document.querySelectorAll("font,center,marquee,blink,[bgcolor],table[width],td[width],body[link],body[vlink]").length;
  const nestedTables = document.querySelectorAll("table table").length;
  return legacyTags >= 8 || nestedTables >= 3 ? "full" : "light";
}
