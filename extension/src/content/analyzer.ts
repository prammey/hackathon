/**
 * Deterministic page analysis: tags elements with Prism attributes the stylesheet understands,
 * assigns stable ids, and builds the compact Outline sent to the AI (never form values).
 */
import { hash } from "../shared/hash";
import type { Outline, OutlineElement } from "../shared/types";

export const PRISM_ATTRS = [
  "data-prism-id", "data-prism-c", "data-prism-s", "data-prism-role", "data-prism-emphasis",
  "data-prism-collapsed", "data-prism-open", "data-prism-step-active", "data-prism-protect", "data-prism-rid",
  "data-prism-filled", "data-prism-tight", "data-prism-layout", "data-prism-item", "data-prism-o", "data-prism-pos",
  "data-prism-title", "data-prism-price", "data-prism-member", "data-prism-hidden", "data-prism-fix", "data-prism-fixbox",
  "data-prism-pad", "data-prism-next",
];

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "HEAD", "BR", "WBR"]);
const LEAF_TAGS = new Set(["SVG", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "IMG", "PICTURE", "OBJECT", "EMBED", "MATH"]);
const LANDMARKS: Record<string, string> = {
  HEADER: "header", NAV: "nav", MAIN: "main", ASIDE: "aside", FOOTER: "footer", FORM: "form",
};
const AD_PATTERN = /(^|[\s_-])(ad|ads|adv|advert|advertisement|adslot|ad-slot|sponsor|sponsored|promo|promotion|outbrain|taboola|newsletter-signup|social-share|share-bar|sharing)([\s_-]|$)/i;
const CONSENT_PATTERN = /(cookie|consent|gdpr|privacy-banner|onetrust|cmp)/i;
const NOTICE_PATTERN = /(notice|alert|warning|important|callout|announcement|info-box|infobox|highlight|deadline)/i;
const ERROR_PATTERN = /(^|[\s_-])(error|invalid|field-error|form-error|validation)([\s_-]|$)/i;
const SENSITIVE_PATTERN = /(password|passcode|\bpin\b|cvv|cvc|security code|card number|credit card|debit card|account number|sort code|routing|iban|ssn|social security|national insurance|passport)/i;

export interface AnalyzeResult {
  outline: Outline;
  structureHash: string;
  ids: Map<string, Element>;
  protectedIds: Set<string>;
  mainEl: Element | null;
  stats: { scanned: number; tagged: number; ms: number };
}

export function isPrismNode(el: Element): boolean {
  const tag = el.tagName;
  return tag === "PRISM-ROOT" || tag === "PRISM-FOLD" || tag === "PRISM-GROUP" || tag === "PRISM-TEXT";
}

export function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return clean(aria);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (text.trim()) return clean(text);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) return clean([...labels].map((l) => l.textContent ?? "").join(" "));
    if (el instanceof HTMLInputElement && ["submit", "button", "reset"].includes(el.type)) return clean(el.value);
    const ph = el.getAttribute("placeholder");
    if (ph) return clean(ph);
  }
  const alt = el.getAttribute("alt") ?? el.getAttribute("title");
  if (alt) return clean(alt);
  return clean((el as HTMLElement).innerText ?? el.textContent ?? "");
}

export function clean(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function hasBackground(cs: CSSStyleDeclaration): "color" | "image" | null {
  if (cs.backgroundImage && cs.backgroundImage !== "none") {
    return cs.backgroundImage.includes("url(") ? "image" : "color";
  }
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s));
  const alpha = parts.length === 4 ? parts[3] : 1;
  return alpha > 0.6 ? "color" : null;
}

function luminance(color: string): number {
  const m = color.match(/[\d.]+/g);
  if (!m) return 1;
  const [r, g, b] = m.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text you can actually see (screen-reader-only labels are clipped to a pixel or two). */
function hasVisibleText(el: Element): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return true;
  }
  return false;
}

function controlKind(el: Element, cs: CSSStyleDeclaration): string | null {
  const tag = el.tagName;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    if (type === "hidden" || type === "range" || type === "color" || type === "file" || type === "image") return null;
    if (type === "checkbox" || type === "radio") return "check";
    if (type === "submit" || type === "button" || type === "reset") return "button";
    return "field";
  }
  if (tag === "SELECT" || tag === "TEXTAREA") return "field";
  const role = el.getAttribute("role");
  if (tag === "BUTTON" || role === "button") {
    // Its picture is a background image, so restyling would wipe the icon. A light (usually white) icon
    // gets a dark backing, because Prism lightens the bar it sat on; a dark icon keeps the site's look.
    if (cs.backgroundImage.includes("url(")) {
      const [r, g, b] = (cs.color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
      return !hasVisibleText(el) && (r + g + b) / 3 > 180 ? "bg-icon" : null;
    }
    const text = clean((el as HTMLElement).innerText ?? "", 80);
    return text.length > 0 ? "button" : "icon-button";
  }
  if (tag === "A" && (el as HTMLAnchorElement).href) {
    const bg = hasBackground(cs) === "color";
    const bordered = parseFloat(cs.borderTopWidth) >= 1 && parseFloat(cs.borderBottomWidth) >= 1 &&
      parseFloat(cs.borderLeftWidth) >= 1;
    const padded = parseFloat(cs.paddingLeft) >= 6 && parseFloat(cs.paddingTop) >= 3;
    const text = clean((el as HTMLElement).innerText ?? "", 80);
    if (text && padded && (bg || bordered) && text.length < 60) return "button-link";
  }
  return null;
}

/** Is this element (or an ancestor) something that must never be hidden by Prism? */
function isProtectedSelf(el: Element): boolean {
  const role = el.getAttribute("role");
  if (role && ["alert", "status", "alertdialog", "dialog", "log"].includes(role)) return true;
  if (el.hasAttribute("aria-live") && el.getAttribute("aria-live") !== "off") return true;
  if (el.getAttribute("aria-invalid") === "true" || el.hasAttribute("required") || el.getAttribute("aria-required") === "true") return true;
  if (["FORM", "LABEL", "INPUT", "SELECT", "TEXTAREA", "FIELDSET", "DIALOG", "MAIN"].includes(el.tagName)) return true;
  const idClass = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
  return ERROR_PATTERN.test(idClass) || CONSENT_PATTERN.test(idClass);
}

/** Only touch the DOM when a value actually changes, so sites observing their own DOM see no churn. */
function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function stableId(sig: string, seen: Map<string, number>): string {
  const base = `p${hash(sig)}`;
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}x${n}`;
}

function anchorOf(el: Element): string {
  let cur: Element | null = el.parentElement;
  while (cur && cur !== document.body) {
    if (cur.id && !/\d{4,}/.test(cur.id)) return `#${cur.id}`;
    if (LANDMARKS[cur.tagName]) return cur.tagName.toLowerCase();
    cur = cur.parentElement;
  }
  return "body";
}

export function isSensitiveField(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === "password") return true;
    const ac = (el.getAttribute("autocomplete") ?? "").toLowerCase();
    if (/(password|one-time-code|cc-)/.test(ac)) return true;
  }
  return SENSITIVE_PATTERN.test(`${accessibleName(el)} ${el.getAttribute("name") ?? ""} ${el.id}`);
}

export function analyze(doc: Document = document): AnalyzeResult {
  const started = performance.now();
  const vw = doc.documentElement.clientWidth || window.innerWidth;
  const docHeight = Math.max(doc.documentElement.scrollHeight, 1);
  const ids = new Map<string, Element>();
  const seen = new Map<string, number>();
  const protectedIds = new Set<string>();
  const outlineEls: { el: Element; item: OutlineElement; priority: number }[] = [];
  const skeleton: string[] = [];
  let scanned = 0;
  let tagged = 0;
  let mainEl: Element | null = doc.querySelector("main, [role=main]");
  let bestArticle: { el: Element; score: number } | null = null;

  const body = doc.body;
  if (!body) {
    return {
      outline: { title: doc.title, url: location.href, lang: doc.documentElement.lang, viewport: [vw, innerHeight], elements: [] },
      structureHash: "empty", ids, protectedIds, mainEl: null, stats: { scanned: 0, tagged: 0, ms: 0 },
    };
  }

  const register = (el: Element, item: Omit<OutlineElement, "id">, priority: number, sigExtra = "") => {
    const sig = `${item.tag}|${item.role ?? ""}|${(item.name ?? "").slice(0, 50)}|${anchorOf(el)}|${sigExtra}`;
    const id = stableId(sig, seen);
    setAttr(el, "data-prism-id", id);
    ids.set(id, el);
    outlineEls.push({ el, item: { id, ...item }, priority });
    return id;
  };

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      if (el.tagName === "PRISM-GROUP") return NodeFilter.FILTER_SKIP; // Prism's card wrapper: walk its contents
      if (SKIP_TAGS.has(el.tagName) || isPrismNode(el)) return NodeFilter.FILTER_REJECT;
      const parent = el.parentElement;
      if (parent && LEAF_TAGS.has(parent.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null;
  const stopAt = 12000;
  while ((node = walker.nextNode()) && scanned < stopAt) {
    const el = node as HTMLElement;
    scanned++;
    const tag = el.tagName;
    // Things Prism itself folded away still count as part of the page (keeps ids and fingerprint stable).
    const hiddenByPrism = el.hasAttribute("data-prism-collapsed") || el.getAttribute("data-prism-role") === "clutter";
    const rect = el.getBoundingClientRect();
    if (!hiddenByPrism && rect.width === 0 && rect.height === 0 && tag !== "INPUT") continue;
    const cs = getComputedStyle(el);
    if (!hiddenByPrism && (cs.display === "none" || cs.visibility === "hidden")) continue;

    const box: [number, number, number, number] = [
      Math.round(rect.left + scrollX), Math.round(rect.top + scrollY), Math.round(rect.width), Math.round(rect.height),
    ];
    const idClass = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
    const roleAttr = el.getAttribute("role") ?? "";
    const isProt = isProtectedSelf(el);

    // Controls. Classify by the page's own appearance only once: after Prism styles a link as a button,
    // re-classifying it would change its id and look like the page had changed.
    const styledByPrism = el.hasAttribute("data-prism-role") || el.hasAttribute("data-prism-emphasis");
    const kind = el.getAttribute("data-prism-c") ?? (styledByPrism && tag === "A" ? null : controlKind(el, cs));
    if (kind) {
      setAttr(el, "data-prism-c", kind);
      // Controls squeezed into narrow fixed-width layouts keep a compact size so nothing gets cut off.
      const holder = el.parentElement?.closest("td,li,div,form,fieldset,p,span") ?? el.parentElement;
      const holderWidth = holder ? holder.getBoundingClientRect().width : vw;
      const inBar = el.closest("header,nav,[role=banner],[role=navigation],[role=toolbar],[role=menubar]");
      const parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const inRow = parentCs && parentCs.display.includes("flex") && !parentCs.flexDirection.startsWith("column") && parentCs.flexWrap === "nowrap";
      if ((holderWidth && holderWidth < 260) || inBar || inRow) setAttr(el, "data-prism-tight", "");
      tagged++;
      const name = accessibleName(el);
      const item: Omit<OutlineElement, "id"> = { tag: tag.toLowerCase(), name: clean(name, 80), box, interactive: true };
      if (roleAttr) item.role = roleAttr;
      if (kind === "field" || kind === "check") {
        const input = el as HTMLInputElement;
        item.field = { type: input.type || tag.toLowerCase(), label: clean(name, 80), required: input.required || el.getAttribute("aria-required") === "true" };
        skeleton.push(`f:${item.field.type}:${item.field.label.slice(0, 30)}`);
      } else {
        skeleton.push(`b:${clean(name, 30)}`);
      }
      const id = register(el, item, kind === "field" || kind === "check" ? 9 : 8);
      if (kind === "field" || kind === "check") protectedIds.add(id);
      continue;
    }

    // Landmarks
    const landmark = LANDMARKS[tag] ?? (["banner", "navigation", "main", "complementary", "contentinfo", "form", "search"].includes(roleAttr) ? roleAttr : "");
    if (landmark) {
      const mapped = ({ banner: "header", navigation: "nav", complementary: "aside", contentinfo: "footer", search: "form" } as Record<string, string>)[landmark] ?? landmark;
      if (["header", "nav", "footer", "main"].includes(mapped) && !el.hasAttribute("data-prism-role")) {
        setAttr(el, "data-prism-role", mapped);
        tagged++;
      }
      skeleton.push(`l:${mapped}`);
      const id = register(el, { tag: tag.toLowerCase(), role: mapped, name: clean(el.getAttribute("aria-label") ?? "", 60), box }, 10);
      if (isProt) protectedIds.add(id);
    }

    // Headings
    if (/^H[1-6]$/.test(tag) || roleAttr === "heading") {
      const name = clean(el.innerText ?? "", 120);
      if (name) {
        skeleton.push(`h:${tag}:${name.slice(0, 40)}`);
        register(el, { tag: tag.toLowerCase(), name, box }, tag === "H1" ? 10 : 7);
      }
    }

    // Backgrounds → surfaces
    const bg = hasBackground(cs);
    if (bg && !landmark.startsWith("main") && tag !== "BODY" && tag !== "HTML" && !["TD", "TH", "TR", "THEAD", "TBODY", "TFOOT"].includes(tag)) {
      const area = rect.width * rect.height;
      // Pieces of a strip kept in the site's colours stay as they are too; carding them makes boxes-in-boxes.
      // A see-through colour layer is a designed overlay (usually over a photo): repainting it washes the photo out.
      const alpha = Number(cs.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1);
      if (bg === "image" || alpha < 0.95 || el.parentElement?.closest("[data-prism-s=keep]")) {
        setAttr(el, "data-prism-s", "keep");
      } else if (rect.width >= vw * 0.9 && rect.height > docHeight * 0.5) {
        setAttr(el, "data-prism-s", "plain");
      } else if (rect.width >= vw * 0.9 && rect.height < 260 && luminance(cs.backgroundColor) < 0.2 && el.querySelector("svg,img")) {
        // A dark branded header strip (logo on dark): keep the site's identity as it is.
        setAttr(el, "data-prism-s", "keep");
      } else if (rect.width >= vw * 0.9) {
        setAttr(el, "data-prism-s", "band");
      } else if (area >= 12000 && rect.height >= 64 && !el.closest("header,[role=banner],nav,[role=navigation]") && !el.querySelector("nav,[role=navigation]")) {
        setAttr(el, "data-prism-s", "card");
        // A box whose contents touch its edges gets breathing room once Prism adds a border.
        const pad = Math.min(parseFloat(cs.paddingTop), parseFloat(cs.paddingRight), parseFloat(cs.paddingBottom), parseFloat(cs.paddingLeft));
        if (pad < 10) setAttr(el, "data-prism-pad", "");
      } else {
        setAttr(el, "data-prism-s", "keep");
      }
      tagged++;
    }

    // Clutter heuristics
    const sticky = cs.position === "fixed" || cs.position === "sticky";
    if (AD_PATTERN.test(idClass) && !isProt && !el.querySelector("input,select,textarea,form")) {
      setAttr(el, "data-prism-role", "clutter");
      tagged++;
      register(el, { tag: tag.toLowerCase(), name: clean(el.innerText ?? "", 60), box, hint: "likely-ad" }, 6);
      continue;
    }
    if (tag === "IFRAME") {
      const src = (el as HTMLIFrameElement).src;
      const ad = /doubleclick|googlesyndication|adservice|amazon-adsystem|taboola|outbrain|criteo/.test(src);
      register(el, { tag: "iframe", name: clean(el.getAttribute("title") ?? "", 60), box, hint: ad ? "ad-frame" : "frame" }, ad ? 6 : 4);
      if (ad) { setAttr(el, "data-prism-role", "clutter"); tagged++; }
      continue;
    }
    if (sticky && rect.height < 220 && rect.width > vw * 0.5 && !landmark && !CONSENT_PATTERN.test(idClass)) {
      register(el, { tag: tag.toLowerCase(), name: clean(el.innerText ?? "", 80), box, hint: "sticky-bar" }, 5);
    }

    // Notices and errors
    if (roleAttr === "alert" || (ERROR_PATTERN.test(idClass) && clean(el.innerText ?? "").length > 2 && el.children.length < 6)) {
      if (!el.hasAttribute("data-prism-role")) setAttr(el, "data-prism-role", "error");
      tagged++;
      const id = register(el, { tag: tag.toLowerCase(), role: "alert", name: clean(el.innerText ?? "", 140), box, hint: "error" }, 9);
      protectedIds.add(id);
      continue;
    }
    if (NOTICE_PATTERN.test(idClass) && !kind && clean(el.innerText ?? "").length > 20 && rect.height < 600) {
      const id = register(el, { tag: tag.toLowerCase(), name: clean(el.innerText ?? "", 160), box, hint: "notice-like" }, 8);
      protectedIds.add(id);
    }

    // Media
    if ((tag === "IMG" || tag === "CANVAS" || tag === "VIDEO") && rect.width >= 120 && rect.height >= 80) {
      register(el, { tag: tag.toLowerCase(), name: clean(el.getAttribute("alt") ?? el.getAttribute("aria-label") ?? "", 80), box }, 3);
    }

    // Text blocks
    if (["P", "LI", "BLOCKQUOTE", "DD", "FIGCAPTION", "TD"].includes(tag)) {
      const txt = clean(el.innerText ?? "", 160);
      if (txt.length >= 30) register(el, { tag: tag.toLowerCase(), text: txt, box }, tag === "P" ? 4 : 2);
    }

    // Links (prominent ones only)
    if (tag === "A" && (el as HTMLAnchorElement).href) {
      const name = clean(accessibleName(el), 60);
      if (name) register(el, { tag: "a", name, box, interactive: true }, rect.top < innerHeight ? 3 : 1, (el as HTMLAnchorElement).pathname);
    }

    // Main content candidate
    if (!mainEl && (tag === "ARTICLE" || tag === "SECTION" || tag === "DIV")) {
      const ps = el.querySelectorAll(":scope > p, :scope > div > p").length;
      if (ps >= 3 && (!bestArticle || ps > bestArticle.score)) bestArticle = { el, score: ps };
    }
    if (isProt && !el.hasAttribute("data-prism-id") && ["DIALOG", "FIELDSET"].includes(tag)) {
      const id = register(el, { tag: tag.toLowerCase(), name: clean(el.innerText ?? "", 80), box }, 7);
      protectedIds.add(id);
    }
  }

  if (!mainEl && bestArticle) mainEl = bestArticle.el;
  if (mainEl && !mainEl.hasAttribute("data-prism-role")) {
    setAttr(mainEl, "data-prism-role", "main");
    tagged++;
  }

  // Protect anything inside protected containers (forms, dialogs, alerts).
  for (const [id, el] of ids) {
    if (el.closest("form, [role=alert], [role=dialog], dialog, [aria-live=assertive], [aria-live=polite]")) protectedIds.add(id);
  }

  // Keep the outline within budget, highest priority first, then document order.
  const BUDGET = 360;
  const order = new Map(outlineEls.map((o, i) => [o.el, i]));
  const chosen = [...outlineEls]
    .sort((a, b) => b.priority - a.priority || order.get(a.el)! - order.get(b.el)!)
    .slice(0, BUDGET)
    .sort((a, b) => order.get(a.el)! - order.get(b.el)!)
    .map((o) => o.item);

  const outline: Outline = {
    title: clean(doc.title, 200),
    url: location.href.slice(0, 500),
    lang: doc.documentElement.lang || "",
    viewport: [vw, innerHeight],
    elements: chosen,
  };
  return {
    outline,
    structureHash: hash(skeleton.join("|")),
    ids,
    protectedIds,
    mainEl,
    stats: { scanned, tagged, ms: Math.round(performance.now() - started) },
  };
}

/** Remove every attribute and node Prism added. */
export function stripPrism(doc: Document = document): void {
  const selector = PRISM_ATTRS.map((a) => `[${a}]`).join(",");
  for (const el of doc.querySelectorAll(selector)) for (const a of PRISM_ATTRS) el.removeAttribute(a);
  for (const fold of doc.querySelectorAll("prism-fold")) fold.remove();
  doc.documentElement.removeAttribute("data-prism-mode");
}
