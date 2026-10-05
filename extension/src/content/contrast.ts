/**
 * Contrast repair. After Prism styles a page, some text can still end up hard to read: white text that
 * relied on a dark page background, grey site text on a grey surface, coloured text on a box of the
 * same colour. This pass measures the real rendered colours and fixes anything below WCAG AA by tagging
 * it; the Style's CSS then forces dark ink or white. Boxes that blend into their surroundings get an
 * outline. Everything is attribute-based, so restoring the page removes it.
 */

const FIX = "data-prism-fix";
const FIXBOX = "data-prism-fixbox";

interface RGBA { r: number; g: number; b: number; a: number }

function parse(color: string): RGBA | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

function luminance({ r, g, b }: RGBA): number {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function ratio(a: RGBA, b: RGBA): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function blend(top: RGBA, under: RGBA): RGBA {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}

const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };

/** The colour actually behind an element: nearest opaque-ish background, or null over an image. */
function backgroundOf(el: Element, cache: Map<Element, RGBA | null>): RGBA | null {
  if (cache.has(el)) return cache.get(el)!;
  const cs = getComputedStyle(el);
  let result: RGBA | null;
  if (cs.backgroundImage && cs.backgroundImage.includes("url(")) {
    result = null; // text over a photo: can't measure, leave it (the Style keeps those as-is)
  } else if (cs.backgroundImage.includes("gradient(")) {
    // A gradient band (common in site headers) counts as the average of its colour stops.
    const stops = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])!).filter((c) => c.a > 0.05);
    result = stops.length
      ? { r: stops.reduce((s, c) => s + c.r, 0) / stops.length, g: stops.reduce((s, c) => s + c.g, 0) / stops.length, b: stops.reduce((s, c) => s + c.b, 0) / stops.length, a: 1 }
      : null;
  } else {
    const own = parse(cs.backgroundColor);
    const parentEl = el.parentElement ?? (el === document.body ? document.documentElement : null);
    const under = parentEl ? backgroundOf(parentEl, cache) : WHITE;
    if (own && own.a >= 0.99) result = own;
    else if (own && own.a > 0.05) result = under ? blend(own, under) : null;
    else result = el === document.documentElement ? (own && own.a > 0 ? own : WHITE) : under;
  }
  cache.set(el, result);
  return result;
}

/** Is a picture or video (not an ancestor's background) what's actually behind this text on screen? */
function overMedia(el: Element, r: DOMRect): boolean {
  const x = r.left + Math.min(r.width / 2, 40);
  const y = r.top + r.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  const own = parse(getComputedStyle(el).backgroundColor);
  if (own && own.a > 0.5) return false; // it brings its own solid background
  for (const hit of document.elementsFromPoint(x, y)) {
    if (hit === el || el.contains(hit) || hit.tagName === "PRISM-ROOT") continue;
    if (hit.matches("img,video,canvas,picture,iframe")) return true;
    const bg = parse(getComputedStyle(hit).backgroundColor);
    if (bg && bg.a > 0.5) return false;
  }
  return false;
}

function hasOwnText(el: Element): boolean {
  for (const n of el.childNodes) if (n.nodeType === 3 && (n.textContent ?? "").trim().length > 0) return true;
  return false;
}

export interface RepairStats { checked: number; fixed: number; boxes: number }

/** A gradient, picture or pseudo-element shape behind the text somewhere close above it. */
function hasPaintedAncestor(el: Element): boolean {
  for (let e: Element | null = el, i = 0; e && i < 8; e = e.parentElement, i++) {
    const cs = getComputedStyle(e);
    if (cs.backgroundImage !== "none") return true;
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(e, pseudo);
      if (ps.content !== "none" && ((parse(ps.backgroundColor)?.a ?? 0) > 0.3 || ps.backgroundImage !== "none")) return true;
    }
  }
  return false;
}

export function repairContrast(): RepairStats {
  const stats: RepairStats = { checked: 0, fixed: 0, boxes: 0 };
  const light = document.documentElement.getAttribute("data-prism-touch") === "light";
  // Measure the page as styled, without previous fixes, in one synchronous pass (no flicker).
  for (const el of document.querySelectorAll(`[${FIX}],[${FIXBOX}]`)) { el.removeAttribute(FIX); el.removeAttribute(FIXBOX); }
  const cache = new Map<Element, RGBA | null>();
  const fixes: [Element, string][] = [];
  const boxes: Element[] = [];
  // Large on-screen pictures and videos: text drawn over them is checked against what's really behind it.
  const media = [...document.querySelectorAll("img,video,canvas")].map((m) => m.getBoundingClientRect())
    .filter((r) => r.width * r.height > 40000 && r.bottom > 0 && r.top < innerHeight);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      const tag = el.tagName;
      if (tag === "PRISM-ROOT" || tag === "PRISM-FOLD" || tag === "SCRIPT" || tag === "STYLE" || tag === "SVG" || tag === "svg" || tag === "NOSCRIPT" || tag === "TEMPLATE") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  let scanned = 0;
  while ((node = walker.nextNode()) && scanned < 8000) {
    scanned++;
    const el = node as HTMLElement;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;

    // Boxes that blend into what's behind them get an outline so they read as separate.
    const own = parse(cs.backgroundColor);
    if (!light && own && own.a > 0.5 && rect.width * rect.height > 2500 && el.parentElement && !el.matches("input,select,textarea,button,img")) {
      const behind = backgroundOf(el.parentElement, cache);
      const noBorder = parseFloat(cs.borderTopWidth) < 1 && parseFloat(cs.borderLeftWidth) < 1 && cs.boxShadow === "none";
      if (behind && noBorder && ratio(own, behind) < 1.12 && (own.r !== behind.r || own.g !== behind.g || own.b !== behind.b)) boxes.push(el);
    }

    if (!hasOwnText(el) && !el.matches("input,select,textarea,button")) continue;
    const cx = rect.left + Math.min(rect.width / 2, 40), cy = rect.top + rect.height / 2;
    // Text drawn over a photo or video keeps the site's own colours: the site chose them for that picture,
    // and Prism can't see the picture's pixels to do better.
    if (media.some((m) => cx >= m.left && cx <= m.right && cy >= m.top && cy <= m.bottom) && overMedia(el, rect)) continue;
    const fg = parse(cs.color);
    const bg = backgroundOf(el, cache);
    if (!fg || !bg) continue;
    stats.checked++;
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3.2 : 4.6;
    const effectiveFg = fg.a < 1 ? blend(fg, bg) : fg;
    if (ratio(effectiveFg, bg) >= need) continue;
    // On a site that keeps its own design, only faint grey text is darkened: white text and brand colours
    // were chosen for backgrounds Prism can't always measure (gradients, pseudo-element shapes).
    if (light) {
      const sat = Math.max(effectiveFg.r, effectiveFg.g, effectiveFg.b) - Math.min(effectiveFg.r, effectiveFg.g, effectiveFg.b);
      if (luminance(effectiveFg) > 0.35 || sat > 40 || luminance(bg) < 0.5 || hasPaintedAncestor(el)) continue;
    }
    // Pick whichever of dark ink or white reads best on this background.
    fixes.push([el, ratio({ r: 17, g: 17, b: 17, a: 1 }, bg) >= ratio(WHITE, bg) ? "dark" : "light"]);
  }
  for (const [el, kind] of fixes) el.setAttribute(FIX, kind);
  for (const el of boxes) el.setAttribute(FIXBOX, "");
  stats.fixed = fixes.length;
  stats.boxes = boxes.length;
  return stats;
}

/**
 * After styling, a control that grew can overlap its neighbours (common in cramped headers). Any
 * overlapping controls are made compact; repeats until nothing overlaps (max 3 passes).
 */
export function repairOverlaps(): number {
  let fixed = 0;
  for (let pass = 0; pass < 3; pass++) {
    const controls = [...document.querySelectorAll<HTMLElement>("[data-prism-c]:not([data-prism-tight])")];
    const tight = new Set<HTMLElement>();
    const boxes = controls.map((el) => ({ el, r: el.getBoundingClientRect() })).filter((b) => b.r.width && b.r.height);
    const neighbours = [...document.querySelectorAll<HTMLElement>("[data-prism-c],img,svg,label,a[href],h1,h2,h3")]
      .map((el) => ({ el, r: el.getBoundingClientRect() })).filter((b) => b.r.width && b.r.height);
    for (const a of boxes) {
      for (const b of neighbours) {
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 2 && h > 2) { tight.add(a.el); if (b.el.hasAttribute("data-prism-c")) tight.add(b.el); }
      }
    }
    if (!tight.size) break;
    for (const el of tight) el.setAttribute("data-prism-tight", "");
    fixed += tight.size;
    void document.body.offsetHeight; // re-layout before the next pass
  }
  return fixed;
}
