/**
 * How much Prism changes a page. By default Prism keeps a site's own design and fixes what's hard
 * (small text, low contrast, clutter, a buried next step): reviews of 60 real sites showed that
 * repainting a modern site makes it worse far more often than better. The full Style makeover runs
 * by itself only on genuinely old or chaotic pages, and anywhere the person switches it on.
 */
export type Touch = "full" | "light";

export function detectTouch(layoutMode: string): Touch {
  const oldTags = document.querySelectorAll("font,center,marquee,blink,[bgcolor],body[link],body[vlink]").length;
  const sizedTables = document.querySelectorAll("table[width],td[width]").length;
  const nestedTables = document.querySelectorAll("table table").length;
  const barelyStyled = document.styleSheets.length <= 2 && !document.querySelector("meta[name=viewport]");
  if (layoutMode === "canvas" || layoutMode === "restructure" && document.querySelector("[data-prism-layout=canvas]")) return "full";
  // Tables used for layout on a modern site (Amazon product pages) are not a sign of an old page.
  const old = oldTags >= 8 || (oldTags >= 3 && sizedTables >= 3) || nestedTables >= 3 || barelyStyled;
  return old ? "full" : "light";
}
