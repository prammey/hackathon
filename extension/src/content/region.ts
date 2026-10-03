/** Builds the RegionContext for a selected rectangle: visible text, form controls, images. */
import type { Rect, RegionContext, RegionControl } from "../shared/types";
import { accessibleName, clean, isPrismNode, isSensitiveField } from "./analyzer";

let ridCounter = 0;

export function intersects(a: DOMRect | Rect, b: Rect, minRatio = 0): boolean {
  const ax = "left" in a ? a.left : a.x;
  const ay = "top" in a ? a.top : a.y;
  const x1 = Math.max(ax, b.x);
  const y1 = Math.max(ay, b.y);
  const x2 = Math.min(ax + a.width, b.x + b.width);
  const y2 = Math.min(ay + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return false;
  if (!minRatio) return true;
  const area = Math.max(1, a.width * a.height);
  return ((x2 - x1) * (y2 - y1)) / area >= minRatio;
}

/** Stable-for-this-page id used to address a control in AI answers and actions. */
export function regionId(el: Element): string {
  const existing = el.getAttribute("data-prism-id") ?? el.getAttribute("data-prism-rid");
  if (existing) return existing;
  const rid = `pr${(++ridCounter).toString(36)}`;
  el.setAttribute("data-prism-rid", rid);
  return rid;
}

export function findById(id: string): Element | null {
  return document.querySelector(`[data-prism-id="${CSS.escape(id)}"],[data-prism-rid="${CSS.escape(id)}"]`);
}

function center(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function inside(pt: { x: number; y: number }, rect: Rect): boolean {
  return pt.x >= rect.x && pt.x <= rect.x + rect.width && pt.y >= rect.y && pt.y <= rect.y + rect.height;
}

/**
 * The words actually inside the selection box. When the box covers only part of a line
 * (e.g. just "Jobseeker's Allowance"), only those words are selected and the full line is kept
 * separately as surrounding context.
 */
function textIn(rect: Rect): { text: string; surrounding: string } {
  const out: string[] = [];
  const context: string[] = [];
  let size = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest("prism-root,prism-fold,script,style,noscript,[aria-hidden=true],[data-prism-hidden]")) return NodeFilter.FILTER_REJECT;
      if (parent.closest("input,textarea,select")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const range = document.createRange();
  let lastBlock: Element | null = null;
  let node: Node | null;
  while ((node = walker.nextNode()) && size < 7000) {
    const parent = node.parentElement!;
    if (!intersects(parent.getBoundingClientRect(), rect)) continue;
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width && r.height);
    if (!rects.some((r) => intersects(r, rect))) continue;
    const raw = node.textContent!;
    let text: string;
    if (rects.every((r) => intersects(r, rect, 0.85))) {
      text = raw;
    } else {
      // Partly covered: keep the words whose middle is inside the box.
      const picked: string[] = [];
      for (const m of raw.matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const wr = range.getBoundingClientRect();
        if (wr.width && inside(center(wr), rect)) picked.push(m[0]);
      }
      if (!picked.length) continue;
      text = picked.join(" ");
      const block = parent.closest("p,li,h1,h2,h3,h4,h5,h6,td,th,label,dd,dt,blockquote,figcaption") ?? parent;
      const full = ((block as HTMLElement).innerText ?? raw).replace(/\s+/g, " ").trim().slice(0, 600);
      if (full && !context.includes(full)) context.push(full);
    }
    const block = parent.closest("p,li,h1,h2,h3,h4,h5,h6,td,th,label,legend,button,a,div,section,dt,dd") ?? parent;
    if (lastBlock && block !== lastBlock && !lastBlock.contains(block)) out.push("\n");
    out.push(text.replace(/\s+/g, " "));
    lastBlock = block;
    size += text.length;
  }
  return {
    text: out.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 7000),
    surrounding: context.join("\n").slice(0, 1500),
  };
}

function errorFor(el: Element): string {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  const described = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  if (described.trim() && (el.getAttribute("aria-invalid") === "true" || /error|invalid|must|required/i.test(described))) {
    return clean(described, 200);
  }
  const field = el.closest(".field,.form-group,.govuk-form-group,fieldset,div");
  const err = field?.querySelector("[role=alert],.error,.error-message,[class*=error]");
  return err && err !== el ? clean(err.textContent ?? "", 200) : "";
}

function labelFor(el: Element): string {
  const own = accessibleName(el);
  const legend = el.closest("fieldset")?.querySelector("legend")?.textContent ?? "";
  return clean(legend && !own.includes(legend.trim()) ? `${legend.trim()} — ${own}` : own, 200);
}

export function controlsIn(rect: Rect): { controls: RegionControl[]; elements: Map<string, Element[]> } {
  const controls: RegionControl[] = [];
  const elements = new Map<string, Element[]>();
  const radioGroups = new Map<string, HTMLInputElement[]>();
  const candidates = document.querySelectorAll<HTMLElement>(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea",
  );
  for (const el of candidates) {
    if (isPrismNode(el) || el.closest("prism-root")) continue;
    const r = el.getBoundingClientRect();
    const box = r.width || r.height ? r : (el.closest("label") ?? el.parentElement)!.getBoundingClientRect();
    if (!intersects(box, rect, 0.4)) continue;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const key = el.name || regionId(el);
      radioGroups.set(key, [...(radioGroups.get(key) ?? []), el]);
      continue;
    }
    const id = regionId(el);
    const sensitive = isSensitiveField(el);
    const input = el as HTMLInputElement;
    const control: RegionControl = {
      id,
      type: el instanceof HTMLSelectElement ? (el.multiple ? "multi-select" : "select") : el instanceof HTMLTextAreaElement ? "textarea" : input.type,
      label: labelFor(el),
      required: input.required || el.getAttribute("aria-required") === "true",
      options: el instanceof HTMLSelectElement ? [...el.options].map((o) => clean(o.text, 120)).filter(Boolean).slice(0, 80) : [],
      value: sensitive || input.type === "checkbox" ? "" : clean(el instanceof HTMLSelectElement ? [...el.selectedOptions].map((o) => o.text).join(", ") : input.value ?? "", 200),
      constraints: [
        input.pattern && `pattern ${input.pattern}`, input.maxLength > 0 && `max ${input.maxLength} characters`,
        input.min && `min ${input.min}`, input.max && `max ${input.max}`, input.placeholder && `example: ${input.placeholder}`,
        sensitive && "SENSITIVE: the person must type this themselves",
      ].filter(Boolean).join("; ").slice(0, 200),
      error: errorFor(el),
    };
    if (input.type === "checkbox") control.checked = input.checked;
    controls.push(control);
    elements.set(id, [el]);
  }
  for (const [, radios] of radioGroups) {
    const first = radios[0];
    const id = regionId(first);
    const legend = first.closest("fieldset")?.querySelector("legend")?.textContent ?? "";
    const label = clean(legend || first.closest("[role=radiogroup]")?.getAttribute("aria-label") || first.name, 200);
    controls.push({
      id, type: "radio-group", label, required: radios.some((r) => r.required),
      options: radios.map((r) => clean(accessibleName(r), 120)),
      value: clean(radios.find((r) => r.checked) ? accessibleName(radios.find((r) => r.checked)!) : "", 120),
      constraints: "", error: errorFor(first),
    });
    elements.set(id, radios);
  }
  return { controls: controls.slice(0, 60), elements };
}

export function imagesIn(rect: Rect): number {
  let count = 0;
  for (const el of document.querySelectorAll("img,canvas,video,svg,picture,[style*=background-image]")) {
    const r = el.getBoundingClientRect();
    if (r.width > 24 && r.height > 24 && intersects(r, rect, 0.2)) count++;
  }
  return count;
}

export function regionContext(rect: Rect, pagePurpose: string): {
  context: RegionContext; elements: Map<string, Element[]>; needsPicture: boolean;
} {
  const { text, surrounding } = textIn(rect);
  const { controls, elements } = controlsIn(rect);
  const imageCount = imagesIn(rect);
  return {
    context: {
      text, surrounding, controls, imageCount, pageTitle: clean(document.title, 200), pageUrl: location.href.slice(0, 500), pagePurpose,
    },
    elements,
    needsPicture: imageCount > 0 || text.replace(/\s/g, "").length < 40,
  };
}
