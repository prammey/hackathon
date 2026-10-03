/**
 * Layout analysis for chaotic pages. Detects "canvas" layouts (many absolutely positioned blocks on a
 * fixed-size board, e.g. sites built with old WYSIWYG editors) and layout tables, and tags them so the
 * Style can reflow them into a calm card grid — with CSS only, so removing the tags restores the page.
 */

export type LayoutMode = "refine" | "restructure";

export interface LayoutResult {
  mode: LayoutMode;
  items: number;
  orderCss: string;
}

const PRICE = /(\d[\d\s.,\u00a0\u202f]*\s*(,-|kr\.?|nok|sek|dkk|€|\$|£|eur|usd|gbp)|(€|\$|£)\s?\d[\d.,]*)/i;

function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function visible(r: DOMRect, cs: CSSStyleDeclaration): boolean {
  return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
}

function textLength(el: Element): number {
  return ((el as HTMLElement).innerText ?? "").replace(/\s+/g, "").length;
}

/** Finds the element whose direct children are mostly absolutely positioned blocks. */
function findCanvas(body: HTMLElement): HTMLElement | null {
  const counts = new Map<Element, number>();
  for (const el of body.querySelectorAll<HTMLElement>("div,table,span,a,img,p,font,center")) {
    if (el.closest("prism-root,prism-fold,header,nav,[role=dialog],dialog")) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12 || !visible(r, cs)) continue;
    const parent = el.parentElement;
    if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  let best: [Element, number] | null = null;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best && best[1] >= 12 ? (best[0] as HTMLElement) : null;
}

/** Picks the most prominent text in a block as its title (largest original font size). */
function tagTitle(item: Element) {
  let bestEl: Element | null = null;
  let bestScore = 15;
  for (const el of item.querySelectorAll("b,strong,font,span,a,h1,h2,h3,h4,td,div,p")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    const text = ((el as HTMLElement).innerText ?? "").trim();
    if (text.length < 3 || text.length > 60 || PRICE.test(text) || /^(new|nyhet|sale|nytt)!?$/i.test(text)) continue;
    // Bigger or bolder text reads as the block's name.
    const score = parseFloat(cs.fontSize) + (Number(cs.fontWeight) >= 600 || el.closest("b,strong") ? 3 : 0);
    if (score > bestScore) { bestScore = score; bestEl = el; }
  }
  if (bestEl) setAttr(bestEl, "data-prism-title", "");
}

function tagPrices(item: Element) {
  for (const el of item.querySelectorAll("b,strong,font,span,a,td,div,p,u,i,em,small")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join("").trim();
    if (own && own.length <= 24 && PRICE.test(own)) setAttr(el, "data-prism-price", "");
  }
}

function classify(item: HTMLElement, rect: DOMRect, canvasWidth: number): string {
  if (rect.width < 16 || rect.height < 10) return "decor"; // divider lines, spacer gifs
  const text = textLength(item);
  const links = item.querySelectorAll("a[href]");
  const imgs = [...item.querySelectorAll("img,video,canvas")];
  const imgArea = imgs.reduce((sum, i) => { const r = i.getBoundingClientRect(); return sum + r.width * r.height; }, 0);
  if (text < 2 && imgArea < 4200 && !item.querySelector("input,select,textarea,button,form")) return "decor";
  if (links.length >= 8 && imgs.length <= 3 && text / links.length < 40) return "nav";
  if (item.querySelector("input,select,textarea,form")) return "form";
  if (rect.width >= Math.min(900, canvasWidth * 0.6)) return "wide";
  return "card";
}

// ---------- grouping pinned fragments into cards ----------

interface Move { node: Element; parent: Node; next: Node | null }
let moves: Move[] = [];
let created: Element[] = [];

/** Scrolling <marquee> text is unreadable; show it as still text instead (undone on restore). */
function stillMarquees(scope: Element) {
  for (const m of scope.querySelectorAll("marquee")) {
    const text = (m.textContent ?? "").trim();
    if (!text) continue;
    const still = document.createElement("prism-text");
    still.textContent = text;
    m.after(still);
    m.setAttribute("data-prism-hidden", "");
    created.push(still);
  }
}

/** Puts every grouped node back exactly where it was and removes Prism's wrappers. */
export function ungroupCanvas(): void {
  for (const m of moves.reverse()) {
    if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.node, m.next);
    else m.parent.appendChild(m.node);
    m.node.removeAttribute("data-prism-member");
  }
  moves = [];
  for (const c of created) c.remove();
  created = [];
  for (const m of document.querySelectorAll("[data-prism-hidden]")) m.removeAttribute("data-prism-hidden");
  for (const g of document.querySelectorAll("prism-group")) g.remove();
}

interface Box { x: number; y: number; r: number; b: number }
const grow = (a: Box, pad: number): Box => ({ x: a.x - pad, y: a.y - pad, r: a.r + pad, b: a.b + pad });
const hits = (a: Box, b: Box) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
const union = (a: Box, b: Box): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });

/**
 * Pieces of one product (picture, name, price) are separate pinned blocks on canvas pages.
 * Blocks that sat next to each other are wrapped together so each card is a complete thing.
 * Static content only: these pages have no app state to disturb, and every move is recorded.
 */
/** A block that is mainly one product picture. A card holds at most one, so neighbours stay separate. */
function isPicture(el: Element): boolean {
  const big = [...el.querySelectorAll("img,canvas,video")].some((i) => { const r = i.getBoundingClientRect(); return r.width * r.height >= 6000; });
  return big && textLength(el) < 4;
}

function groupFragments(canvas: Element, entries: { el: HTMLElement; box: Box }[]) {
  const clusters: { box: Box; members: HTMLElement[]; picture: boolean }[] = [];
  for (const e of entries) {
    const kind = e.el.getAttribute("data-prism-item");
    const picture = isPicture(e.el);
    if (kind === "nav" || kind === "form" || kind === "decor" || kind === "wide") { clusters.push({ box: e.box, members: [e.el], picture }); continue; }
    let best: { c: (typeof clusters)[number]; overlap: number } | null = null;
    for (const c of clusters) {
      const k = c.members[0].getAttribute("data-prism-item");
      if (k === "nav" || k === "form" || k === "decor" || k === "wide" || c.members.length >= 6) continue;
      if (picture && c.picture) continue;
      if (!hits(grow(c.box, 14), e.box)) continue;
      const u = union(c.box, e.box);
      if (u.r - u.x > 440 || u.b - u.y > 560) continue;
      const ov = Math.min(c.box.r, e.box.r + 14) - Math.max(c.box.x, e.box.x - 14);
      if (!best || ov > best.overlap) best = { c, overlap: ov };
    }
    if (best) { best.c.members.push(e.el); best.c.box = union(best.c.box, e.box); best.c.picture ||= picture; }
    else clusters.push({ box: e.box, members: [e.el], picture });
  }
  for (const c of clusters) {
    if (c.members.length < 2) continue;
    const group = document.createElement("prism-group");
    group.setAttribute("data-prism-item", "card");
    group.setAttribute("data-prism-o", c.members[0].getAttribute("data-prism-o") ?? "0");
    canvas.insertBefore(group, c.members[0]);
    for (const m of c.members) {
      moves.push({ node: m, parent: m.parentNode!, next: m.nextSibling });
      m.removeAttribute("data-prism-item");
      m.setAttribute("data-prism-member", "");
      group.appendChild(m);
    }
  }
}

export function analyzeLayout(doc: Document = document): LayoutResult {
  const body = doc.body;
  const result: LayoutResult = { mode: "refine", items: 0, orderCss: "" };
  if (!body) return result;

  const canvas = findCanvas(body);
  const fontTags = body.getElementsByTagName("font").length;
  if (canvas) {
    setAttr(canvas, "data-prism-layout", "canvas");
    const canvasWidth = canvas.getBoundingClientRect().width || innerWidth;
    const entries: { el: HTMLElement; top: number; left: number; box: Box }[] = [];
    for (const child of [...canvas.children] as HTMLElement[]) {
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE" || child.tagName.startsWith("PRISM-")) continue;
      const cs = getComputedStyle(child);
      const r = child.getBoundingClientRect();
      if (!visible(r, cs)) continue;
      setAttr(child, "data-prism-item", classify(child, r, canvasWidth));
      entries.push({ el: child, top: r.top + scrollY, left: r.left + scrollX, box: { x: r.left + scrollX, y: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY } });
      // Nested absolute positioning inside a block is released too.
      for (const inner of child.querySelectorAll<HTMLElement>("div,table,span,img,a,font,p")) {
        if (getComputedStyle(inner).position === "absolute") setAttr(inner, "data-prism-pos", "abs");
      }
      tagTitle(child);
      tagPrices(child);
    }
    // Reading order: top-to-bottom in bands, then left-to-right.
    const band = 60;
    entries.sort((a, b) => Math.round(a.top / band) - Math.round(b.top / band) || a.left - b.left);
    entries.forEach((e, i) => setAttr(e.el, "data-prism-o", String(i)));
    groupFragments(canvas, entries);
    stillMarquees(canvas);
    result.items = entries.length;
    result.mode = "restructure";
  }

  // Layout tables (tables used to arrange a page, not to show data) become card grids.
  for (const table of body.querySelectorAll<HTMLTableElement>("table")) {
    if (table.closest("[data-prism-item],prism-root") || table.querySelector("th")) continue;
    const r = table.getBoundingClientRect();
    if (r.width < innerWidth * 0.5) continue;
    const rows = table.rows;
    if (rows.length < 1) continue;
    const cells = [...table.querySelectorAll(":scope > tbody > tr > td, :scope > tr > td")];
    const rich = cells.filter((c) => c.querySelector("img,table,div") && textLength(c) > 5).length;
    if (cells.length >= 4 && rich >= 3 && cells.length / rows.length >= 2) {
      setAttr(table, "data-prism-layout", "table-grid");
      for (const cell of cells) { tagTitle(cell); tagPrices(cell); }
      result.mode = "restructure";
    }
  }
  if (fontTags >= 60) result.mode = "restructure";

  if (result.items) {
    const rules: string[] = [];
    for (let i = 0; i < result.items; i++) rules.push(`[data-prism-o="${i}"]{order:${i}}`);
    result.orderCss = rules.map((r) => `html[data-prism-on][data-prism-mode=restructure] ${r}`).join("\n");
  }
  return result;
}
