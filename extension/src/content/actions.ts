/**
 * Performs real page interactions for Fill out and Chat, with the site's own events and validation.
 * Policy (what needs confirmation, what is forbidden) is enforced here, never left to the model.
 */
import type { ActionCheck, ActionOutcome } from "../shared/chat";
import type { ChatAction, FieldSuggestion } from "../shared/types";
import { accessibleName, analyze, clean, isSensitiveField } from "./analyzer";
import { findById } from "./region";

const CONSEQUENTIAL = /\b(submit|send|pay|payment|buy|purchase|order|checkout|check out|confirm|delete|remove|cancel|unsubscribe|sign|agree|accept|apply|transfer|book|donate|place|complete|finish|register|log ?out|sign ?out|publish|post|save and continue|continue to payment)\b/i;

// ---------- low-level value setting (works with React/Vue controlled inputs) ----------

function nativeSetter(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, "value")!.set!;
}

function fire(el: Element, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
}

export function setText(el: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  el.focus({ preventScroll: true });
  nativeSetter(el).call(el, value);
  el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: value, inputType: "insertText" }));
  fire(el, "change");
  el.blur();
  return el.value === value;
}

function matchOption(options: HTMLOptionElement[], wanted: string): HTMLOptionElement | undefined {
  const w = wanted.trim().toLowerCase();
  return options.find((o) => o.text.trim().toLowerCase() === w) ??
    options.find((o) => o.value.toLowerCase() === w) ??
    options.find((o) => o.text.trim().toLowerCase().startsWith(w));
}

export function selectValues(el: HTMLSelectElement, values: string[]): boolean {
  const options = [...el.options];
  const picks = values.map((v) => matchOption(options, v)).filter(Boolean) as HTMLOptionElement[];
  if (!picks.length) return false;
  el.focus({ preventScroll: true });
  if (el.multiple) {
    for (const o of options) o.selected = picks.includes(o);
  } else {
    nativeSetter(el).call(el, picks[0].value);
  }
  fire(el, "input");
  fire(el, "change");
  el.blur();
  return picks.every((p) => p.selected);
}

export function setChecked(el: HTMLInputElement, checked: boolean): boolean {
  if (el.checked !== checked) el.click(); // the site's own click handlers run
  if (el.checked !== checked) {
    el.checked = checked;
    fire(el, "change");
  }
  return el.checked === checked;
}

function pickRadio(radios: HTMLInputElement[], label: string): boolean {
  const w = label.trim().toLowerCase();
  const target = radios.find((r) => accessibleName(r).trim().toLowerCase() === w) ??
    radios.find((r) => r.value.toLowerCase() === w) ??
    radios.find((r) => accessibleName(r).toLowerCase().includes(w));
  if (!target) return false;
  if (!target.checked) target.click();
  return target.checked;
}

// ---------- Fill out ----------

export interface UndoRecord {
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  kind: "text" | "select" | "check";
  previous: string | string[] | boolean;
}

export interface FillResult {
  changed: { id: string; label: string; value: string }[];
  failed: { id: string; label: string; reason: string }[];
  undo: UndoRecord[];
  submitsBlocked: number;
}

/** Applies reviewed suggestions. Never submits: any submit during apply is cancelled and counted. */
export function applyFill(suggestions: FieldSuggestion[], elements: Map<string, Element[]>): FillResult {
  const result: FillResult = { changed: [], failed: [], undo: [], submitsBlocked: 0 };
  const blockSubmit = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); result.submitsBlocked++; };
  document.addEventListener("submit", blockSubmit, true);
  try {
    for (const s of suggestions) {
      const els = elements.get(s.id) ?? [findById(s.id)].filter(Boolean) as Element[];
      const el = els[0];
      if (!el) { result.failed.push({ id: s.id, label: s.id, reason: "The field is no longer on the page." }); continue; }
      const label = clean(fieldLabel(el), 80);
      if (isSensitiveField(el)) { result.failed.push({ id: s.id, label, reason: "Please type this one yourself." }); continue; }
      let ok = false;
      let shown = "";
      if (el instanceof HTMLInputElement && el.type === "radio") {
        const radios = els as HTMLInputElement[];
        const prev = radios.find((r) => r.checked);
        result.undo.push(...radios.map((r) => ({ el: r, kind: "check" as const, previous: r === prev })));
        ok = pickRadio(radios, s.optionValues[0] ?? s.value);
        shown = s.optionValues[0] ?? s.value;
      } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
        result.undo.push({ el, kind: "check", previous: el.checked });
        ok = setChecked(el, s.checked);
        shown = s.checked ? "ticked" : "not ticked";
      } else if (el instanceof HTMLSelectElement) {
        result.undo.push({ el, kind: "select", previous: [...el.selectedOptions].map((o) => o.value) });
        const values = s.optionValues.length ? s.optionValues : [s.value];
        ok = selectValues(el, values);
        shown = values.join(", ");
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        result.undo.push({ el, kind: "text", previous: el.value });
        ok = setText(el, s.value);
        shown = s.value;
      }
      if (ok) {
        result.changed.push({ id: s.id, label, value: shown });
        flash(el);
      } else {
        result.failed.push({ id: s.id, label, reason: "The website didn't accept this value. You may need to enter it yourself." });
      }
    }
  } finally {
    // Let any queued submit attempt (e.g. from an Enter key handler) hit the guard first.
    setTimeout(() => document.removeEventListener("submit", blockSubmit, true), 300);
  }
  return result;
}

/** The question a control answers: a radio group's legend, otherwise the control's own label. */
export function fieldLabel(el: Element): string {
  if (el instanceof HTMLInputElement && el.type === "radio") {
    const legend = el.closest("fieldset")?.querySelector("legend")?.textContent;
    const group = el.closest("[role=radiogroup]")?.getAttribute("aria-label");
    return (legend ?? group ?? el.name).trim();
  }
  return accessibleName(el);
}

export function undoFill(records: UndoRecord[]): void {
  for (const r of [...records].reverse()) {
    if (r.kind === "text") setText(r.el as HTMLInputElement, r.previous as string);
    else if (r.kind === "check") {
      const el = r.el as HTMLInputElement;
      if (el.type === "radio") { if (r.previous && !el.checked) el.click(); }
      else setChecked(el, r.previous as boolean);
    } else {
      const sel = r.el as HTMLSelectElement;
      for (const o of sel.options) o.selected = (r.previous as string[]).includes(o.value);
      fire(sel, "input");
      fire(sel, "change");
    }
    r.el.removeAttribute("data-prism-filled");
  }
}

function flash(el: Element) {
  el.setAttribute("data-prism-filled", "");
  const target = (el as HTMLInputElement).type === "radio" || (el as HTMLInputElement).type === "checkbox"
    ? (el.closest("label") ?? el) : el;
  (target as HTMLElement).style.setProperty("outline", "3px solid #4B3FD1", "important");
  (target as HTMLElement).style.setProperty("outline-offset", "3px", "important");
  setTimeout(() => {
    (target as HTMLElement).style.removeProperty("outline");
    (target as HTMLElement).style.removeProperty("outline-offset");
  }, 4000);
}

// ---------- Chat actions ----------

function describe(action: ChatAction, el: Element | null): string {
  const name = el ? clean(accessibleName(el), 60) || el.tagName.toLowerCase() : "";
  switch (action.name) {
    case "click": return `Press “${name}”`;
    case "type_text": return `Type “${clean(String(action.args.text ?? ""), 60)}” into “${name}”`;
    case "select_option": return `Choose “${(action.args.values as string[] | undefined)?.join(", ")}” for “${name}”`;
    case "set_checkbox": return `${action.args.checked ? "Tick" : "Untick"} “${name}”`;
    case "scroll": return "Scroll the page";
    case "navigate": return `Open ${String(action.args.url ?? "")}`;
    default: return action.name;
  }
}

function isSubmitControl(el: Element): boolean {
  if (el instanceof HTMLButtonElement) return (el.type === "submit" || !el.getAttribute("type")) && !!el.form;
  if (el instanceof HTMLInputElement) return el.type === "submit" || el.type === "image";
  return false;
}

function pageHasPaymentFields(): boolean {
  return !!document.querySelector("input[autocomplete^=cc-],input[name*=card i],input[id*=card i],iframe[src*=stripe],iframe[src*=checkout]");
}

export function checkAction(action: ChatAction): ActionCheck {
  if (action.name === "navigate") {
    let url: URL;
    try { url = new URL(String(action.args.url ?? ""), location.href); } catch { return { ok: false, risk: "forbidden", description: "Open an invalid address", reason: "That web address isn't valid." }; }
    if (!/^https?:$/.test(url.protocol)) return { ok: false, risk: "forbidden", description: `Open ${url.href}`, reason: "Prism only opens normal web pages." };
    const description = `Open ${url.host}${url.pathname}`;
    return { ok: true, risk: url.origin === location.origin ? "routine" : "consequential", description: url.origin === location.origin ? description : `${description} (a different website)` };
  }
  if (action.name === "scroll") return { ok: true, risk: "routine", description: "Scroll the page" };
  const el = findById(String(action.args.id ?? ""));
  if (!el) return { ok: false, risk: "routine", description: action.name, reason: "I couldn't find that part of the page any more." };
  const description = describe(action, el);
  const rect = el.getBoundingClientRect();
  const hidden = rect.width === 0 && rect.height === 0 && !(el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox"));
  if (hidden) return { ok: false, risk: "routine", description, reason: "That part of the page is hidden right now." };
  if ((el as HTMLButtonElement).disabled) return { ok: false, risk: "routine", description, reason: "That control is switched off (disabled) right now." };
  if (action.name === "type_text" && isSensitiveField(el)) {
    return { ok: false, risk: "forbidden", description, reason: "This looks like a password, card or ID field. Please type it yourself — Prism never enters these." };
  }
  if (action.name === "set_checkbox" || (action.name === "click" && el instanceof HTMLInputElement && el.type === "checkbox")) {
    // Agreeing to declarations, terms or consent is a legal commitment: always ask first.
    if (/\b(agree|declar|consent|confirm|terms|accept|certify)\w*/i.test(fieldLabel(el))) {
      return { ok: true, risk: "consequential", description };
    }
  }
  if (action.name === "click") {
    const name = accessibleName(el);
    if (el instanceof HTMLAnchorElement && el.href) {
      const url = new URL(el.href, location.href);
      if (url.origin !== location.origin) return { ok: true, risk: "consequential", description: `${description} (opens ${url.host})` };
      if (/\.(pdf|zip|exe|dmg|docx?|xlsx?)$/i.test(url.pathname) || el.hasAttribute("download")) {
        return { ok: false, risk: "forbidden", description, reason: "That link downloads a file. Please click it yourself if you want it." };
      }
    }
    if (isSubmitControl(el) || CONSEQUENTIAL.test(name) || (pageHasPaymentFields() && /button|submit/i.test(el.tagName + (el.getAttribute("role") ?? "")))) {
      return { ok: true, risk: "consequential", description };
    }
  }
  return { ok: true, risk: "routine", description };
}

/** Bumped when the person presses Stop, so an action that hasn't happened yet never happens. */
let stopToken = 0;
export function cancelPendingActions(): void {
  stopToken++;
}

export async function executeAction(action: ChatAction): Promise<ActionOutcome> {
  const token = stopToken;
  let navigating = false;
  const onLeave = () => { navigating = true; };
  addEventListener("pagehide", onLeave, { once: true });
  addEventListener("beforeunload", onLeave, { once: true });
  const startHref = location.href;
  try {
    if (token !== stopToken) return { ok: false, message: "Stopped by the person before this happened." };
    if (action.name === "navigate") {
      const url = new URL(String(action.args.url), location.href);
      setTimeout(() => { location.href = url.href; }, 50);
      return { ok: true, message: `Opening ${url.href}`, navigating: true, url: url.href };
    }
    if (action.name === "scroll") {
      const target = String(action.args.target ?? "down");
      if (target === "up" || target === "down") scrollBy({ top: (target === "down" ? 1 : -1) * innerHeight * 0.8 });
      else findById(target)?.scrollIntoView({ block: "center" });
      return { ok: true, message: "Scrolled." };
    }
    const el = findById(String(action.args.id ?? ""));
    if (!el) return { ok: false, message: "That element is no longer on the page." };
    el.scrollIntoView({ block: "center" });
    flash(el);
    await new Promise((r) => setTimeout(r, 250));
    if (token !== stopToken) return { ok: false, message: "Stopped by the person before this happened." };
    let ok = true;
    let message = "Done.";
    if (action.name === "click") {
      (el as HTMLElement).click();
    } else if (action.name === "type_text") {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return { ok: false, message: "That isn't a text field." };
      ok = setText(el, String(action.args.text ?? ""));
      message = ok ? "Typed." : "The field didn't keep the text.";
    } else if (action.name === "select_option") {
      const values = (action.args.values as string[]) ?? [];
      if (el instanceof HTMLSelectElement) ok = selectValues(el, values);
      else if (el instanceof HTMLInputElement && el.type === "radio") {
        const radios = el.name ? [...document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`)] : [el];
        ok = pickRadio(radios, values[0] ?? "");
      } else { (el as HTMLElement).click(); }
      message = ok ? "Chosen." : "None of those options matched.";
    } else if (action.name === "set_checkbox") {
      ok = el instanceof HTMLInputElement ? setChecked(el, Boolean(action.args.checked)) : false;
      message = ok ? "Updated." : "That isn't a checkbox.";
    }
    await new Promise((r) => setTimeout(r, 700));
    if (navigating || location.href !== startHref) {
      return { ok, message: "The page is changing.", navigating: navigating, url: location.href };
    }
    const errors = [...document.querySelectorAll("[role=alert],[aria-invalid=true],.error-message,.govuk-error-message")]
      .map((e) => clean(e.textContent ?? "", 120)).filter(Boolean).slice(0, 4);
    if (errors.length) message += ` The page now shows: ${errors.join(" | ")}`;
    return { ok, message };
  } finally {
    removeEventListener("pagehide", onLeave);
    removeEventListener("beforeunload", onLeave);
  }
}

/** Compact text description of the page for the chat model (non-sensitive field values only). */
export function observePage(): string {
  const { outline, ids } = analyze();
  const lines = [`Title: ${document.title}`, `Address: ${location.href}`, `Scroll: ${Math.round(scrollY)} of ${document.documentElement.scrollHeight}px`];
  let size = 0;
  for (const item of outline.elements) {
    const el = ids.get(item.id);
    if (!el) continue;
    let line = `[${item.id}] ${item.role || item.tag}`;
    if (item.name) line += ` “${item.name}”`;
    if (item.text) line += `: ${item.text}`;
    if (item.field) {
      const sensitive = isSensitiveField(el);
      const input = el as HTMLInputElement;
      if (input.type === "checkbox" || input.type === "radio") line += input.checked ? " (ticked)" : " (not ticked)";
      else if (el instanceof HTMLSelectElement) line += ` options: ${[...el.options].slice(0, 15).map((o) => o.text.trim()).join(" / ")}; selected: ${el.selectedOptions[0]?.text ?? ""}`;
      else if (!sensitive) line += input.value ? ` value: “${clean(input.value, 80)}”` : " (empty)";
      else line += " (sensitive — person must type)";
      if (item.field.required) line += " [required]";
      if (el.getAttribute("aria-invalid") === "true") line += " [invalid]";
    }
    if ((el as HTMLButtonElement).disabled) line += " [disabled]";
    if (el.closest("[data-prism-collapsed]:not([data-prism-open])")) line += " [tucked away by Prism]";
    lines.push(line);
    size += line.length;
    if (size > 15000) break;
  }
  return lines.join("\n");
}
