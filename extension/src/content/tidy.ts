/**
 * The tidy engine: base tidy (deterministic) → AI plan (cached) → apply, with restore, health checks,
 * and a mutation governor for dynamic pages and SPA route changes.
 */
import { hash, pageKeyFor } from "../shared/hash";
import { TidyPlanSchema } from "../shared/schemas";
import {
  getCachedPlan, getSettings, getSitePrefs, PLAN_VERSION, putCachedPlan, saveSitePrefs, touchCachedPlan,
} from "../shared/storage";
import { FONT_FILES, fontsFor, effectiveTokens, pageCss } from "../shared/styles";
import type { Result, Settings, StyleId, TidyPlan } from "../shared/types";
import { analyze, type AnalyzeResult, clean, isPrismNode, stripPrism } from "./analyzer";
import { analyzeLayout, type LayoutMode, ungroupCanvas } from "./layout";
import { repairContrast } from "./contrast";

export type TidyStatus = "off" | "base" | "planning" | "planned" | "cached" | "error";

export interface TidyState {
  status: TidyStatus;
  styleId: StyleId;
  message: string;
  pagePurpose: string;
  isOfficial: boolean;
  steps: { id: string; label: string }[];
  folds: { gid: string; label: string; count: number; open: boolean }[];
  hiddenClutter: number;
  clutterShown: boolean;
  contrastFixes: number;
  nextStep: string;
  aiCalls: number;
  cacheHit: boolean;
  lastPlanMs: number;
}

type Listener = (state: TidyState) => void;

const AI_BUDGET = 6;
const AI_WINDOW_MS = 10 * 60 * 1000;

export class TidyEngine {
  state: TidyState = {
    status: "off", styleId: "clear", message: "", pagePurpose: "", isOfficial: false, steps: [], folds: [],
    hiddenClutter: 0, clutterShown: false, contrastFixes: 0, nextStep: "", aiCalls: 0, cacheHit: false, lastPlanMs: 0,
  };
  private analysis: AnalyzeResult | null = null;
  private plan: TidyPlan | null = null;
  private pageKey = "";
  private listeners = new Set<Listener>();
  private observer: MutationObserver | null = null;
  private debounce = 0;
  private routeTimer = 0;
  private routeDebounce = 0;
  private lastHref = location.href;
  private aiCallTimes: number[] = [];
  private planFingerprint = "";
  private structureChangedAt = 0;
  private settings: Settings | null = null;
  private requestSeq = 0;
  private layoutCss = "";
  layoutMode: LayoutMode = "refine";
  /** Counters for tests and diagnostics. */
  debug = { analyzeRuns: 0, routeChanges: 0, planRequests: 0, planReasons: [] as string[] };

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<TidyState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  get active(): boolean {
    return this.state.status !== "off";
  }

  get ids(): Map<string, Element> {
    return this.analysis?.ids ?? new Map();
  }

  get currentPlan(): TidyPlan | null {
    return this.plan;
  }

  async enable(opts: { fromScratch?: boolean } = {}): Promise<void> {
    const settings = (this.settings = await getSettings());
    const site = await getSitePrefs(location.origin);
    const styleId = site.styleId ?? settings.styleId;
    const beforeWidth = document.documentElement.scrollWidth;

    this.analysis = analyze();
    this.debug.analyzeRuns++;
    this.detectLayout();
    this.pageKey = pageKeyFor(location.href);
    await this.applyStyle(styleId, settings);
    this.emit({ status: "base", styleId, message: "Tidied with Prism's basic clean-up.", steps: [], folds: [] });

    if (!this.healthy(beforeWidth)) {
      await this.disable("Prism couldn't tidy this page safely, so it's showing the original.");
      this.emit({ status: "error", message: "Prism couldn't tidy this page safely, so it's showing the original." });
      return;
    }
    this.startGovernor();
    await this.loadPlan(Boolean(opts.fromScratch || site.fromScratch));
  }

  async disable(message = ""): Promise<void> {
    this.stopGovernor();
    this.requestSeq++;
    ungroupCanvas();
    stripPrism();
    const html = document.documentElement;
    html.removeAttribute("data-prism-on");
    html.removeAttribute("data-prism-style");
    html.removeAttribute("data-prism-mode");
    this.layoutCss = "";
    await chrome.runtime.sendMessage({ type: "css:remove" }).catch(() => {});
    this.plan = null;
    this.analysis = null;
    this.emit({ status: "off", message, steps: [], folds: [], pagePurpose: "", cacheHit: false, hiddenClutter: 0, clutterShown: false, contrastFixes: 0, nextStep: "" });
  }

  async setStyle(styleId: StyleId): Promise<void> {
    await saveSitePrefs(location.origin, { styleId });
    if (!this.active) return;
    // Plans are style-independent, so switching Style never needs another AI call.
    await this.applyStyle(styleId, this.settings ?? (await getSettings()));
    this.emit({ styleId });
  }

  async refreshSettings(): Promise<void> {
    if (!this.active) return;
    this.settings = await getSettings();
    await this.applyStyle(this.state.styleId, this.settings);
  }

  async regenerate(): Promise<void> {
    if (!this.active) {
      await this.enable({ fromScratch: true });
      return;
    }
    await this.loadPlan(true);
  }

  toggleFold(gid: string): void {
    const fold = this.state.folds.find((f) => f.gid === gid);
    if (!fold) return;
    const open = !fold.open;
    for (const el of document.querySelectorAll(`[data-prism-collapsed="${gid}"]`)) {
      if (open) el.setAttribute("data-prism-open", "");
      else el.removeAttribute("data-prism-open");
    }
    this.emit({ folds: this.state.folds.map((f) => (f.gid === gid ? { ...f, open } : f)) });
    this.afterRender();
    for (const host of document.querySelectorAll(`prism-fold[data-gid="${gid}"]`)) renderFold(host as HTMLElement, fold.label, fold.count, open, () => this.toggleFold(gid));
  }

  focusStep(id: string): void {
    for (const el of document.querySelectorAll("[data-prism-step-active]")) el.removeAttribute("data-prism-step-active");
    const el = this.ids.get(id) ?? document.querySelector(`[data-prism-id="${id}"]`);
    if (!el) return;
    el.setAttribute("data-prism-step-active", "");
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    const focusable = el.matches("input,select,textarea,button,a[href]") ? el : el.querySelector("input,select,textarea,button,a[href]");
    (focusable as HTMLElement | null)?.focus({ preventScroll: true });
  }

  // ---------- internals ----------

  private async applyStyle(styleId: StyleId, settings: Settings) {
    const html = document.documentElement;
    html.setAttribute("data-prism-on", "");
    html.setAttribute("data-prism-style", styleId);
    loadFonts(fontsFor(effectiveTokens(styleId, settings)));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    await chrome.runtime.sendMessage({ type: "css:apply", css: `${pageCss(styleId, settings, reduced)}\n${this.layoutCss}` });
    await this.afterRender();
  }

  private lastRepair = 0;
  private repairTimer = 0;

  /** Re-check readability once the browser has applied the new styles (throttled for live pages). */
  private async afterRender(throttled = false) {
    if (throttled) {
      const wait = 2000 - (Date.now() - this.lastRepair);
      if (wait > 0) {
        clearTimeout(this.repairTimer);
        this.repairTimer = window.setTimeout(() => this.afterRender(), wait);
        return;
      }
    }
    this.lastRepair = Date.now();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!document.documentElement.hasAttribute("data-prism-on")) return;
    const fixed = repairContrast();
    const hidden = document.querySelectorAll("[data-prism-role=clutter]").length;
    this.emit({ contrastFixes: fixed.fixed + fixed.boxes, hiddenClutter: hidden, nextStep: this.choosePrimary() });
  }

  private nextEl: WeakRef<Element> | null = null;

  /**
   * The one thing the person most likely needs to do next becomes the page's hero button. Uses the AI
   * plan's primary action, or falls back to an obvious call to action in the main content.
   */
  private choosePrimary(): string {
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest("[data-prism-collapsed]:not([data-prism-open]),[data-prism-role=clutter]"); };
    let el = [...document.querySelectorAll("[data-prism-role=primary-action],[data-prism-emphasis=primary]")]
      .find((e) => e.matches("a[href],button,input[type=submit],input[type=button],[role=button]") && visible(e));
    if (!el) {
      const cta = /^\s*(start|apply|begin|continue|next|get started|sign up|register|book|renew|report|check|find|pay|claim|request|make a|submit|send|save and continue)\b/i;
      const scope = document.querySelector("[data-prism-role=main],main,[role=main],article") ?? document.body;
      el = [...scope.querySelectorAll("a[href],button,input[type=submit],[role=button]")]
        .find((e) => visible(e) && cta.test(((e as HTMLElement).innerText || (e as HTMLInputElement).value || "").trim()) && !e.closest("nav,header,footer,[role=navigation]"));
      if (el) el.setAttribute("data-prism-emphasis", "primary");
    }
    this.nextEl = el ? new WeakRef(el) : null;
    return el ? clean(((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim(), 60) : "";
  }

  /** Scrolls to the next step and makes it pulse so it's easy to find. */
  showNextStep(): void {
    const el = this.nextEl?.deref();
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.setAttribute("data-prism-step-active", "");
    (el as HTMLElement).focus({ preventScroll: true });
    setTimeout(() => el.removeAttribute("data-prism-step-active"), 4000);
  }

  /** Hidden clutter (adverts, promotions) can always be shown again from Prism's panel. */
  toggleClutter(): void {
    const show = !this.state.clutterShown;
    for (const el of document.querySelectorAll("[data-prism-role=clutter]")) {
      if (show) el.setAttribute("data-prism-open", ""); else if (!el.hasAttribute("data-prism-collapsed")) el.removeAttribute("data-prism-open");
    }
    this.emit({ clutterShown: show });
    this.afterRender();
  }

  /** Chaotic layouts (pinned "canvas" pages, layout tables) get reflowed; tidy sites are only refined. */
  private detectLayout() {
    // Detect against the page's own layout: undo any previous grouping/reflow first.
    ungroupCanvas();
    document.documentElement.removeAttribute("data-prism-mode");
    const layout = analyzeLayout();
    this.layoutMode = layout.mode;
    this.layoutCss = layout.orderCss;
    document.documentElement.setAttribute("data-prism-mode", layout.mode);
  }

  private healthy(beforeWidth: number): boolean {
    const after = document.documentElement.scrollWidth;
    const limit = Math.max(beforeWidth, document.documentElement.clientWidth) * 1.15 + 40;
    return after <= limit;
  }

  private prefsHash(): string {
    const s = this.settings!;
    return hash(`${s.clutterLevel}|${s.translateTo}`);
  }

  private budgetLeft(): boolean {
    const now = Date.now();
    this.aiCallTimes = this.aiCallTimes.filter((t) => now - t < AI_WINDOW_MS);
    return this.aiCallTimes.length < AI_BUDGET;
  }

  private async loadPlan(fromScratch: boolean, reason = "enable"): Promise<void> {
    const analysis = this.analysis;
    if (!analysis) return;
    const seq = ++this.requestSeq;
    const prefsHash = this.prefsHash();
    const cached = fromScratch ? undefined : await getCachedPlan(this.pageKey);
    if (cached && cached.planVersion === PLAN_VERSION && cached.prefsHash === prefsHash) {
      const resolvable = cached.idSignature.filter((id) => analysis.ids.has(id)).length / Math.max(1, cached.idSignature.length);
      if (cached.structureHash === analysis.structureHash || resolvable >= 0.85) {
        this.applyPlan(cached.plan);
        this.planFingerprint = analysis.structureHash;
        await touchCachedPlan(cached);
        this.emit({ status: "cached", cacheHit: true, message: "Tidied using this page's saved layout." });
        return;
      }
    }
    if (analysis.outline.elements.length < 3) {
      this.emit({ status: "base", message: "This page has very little Prism can organise, so it kept the basic clean-up." });
      return;
    }
    if (!this.budgetLeft()) {
      this.emit({ status: "base", message: "Kept the basic clean-up (Prism limits how often it asks the AI on one page)." });
      return;
    }
    this.aiCallTimes.push(Date.now());
    this.debug.planRequests++;
    this.debug.planReasons.push(`${reason} ${location.pathname}`);
    this.emit({ status: "planning", message: "Prism is studying the page…", aiCalls: this.state.aiCalls + 1, cacheHit: false });
    const started = performance.now();
    const settings = this.settings!;
    const result = (await chrome.runtime.sendMessage({
      type: "api", path: "/v1/plan",
      body: { outline: analysis.outline, style: this.state.styleId, clutterLevel: settings.clutterLevel, language: settings.translateTo },
    })) as Result<{ plan: TidyPlan }>;
    if (seq !== this.requestSeq || !this.active) return; // superseded or turned off meanwhile
    if (!result?.ok) {
      this.emit({ status: "base", message: `${result?.error?.message ?? "Prism's AI isn't available."} The basic clean-up is still on.` });
      return;
    }
    const parsed = TidyPlanSchema.safeParse(result.value.plan);
    if (!parsed.success) {
      this.emit({ status: "base", message: "Prism kept a simple tidy for this page." });
      return;
    }
    const applied = this.applyPlan(parsed.data);
    this.planFingerprint = analysis.structureHash;
    const lastPlanMs = Math.round(performance.now() - started);
    if (applied.rejectedRatio > 0.3) {
      // Too much of the plan didn't fit this page; keep the safe base tidy and don't cache.
      this.clearPlanAttrs();
      this.emit({ status: "base", message: "Prism kept a simple tidy for this page.", lastPlanMs });
      return;
    }
    await putCachedPlan({
      planVersion: PLAN_VERSION, pageKey: this.pageKey, structureHash: analysis.structureHash,
      idSignature: [...new Set(parsed.data.roles.map((r) => r.id))].slice(0, 300), prefsHash,
      plan: parsed.data, createdAt: Date.now(), lastUsedAt: Date.now(), hits: 0,
    });
    if (fromScratch) await saveSitePrefs(location.origin, { fromScratch: undefined });
    this.emit({ status: "planned", message: "Tidied by Prism.", lastPlanMs });
  }

  private clearPlanAttrs() {
    for (const el of document.querySelectorAll("[data-prism-emphasis],[data-prism-collapsed]")) {
      el.removeAttribute("data-prism-emphasis");
      el.removeAttribute("data-prism-collapsed");
      el.removeAttribute("data-prism-open");
    }
    for (const fold of document.querySelectorAll("prism-fold")) fold.remove();
  }

  /** Validates every instruction against the live page and protection rules, then applies it. */
  applyPlan(plan: TidyPlan): { rejectedRatio: number } {
    const analysis = this.analysis!;
    this.plan = plan;
    let total = 0;
    let rejected = 0;
    const ids = analysis.ids;
    const protectedIds = new Set([...analysis.protectedIds, ...plan.protect]);

    this.clearPlanAttrs();
    for (const { id, role } of plan.roles) {
      total++;
      const el = ids.get(id);
      if (!el) { rejected++; continue; }
      const isControl = el.hasAttribute("data-prism-c");
      if (role === "clutter" && (protectedIds.has(id) || el.contains(analysis.mainEl))) { rejected++; continue; }
      if (isControl && !["primary-action", "secondary-action", "field", "step", "clutter"].includes(role)) continue;
      if (["field", "text", "heading", "step", "media", "table"].includes(role)) continue; // descriptive only
      // A notice box needs real content: short links or labels styled as callouts get clipped and confuse.
      if ((role === "notice" || role === "required-notice") && (el.matches("a,button,label,input,select") || ((el as HTMLElement).innerText ?? "").trim().length < 25)) continue;
      el.setAttribute("data-prism-role", role);
    }
    for (const { id, level } of plan.emphasis) {
      total++;
      const el = ids.get(id);
      if (!el) { rejected++; continue; }
      el.setAttribute("data-prism-emphasis", level);
    }

    const folds: TidyState["folds"] = [];
    const mainText = (analysis.mainEl as HTMLElement | null)?.innerText?.length ?? 0;
    let collapsedText = 0;
    plan.collapse.forEach((group, gi) => {
      const gid = `g${gi}`;
      const members: Element[] = [];
      for (const id of group.ids) {
        total++;
        const el = ids.get(id);
        if (!el || protectedIds.has(id)) { rejected++; continue; }
        if (el === analysis.mainEl || (analysis.mainEl && el.contains(analysis.mainEl))) { rejected++; continue; }
        if (el.matches("main,form,[role=main],[role=alert],[role=dialog],dialog") ||
            el.querySelector("input:not([type=hidden]),select,textarea,form,[role=alert],[aria-live=assertive],[aria-invalid=true],[required]") ||
            el.contains(document.activeElement)) { rejected++; continue; }
        const textLen = (el as HTMLElement).innerText?.length ?? 0;
        if (analysis.mainEl?.contains(el)) {
          if (mainText && (collapsedText + textLen) / mainText > 0.4) { rejected++; continue; }
          collapsedText += textLen;
        }
        members.push(el);
      }
      if (!members.length) return;
      members.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      for (const el of members) el.setAttribute("data-prism-collapsed", gid);
      const label = group.label || "More";
      const host = document.createElement("prism-fold");
      host.setAttribute("data-gid", gid);
      members[0].before(host);
      renderFold(host, label, members.length, false, () => this.toggleFold(gid));
      folds.push({ gid, label, count: members.length, open: false });
    });

    const steps = plan.steps.filter((s) => ids.has(s.id));
    this.structuralIds = new Set(analysis.outline.elements
      .filter((e) => /^(header|nav|main|aside|footer|form|section|h[1-4]|button|input|select|textarea)$/.test(e.tag) || e.interactive)
      .map((e) => e.id));
    this.emit({ pagePurpose: plan.pagePurpose, isOfficial: plan.isOfficialSite, steps, folds });
    this.afterRender();
    return { rejectedRatio: total ? rejected / total : 0 };
  }

  private startGovernor() {
    this.stopGovernor();
    this.observer = new MutationObserver((records) => {
      let relevant = false;
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeType === 1 && !isPrismNode(n as Element) && !(n as Element).closest?.("prism-root,prism-fold")) { relevant = true; break; }
        }
        if (relevant) break;
      }
      if (!relevant) return;
      clearTimeout(this.debounce);
      this.debounce = window.setTimeout(() => this.onDomSettled(), 500);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.routeTimer = window.setInterval(() => {
      if (location.href !== this.lastHref) {
        clearTimeout(this.routeDebounce);
        this.routeDebounce = window.setTimeout(() => this.onRouteChange(), 700);
      }
    }, 800);
  }

  private stopGovernor() {
    this.observer?.disconnect();
    this.observer = null;
    clearTimeout(this.debounce);
    clearTimeout(this.routeDebounce);
    clearInterval(this.routeTimer);
  }

  /** New content: re-tag deterministically (no AI) and re-apply known plan roles. */
  private onDomSettled() {
    if (!this.active) return;
    // A client-side navigation changes the DOM before the URL poll notices; treat it as a route change.
    if (location.href !== this.lastHref) {
      this.onRouteChange();
      return;
    }
    this.analysis = analyze();
    this.debug.analyzeRuns++;
    if (this.plan) this.reapplyRoles(this.plan);
    this.afterRender(true);
    if (this.analysis.structureHash !== this.planFingerprint) {
      if (!this.structureChangedAt) this.structureChangedAt = Date.now();
      // Only a large, lasting structural change justifies another AI plan.
      const changed = this.changeRatio();
      if (changed > 0.25 && Date.now() - this.structureChangedAt > 1500) {
        this.structureChangedAt = 0;
        this.loadPlan(false, "structure");
      }
    } else {
      this.structureChangedAt = 0;
    }
  }

  private structuralIds = new Set<string>();

  private changeRatio(): number {
    if (!this.plan || !this.analysis) return 0;
    // Only structural pieces (landmarks, headings, forms, buttons) decide whether the page really changed;
    // rotating list items in live feeds don't.
    const planIds = [...new Set(this.plan.roles.map((r) => r.id))].filter((id) => this.structuralIds.has(id));
    if (!planIds.length) return 0;
    // Elements Prism itself hid (clutter, folds) are still on the page: only truly removed ones count.
    const missing = planIds.filter((id) => !this.analysis!.ids.has(id) && !document.querySelector(`[data-prism-id="${id}"]`)).length;
    return missing / planIds.length;
  }

  private reapplyRoles(plan: TidyPlan) {
    const ids = this.analysis!.ids;
    for (const { id, role } of plan.roles) {
      const el = ids.get(id);
      if (el && !el.hasAttribute("data-prism-role") && !["field", "text", "heading", "step", "media", "table"].includes(role)) {
        el.setAttribute("data-prism-role", role);
      }
    }
    for (const { id, level } of plan.emphasis) ids.get(id)?.setAttribute("data-prism-emphasis", level);
  }

  /** Called by both the URL poll and the DOM watcher; whichever arrives first handles the route. */
  private async onRouteChange() {
    if (!this.active || location.href === this.lastHref) return;
    this.lastHref = location.href;
    clearTimeout(this.routeDebounce);
    this.analysis = analyze();
    this.debug.analyzeRuns++;
    this.debug.routeChanges++;
    this.detectLayout();
    if (this.settings) await this.applyStyle(this.state.styleId, this.settings);
    this.pageKey = pageKeyFor(location.href);
    this.clearPlanAttrs();
    this.plan = null;
    await this.loadPlan(false, "route");
  }
}

// ---------- fonts ----------

const loadedFonts = new Set<string>();

export function loadFonts(families: string[]): void {
  for (const family of families) {
    if (loadedFonts.has(family)) continue;
    loadedFonts.add(family);
    const italic = family === "Prism Instrument";
    const face = new FontFace(family, `url(${chrome.runtime.getURL(FONT_FILES[family])})`,
      italic ? { style: "italic", weight: "400", display: "swap" } : { weight: "100 900", display: "swap" });
    face.load().then((f) => document.fonts.add(f)).catch(() => loadedFonts.delete(family));
  }
}

// ---------- fold buttons (in-page, isolated in their own shadow root) ----------

function renderFold(host: HTMLElement, label: string, count: number, open: boolean, onToggle: () => void) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = `
    :host{display:block!important;margin:10px 0!important;max-width:100%!important}
    button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:4px 12px 4px 9px;max-width:100%;
      font:500 13px/1.2 "Prism Inter",-apple-system,"Segoe UI",sans-serif;color:#3A3550;background:rgba(255,255,255,.7);
      border:1px dashed rgba(58,53,80,.45);border-radius:999px;cursor:pointer;transition:background .15s,border-color .15s}
    button:hover{background:#FFFFFF;border-color:#6D4AFF;color:#2A2540}
    button:focus-visible{outline:2px solid #6D4AFF;outline-offset:2px}
    .dot{width:6px;height:6px;flex:none;border-radius:50%;background:#6D4AFF}`;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", String(open));
  button.innerHTML = `<span class="dot" aria-hidden="true"></span>`;
  button.append(`${open ? "Hide" : "Show"} ${label.toLowerCase()} (${count})`);
  button.title = "Prism tucked this away to reduce clutter. Nothing was deleted.";
  button.setAttribute("aria-label", `${open ? "Hide" : "Show"} ${label.toLowerCase()}, ${count} ${count === 1 ? "item" : "items"} tucked away by Prism`);
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  });
  root.append(style, button);
}
