/**
 * The tidy engine: base tidy (deterministic) → AI plan (cached) → apply, with restore, health checks,
 * and a mutation governor for dynamic pages and SPA route changes.
 */
import { hash, pageKeyFor } from "../shared/hash";
import { t } from "../shared/i18n";
import {
  getCachedPlan, getSettings, getSitePrefs, PLAN_VERSION, putCachedPlan, saveSitePrefs, touchCachedPlan,
} from "../shared/storage";
import { FONT_FILES, fontsFor, effectiveTokens, pageCss } from "../shared/styles";
import type { Result, Settings, StyleId, TidyPlan } from "../shared/types";
import { analyze, type AnalyzeResult, clean, isPrismNode, stripPrism } from "./analyzer";
import { detectTouch, type Touch } from "./touch";
import { analyzeLayout, type LayoutMode, ungroupCanvas } from "./layout";
import { repairContrast, repairOverlaps } from "./contrast";

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
  nextOptions: string[];
  touch: Touch;
  aiCalls: number;
  cacheHit: boolean;
  lastPlanMs: number;
}

type Listener = (state: TidyState) => void;

const AI_BUDGET = 6;
const AI_WINDOW_MS = 10 * 60 * 1000;

export class TidyEngine {
  state: TidyState = {
    status: "off", styleId: "soft", message: "", pagePurpose: "", isOfficial: false, steps: [], folds: [],
    hiddenClutter: 0, clutterShown: false, contrastFixes: 0, nextStep: "", nextOptions: [], touch: "full", aiCalls: 0, cacheHit: false, lastPlanMs: 0,
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

  private enabling: Promise<void> | null = null;

  /** Turning tidying on twice at once (e.g. two popup clicks) runs it only once. */
  enable(opts: { fromScratch?: boolean } = {}): Promise<void> {
    if (this.enabling) return this.enabling;
    this.enabling = this.doEnable(opts).finally(() => { this.enabling = null; });
    return this.enabling;
  }

  private async doEnable(opts: { fromScratch?: boolean }): Promise<void> {
    const settings = (this.settings = await getSettings());
    const site = await getSitePrefs(location.origin);
    // A Style picked on this page wins over the stored one (another tab may be saving site choices too).
    const styleId = this.pickedStyle ?? site.styleId ?? settings.styleId;
    const beforeWidth = document.documentElement.scrollWidth;

    this.analysis = analyze();
    this.debug.analyzeRuns++;
    this.detectLayout();
    // The person can ask for the full makeover on a site; otherwise Prism decides from the page itself.
    this.touch = site.touch ?? detectTouch(this.layoutMode);
    document.documentElement.setAttribute("data-prism-touch", this.touch);
    this.pageKey = pageKeyFor(location.href);
    await this.applyStyle(this.pickedStyle ?? styleId, settings);
    this.emit({ status: "base", styleId: this.pickedStyle ?? styleId, touch: this.touch, message: t("Tidied with Prism's basic clean-up."), steps: [], folds: [] });

    if (!this.healthy(beforeWidth)) {
      await this.disable(t("Prism couldn't tidy this page safely, so it's showing the original."));
      this.emit({ status: "error", message: t("Prism couldn't tidy this page safely, so it's showing the original.") });
      return;
    }
    this.startGovernor();
    // The AI layout arrives in the background; callers (like the popup switch) don't wait for it.
    this.loadPlan(Boolean(opts.fromScratch || site.fromScratch)).catch((err) => {
      console.warn("Prism: plan failed", err);
      this.emit({ status: "base", message: t("Tidied with Prism's basic clean-up.") });
    });
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
    html.removeAttribute("data-prism-touch");
    this.layoutCss = "";
    await chrome.runtime.sendMessage({ type: "css:remove" }).catch(() => {});
    this.plan = null;
    this.analysis = null;
    this.emit({ status: "off", message, steps: [], folds: [], pagePurpose: "", cacheHit: false, hiddenClutter: 0, clutterShown: false, contrastFixes: 0, nextStep: "", nextOptions: [] });
  }

  /** The Style this site will use, known even before tidying is switched on (shown in the popup). */
  async initStyle(): Promise<void> {
    if (this.active) return;
    const [settings, site] = await Promise.all([getSettings(), getSitePrefs(location.origin)]);
    this.emit({ styleId: site.styleId ?? settings.styleId });
  }

  private pickedStyle: StyleId | null = null;

  async setStyle(styleId: StyleId): Promise<void> {
    this.pickedStyle = styleId;
    await saveSitePrefs(location.origin, { styleId });
    // Tidying is still switching on: let it finish, then this choice is applied below.
    if (this.enabling) await this.enabling.catch(() => {});
    if (!this.active) {
      // Remembered now, applied when tidying is switched on.
      this.emit({ styleId });
      return;
    }
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
    // The hero choice restyles elements, so it goes before contrast is measured.
    const nextStep = this.choosePrimary();
    repairOverlaps();
    const fixed = repairContrast();
    const hidden = document.querySelectorAll("[data-prism-role=clutter]").length;
    this.emit({ contrastFixes: fixed.fixed + fixed.boxes, hiddenClutter: hidden, nextStep });
  }

  private nextEl: WeakRef<Element> | null = null;

  /**
   * The one thing the person most likely needs to do next becomes the page's hero button. Uses the AI
   * plan's primary action, or falls back to an obvious call to action in the main content.
   */
  private choosePrimary(): string {
    // Really visible: not folded away, not a 1px screen-reader-only control, not inside a site dialog.
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width >= 24 && r.height >= 16 && !el.closest("[data-prism-collapsed]:not([data-prism-open]),[data-prism-role=clutter],dialog,[role=dialog],[aria-modal=true]");
    };
    // Side actions, vague links, media controls and links inside sentences are never "the next step".
    const sideAction = (e: Element) => {
      const label = labelOf(e);
      return /\b(report|feedback|survey|how this image|edited or created|cookie|privacy|terms|accessibility|share|print|subscribe|newsletter|sign up for (email|updates)|request sound|mute|unmute|volume|captions|full ?screen|transcript)\b/i.test(label) ||
        /^(learn more( here)?|read more|click here|more|see more|details|here|view more|find out more|more info|view all|see all|go|start here)\.?$/i.test(label.trim()) ||
        label.split(/\s+/).length > 8 || (e.matches("a[href]") && inRunningText(e));
    };
    // A site search is never "the next step": demote it if the plan marked it as the main action.
    const isSearch = (e: Element) => !!e.closest("[role=search],form:has(input[type=search]),form:has(input[name=q]),form:has(input[name*=search i])") ||
      /^(search|go|submit search)\b/i.test(((e as HTMLElement).innerText || (e as HTMLInputElement).value || e.getAttribute("aria-label") || "").trim());
    const marked = [...document.querySelectorAll("[data-prism-role=primary-action],[data-prism-emphasis=primary]")];
    // A menu item made into a hero button breaks the menu bar; slideshow arrows and cookie buttons aren't the task. All are demoted.
    const inNav = (e: Element) => !!e.closest("nav,[role=navigation],[role=menubar],[data-prism-role=nav]") ||
      !!e.closest("[class*=carousel i],[class*=slick i],[class*=swiper i],[class*=slider i],[aria-roledescription=carousel]") ||
      !!e.closest("[class*=cookie i],[id*=cookie i],[class*=consent i],[id*=consent i],[aria-label*=cookie i]") ||
      /^(next|previous|prev|pause|play|accept|accept all|accept necessary|agree|i agree|got it|ok|allow( all)?|decline|reject( all)?)( (image|slide|item|cookies))?$/i.test(((e as HTMLElement).innerText || e.getAttribute("aria-label") || "").trim());
    for (const e of marked) if (isSearch(e) || inNav(e)) { e.setAttribute("data-prism-role", "secondary-action"); e.removeAttribute("data-prism-emphasis"); }
    // A popup blocking the page comes first: point at its way through (Agree, Continue, Close).
    const blocker = blockingDialogButton();
    let el = blocker ?? marked.find((e) => !isSearch(e) && !inNav(e) && !sideAction(e) && e.matches("a[href],button,input[type=submit],input[type=button],[role=button]") && visible(e));
    const cta = /^\s*(start|apply|begin|continue|next|get started|sign up|register|book|renew|report|check|find|pay|claim|request|make a|submit|send|save and continue|log ?in|sign in|file|view|download|contact|add to (basket|cart|bag|trolley)|buy|order|checkout|check out|proceed)\b/i;
    const scope = document.querySelector("[data-prism-role=main],main,[role=main],article") ?? document.body;
    const ctas = [...scope.querySelectorAll("a[href],button,input[type=submit],[role=button]")]
      .filter((e) => visible(e) && !isSearch(e) && !inNav(e) && !sideAction(e) && cta.test(labelOf(e)) && !e.closest("nav,header,footer,[role=navigation]") && looksLikeButton(e));
    if (!el) {
      el = ctas[0];
      // Picture cards and tiles get the breathing ring only; turning them into a big button breaks them.
      if (el && !isPictureOrTile(el)) el.setAttribute("data-prism-emphasis", "primary");
    }
    if (el && isPictureOrTile(el)) el.removeAttribute("data-prism-emphasis");
    // Up to four other likely things to do: the plan's steps, other real actions, obvious buttons.
    const options: { label: string; el: Element }[] = [];
    const add = (e: Element | null | undefined, label?: string) => {
      if (!e || e === el || options.length >= 4 || !visible(e) || isSearch(e) || inNav(e) || sideAction(e) || options.some((o) => o.el === e)) return;
      const text = clean(label || labelOf(e), 60);
      if (!text || options.some((o) => o.label.toLowerCase() === text.toLowerCase())) return;
      options.push({ label: text, el: e });
    };
    for (const step of this.state.steps) add(this.ids.get(step.id) ?? document.querySelector(`[data-prism-id="${CSS.escape(step.id)}"]`), step.label);
    for (const e of document.querySelectorAll("[data-prism-role=primary-action],[data-prism-role=secondary-action]")) add(e);
    for (const e of ctas) add(e);
    const inMain = (e: Element) => !e.closest("nav,header,footer,[role=navigation],aside,[data-prism-role=aside],[data-prism-role=footer]");
    for (const e of scope.querySelectorAll("[data-prism-c=button],[data-prism-c=button-link]")) if (inMain(e)) add(e);
    for (const e of scope.querySelectorAll("a[href]")) if (inMain(e) && labelOf(e).split(/\s+/).length >= 2) add(e);
    this.optionEls = options.map((o) => new WeakRef(o.el));
    this.emit({ nextOptions: options.map((o) => o.label) });
    // The next step always carries a breathing outline so the eye is drawn to it.
    for (const old of document.querySelectorAll("[data-prism-next]")) if (old !== el) old.removeAttribute("data-prism-next");
    if (el) el.setAttribute("data-prism-next", "");
    this.nextEl = el ? new WeakRef(el) : null;
    return el ? clean(labelOf(el), 60) : "";
  }

  private optionEls: WeakRef<Element>[] = [];

  /** Scrolls to one of the "other things you can do" and gives it focus. */
  showOption(index: number): void {
    const el = this.optionEls[index]?.deref();
    if (el) this.reveal(el);
  }

  /** Scrolls to the next step and makes it pulse so it's easy to find. */
  showNextStep(): void {
    const el = this.nextEl?.deref();
    if (el) this.reveal(el);
  }

  private reveal(el: Element): void {
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
  touch: Touch = "full";

  /** Switch between the light touch and the full makeover for this website (remembered). */
  async setTouch(touch: Touch): Promise<void> {
    await saveSitePrefs(location.origin, { touch });
    this.touch = touch;
    if (!this.active) return;
    document.documentElement.setAttribute("data-prism-touch", touch);
    await this.afterRender();
    this.emit({ touch });
  }

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
    return hash(`strong|${s.translateTo}`);
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
        this.emit({ status: "cached", cacheHit: true, message: t("Tidied using this page's saved layout.") });
        return;
      }
    }
    if (analysis.outline.elements.length < 3) {
      this.emit({ status: "base", message: t("This page has very little Prism can organise, so it kept the basic clean-up.") });
      return;
    }
    if (!this.budgetLeft()) {
      this.emit({ status: "base", message: t("Kept the basic clean-up (Prism limits how often it asks the AI on one page).") });
      return;
    }
    this.aiCallTimes.push(Date.now());
    this.debug.planRequests++;
    this.debug.planReasons.push(`${reason} ${location.pathname}`);
    this.emit({ status: "planning", message: t("Prism is studying the page…"), aiCalls: this.state.aiCalls + 1, cacheHit: false });
    const started = performance.now();
    const settings = this.settings!;
    const result = (await chrome.runtime.sendMessage({
      type: "api", path: "/v1/plan",
      body: { outline: analysis.outline, style: this.state.styleId, clutterLevel: "strong", language: settings.translateTo },
    })) as Result<{ plan: TidyPlan }>;
    if (seq !== this.requestSeq || !this.active) return; // superseded or turned off meanwhile
    if (!result?.ok) {
      this.emit({ status: "base", message: t("{error} The basic clean-up is still on.", { error: result?.error?.message ?? t("Prism's AI isn't available.") }) });
      return;
    }
    // The service worker validated this plan against TidyPlanSchema (background/api.ts), so page code
    // doesn't bundle the validator; applyPlan still ignores any id that isn't on the page.
    const plan = result.value.plan as TidyPlan | undefined;
    if (!plan || !Array.isArray(plan.roles)) {
      this.emit({ status: "base", message: t("Prism kept a simple tidy for this page.") });
      return;
    }
    const applied = this.applyPlan(plan);
    this.planFingerprint = analysis.structureHash;
    const lastPlanMs = Math.round(performance.now() - started);
    if (applied.rejectedRatio > 0.3) {
      // Too much of the plan didn't fit this page; keep the safe base tidy and don't cache.
      this.clearPlanAttrs();
      this.emit({ status: "base", message: t("Prism kept a simple tidy for this page."), lastPlanMs });
      return;
    }
    await putCachedPlan({
      planVersion: PLAN_VERSION, pageKey: this.pageKey, structureHash: analysis.structureHash,
      idSignature: [...new Set(plan.roles.map((r) => r.id))].slice(0, 300), prefsHash,
      plan, createdAt: Date.now(), lastUsedAt: Date.now(), hits: 0,
    });
    if (fromScratch) await saveSitePrefs(location.origin, { fromScratch: undefined });
    this.emit({ status: "planned", message: t("Tidied by Prism."), lastPlanMs });
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
      // A link inside a sentence stays a link: a pill in the middle of running text breaks the reading line.
      if (role === "secondary-action" && el.matches("a[href]") && inRunningText(el)) continue;
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
    const light = document.documentElement.getAttribute("data-prism-touch") === "light";
    plan.collapse.forEach((group, gi) => {
      const gid = `g${gi}`;
      const members: Element[] = [];
      // On a well-designed site only real clutter is folded; its menus and related content are part of the design.
      if (light && group.reason !== "ads") return;
      for (const id of group.ids) {
        total++;
        const el = ids.get(id);
        if (!el || protectedIds.has(id)) { rejected++; continue; }
        if (el === analysis.mainEl || (analysis.mainEl && el.contains(analysis.mainEl))) { rejected++; continue; }
        if (el.matches("main,form,[role=main],[role=alert],[role=dialog],dialog") ||
            el.querySelector("input:not([type=hidden]),select,textarea,form,[role=alert],[aria-live=assertive],[aria-invalid=true],[required]") ||
            el.contains(document.activeElement)) { rejected++; continue; }
        // Site navigation stays (unless it's ads or social links), and safety information is never hidden.
        const links = el.querySelectorAll("a[href]").length;
        // (Deliberate refusals, not plan errors: they don't count against the plan.)
        if (!["ads", "social"].includes(group.reason) && (el.matches("nav,[role=navigation],aside,[role=complementary]") || el.closest("nav,[role=navigation]")) && links >= 4) { total--; continue; }
        if (/\b(crisis|988|emergency|suicide|scam|fraud|alert|warning|deadline|recall|outage)\b/i.test((el as HTMLElement).innerText ?? "")) { total--; continue; }
        const textLen = (el as HTMLElement).innerText?.length ?? 0;
        if (analysis.mainEl?.contains(el)) {
          if (mainText && (collapsedText + textLen) / mainText > 0.4) { rejected++; continue; }
          collapsedText += textLen;
        }
        members.push(liftToWrapper(el));
      }
      if (!members.length) return;
      for (const el of members) el.setAttribute("data-prism-collapsed", gid);
      // A box left with only pictures once its words are folded (a tile's photo) folds with them.
      for (const el of [...members]) {
        let box: Element | null = null;
        for (let up = el.parentElement, depth = 0; up && depth < 4; up = up.parentElement, depth++) {
          if (up === document.body || up === analysis.mainEl || (analysis.mainEl && up.contains(analysis.mainEl)) ||
            up.matches("main,form,[role=main]") || up.querySelector("input:not([type=hidden]),select,textarea") ||
            (hasUnfoldedText(up) && !onlyOrphansLeft(up))) break;
          box = up;
        }
        if (box && !box.hasAttribute("data-prism-collapsed")) { box.setAttribute("data-prism-collapsed", gid); members.push(box); }
      }
      members.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const outer = members.filter((m) => !members.some((o) => o !== m && o.contains(m)));
      members.splice(0, members.length, ...outer);
      const label = group.label || t("More");
      const host = document.createElement("prism-fold");
      host.setAttribute("data-gid", gid);
      members[0].before(host);
      // Count what the person would see (links and pictures), not how many boxes held them.
      const count = Math.max(members.length, members.reduce((n, m) => n + m.querySelectorAll("a[href],img").length, 0));
      renderFold(host, label, count, false, () => this.toggleFold(gid));
      folds.push({ gid, label, count, open: false });
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

/** The words a control shows (or its value / accessible label). */
function labelOf(el: Element): string {
  return ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim();
}

/** Does this element still show any words outside folded parts? */
/** A link that is mostly a picture, or a tall tile/card, rather than a button. */
function isPictureOrTile(el: Element): boolean {
  if (el.hasAttribute("data-prism-own")) return true;
  const r = el.getBoundingClientRect();
  if (r.height > 120 || r.width > 420) return true;
  return !!el.querySelector("img,picture,svg,video") && labelOf(el).length < 40 && r.height > 60;
}

/** Buttons, and links the site styled as buttons (filled or outlined), as opposed to plain text links. */
function looksLikeButton(el: Element): boolean {
  if (el.matches("button,input[type=submit],input[type=button],[role=button],[data-prism-c=button],[data-prism-c=button-link]")) return true;
  const cs = getComputedStyle(el);
  return (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || parseFloat(cs.borderTopWidth) >= 1;
}

/** If a dialog covers much of the screen, the button that gets the person past it. */
function blockingDialogButton(): Element | null {
  const area = innerWidth * innerHeight;
  // Marked-up dialogs, plus whatever floats over the middle of the screen (many popups aren't marked up).
  const floating: Element[] = [];
  for (const hit of document.elementsFromPoint(innerWidth / 2, innerHeight / 2)) {
    if (hit.closest("prism-root")) continue;
    for (let e: Element | null = hit; e && e !== document.body; e = e.parentElement) {
      const pos = getComputedStyle(e).position;
      if (pos === "fixed") { floating.push(e); break; }
    }
    if (floating.length) break;
  }
  const dialogs = [...document.querySelectorAll("dialog[open],[role=dialog],[role=alertdialog],[aria-modal=true]"), ...floating].filter((d) => {
    if (d.closest("prism-root")) return false;
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const marked = d.matches("dialog,[role=dialog],[role=alertdialog],[aria-modal=true]");
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width * r.height > area * 0.15 && (marked || r.width * r.height < area * 0.95) && r.top < innerHeight && r.bottom > 0;
  });
  for (const d of dialogs) {
    const buttons = [...d.querySelectorAll("button,a[href],[role=button],input[type=submit]")].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width >= 16 && r.height >= 16;
    });
    const go = buttons.find((b) => /^(agree|i agree|accept|accept all|accept and continue|continue|ok|okay|got it|i understand)$/i.test(labelOf(b)));
    const close = buttons.find((b) => /^(close|no thanks|no, thanks|not now|maybe later|dismiss|skip|×|x)$/i.test(labelOf(b)) || /close|dismiss/i.test(b.getAttribute("aria-label") ?? ""));
    if (go || close) return go ?? close!;
  }
  return null;
}

/** Is this link part of a sentence (other words around it in the same paragraph or list item)? */
function inRunningText(link: Element): boolean {
  const block = link.closest("p,li,dd,td,blockquote");
  if (!block) return false;
  // Only words that aren't themselves links or buttons count as the sentence around it.
  let prose = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest("a[href],button,[role=button]")) continue;
    prose += (n.textContent ?? "").replace(/\s+/g, " ").trim().length;
  }
  return prose > 25;
}

/** Text that still shows: not folded, not screen-reader-only, not a slideshow's Previous/Next/Pause button. */
function shownText(root: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest("[data-prism-collapsed],script,style,noscript,template,[aria-hidden=true],prism-fold")) continue;
    const r = parent.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const control = parent.closest("button,[role=button]");
    if (control && (control.textContent ?? "").trim().length <= 24) continue;
    out.push(node as Text);
  }
  return out;
}

function hasUnfoldedText(root: Element): boolean {
  return shownText(root).length > 0;
}

/** Folding a section's heading and links left only stray sentences: those go with them. */
function onlyOrphansLeft(root: Element): boolean {
  const shown = shownText(root);
  if (!shown.length || shown.length > 4) return false;
  return !shown.some((n) => n.parentElement?.closest("h1,h2,h3,h4,h5,h6,a[href],button,label,[role=heading]"));
}

/** A folded link that is all its list item holds takes the item with it, so no empty bullet is left behind. */
function liftToWrapper(el: Element): Element {
  let target = el;
  const text = (el as HTMLElement).innerText?.trim() ?? "";
  while (target.parentElement?.matches("li,dt,dd,p") && (target.parentElement.innerText?.trim() ?? "") === text) target = target.parentElement;
  return target;
}

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
  const vars = { label: label.toLowerCase(), count };
  button.append(open ? t("Hide {label} ({count})", vars) : t("Show {label} ({count})", vars));
  button.setAttribute("aria-label", open
    ? (count === 1 ? t("Hide {label}, {count} item", vars) : t("Hide {label}, {count} items", vars))
    : (count === 1 ? t("Show {label}, {count} item", vars) : t("Show {label}, {count} items", vars)));
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  });
  root.append(style, button);
}
