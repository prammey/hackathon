/**
 * Guide me's spotlight. Everything is dimmed except a cut-out around the one thing to use; clicks pass
 * straight through the cut-out to the real element. The person does the click or the typing; noticing it
 * moves the guide on.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { GuideState, GuideStep } from "../background/guide";
import { t } from "../shared/i18n";
import { Icon, MicButton, useLanguage } from "../ui/components";
import { findById } from "./region";

function send(message: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch(() => undefined);
}

const PAD = 10;
const CONSEQUENTIAL = /\b(submit|send|pay|payment|buy|purchase|place (your )?order|checkout|check out|confirm|delete|remove|transfer|donate|reserve|agree|accept|e-?sign|sign (and|&) submit|book (now|it|this|appointment))\b/i;

function isConsequential(el: Element): boolean {
  const label = ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim();
  // Moving between the pages of a form, or looking something up, commits nothing.
  if (/^(next|continue|go|search|find|look ?up|get weather|start)\b/i.test(label)) return false;
  const form = (el as HTMLButtonElement).form ?? el.closest("form");
  const fields = form ? form.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=checkbox]):not([type=radio]),select,textarea").length : 0;
  const searchForm = fields <= 1 || !!form && (!!form.querySelector("input[type=search],input[name=q],input[name*=search i],input[placeholder*=search i]") || form.matches("[role=search]") || /search/i.test(label));
  const submit = !searchForm && ((el instanceof HTMLButtonElement && (el.type === "submit" || !el.getAttribute("type")) && !!el.form) || (el instanceof HTMLInputElement && el.type === "submit"));
  if (submit) return true;
  // A plain link only warns for unmistakable words; buttons for the whole list.
  if (el.matches("a[href]") && !el.matches("[role=button]")) return /\b(pay|buy|purchase|place (your )?order|send|submit|confirm|delete)\b/i.test(label);
  return CONSEQUENTIAL.test(label);
}

/** What the person actually sees: a styled checkbox or radio hides its real input, so point at its label. */
function visibleTarget(el: Element): Element {
  const r = el.getBoundingClientRect();
  if (r.width >= 6 && r.height >= 6 && getComputedStyle(el).opacity !== "0") return el;
  const label = (el as HTMLInputElement).labels?.[0] ?? el.closest("label");
  if (label && label.getBoundingClientRect().width > 0) return label;
  let parent = el.parentElement;
  for (let i = 0; parent && i < 3; i++, parent = parent.parentElement) {
    const pr = parent.getBoundingClientRect();
    if (pr.width >= 12 && pr.height >= 12) return parent;
  }
  return el;
}

/**
 * The step's element. Sites that redraw themselves (React, Angular) can replace it after Prism marked it,
 * so when the mark is gone, look for the control named in quotes in the instruction instead.
 */
function locate(step: GuideStep): Element | null {
  const byId = step.id ? findById(step.id) : null;
  if (byId?.isConnected) return byId;
  const quoted = step.instruction.match(/["“«„]([^"”»“]{2,80})["”»“]/)?.[1]?.trim().toLowerCase();
  if (!quoted) return null;
  const candidates = [...document.querySelectorAll("a,button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem]")]
    .filter((c) => !c.closest("prism-root") && c.getBoundingClientRect().width > 0);
  const name = (c: Element) => ((c as HTMLElement).innerText || (c as HTMLInputElement).value || c.getAttribute("aria-label") || (c as HTMLInputElement).placeholder || c.getAttribute("title") || "").trim().toLowerCase();
  return candidates.find((c) => name(c) === quoted) ?? candidates.find((c) => name(c).includes(quoted)) ?? null;
}

/**
 * Pressing the card must not count as "clicking away" on the page: that closes a search box's suggestions
 * (weather sites, address lookups) right when the next step is to pick one.
 */
function keepPageFocus(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

/** A gentle enlargement where it can't break the page's layout (buttons and links on their own line). */
function canEnlarge(el: Element): boolean {
  if (el.closest("td,th,li a,p a,nav,[role=menubar]")) return false;
  const r = el.getBoundingClientRect();
  return r.height < 90 && r.width < 520 && el.matches("a,button,input[type=submit],input[type=button],[role=button],select");
}

function useTargetBox(el: Element | null): DOMRect | null {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!el) { setBox(null); return; }
    let frame = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      setBox((prev) => (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [el]);
  return box;
}

export function GuideLayer() {
  useLanguage();
  const [state, setState] = useState<GuideState | null>(null);
  const [typed, setTyped] = useState(false);
  /** The person is using a dropdown or text box: lift the dim so its list or suggestions can be picked. */
  const [engaged, setEngaged] = useState(false);
  const target = useRef<Element | null>(null);
  const [el, setEl] = useState<Element | null>(null);
  /** The element the person sees for `el` (its label when the real input is hidden). */
  const [view, setView] = useState<Element | null>(null);
  /** Bumped when the page replaced the step's element, to find it again. */
  const [found, setFound] = useState(0);
  const boxRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const onMsg = (msg: { type?: string; state?: GuideState }) => {
      if (msg?.type === "guide:update") setState(msg.state && msg.state.status !== "stopped" ? msg.state : null);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    send({ type: "guide:state" }).then((s) => setState((s as GuideState | null) ?? null));
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  // "You're done" steps aside on its own after a while, so it never sits on top of other buttons.
  useEffect(() => {
    if (state?.status !== "done") return;
    const timer = setTimeout(() => send({ type: "guide:stop" }), 15000);
    return () => clearTimeout(timer);
  }, [state?.status]);

  // Find the element for the current step, bring it into view, enlarge it gently.
  const step = state?.status === "showing" ? state.step : undefined;
  useEffect(() => {
    setTyped(false);
    setEngaged(false);
    const found = step ? locate(step) : null;
    target.current = found;
    setEl(found);
    if (!found) { setView(null); return; }
    const seen = visibleTarget(found);
    setView(seen);
    seen.setAttribute("data-prism-guide", "");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    seen.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    const html = found as HTMLElement;
    const before = html.getAttribute("style");
    if (seen === found && canEnlarge(found)) {
      html.style.setProperty("transition", reduce ? "none" : "transform .25s ease", "important");
      html.style.setProperty("transform", "scale(1.12)", "important");
      html.style.setProperty("transform-origin", "center", "important");
    }
    if (step?.kind === "type") (found as HTMLElement).focus({ preventScroll: true });
    return () => {
      seen.removeAttribute("data-prism-guide");
      if (before === null) html.removeAttribute("style");
      else html.setAttribute("style", before);
    };
  }, [step?.id, step?.instruction, found]);

  // Keep hold of the element if the page redraws it; if it's really gone, ask for a fresh step.
  useEffect(() => {
    if (!step) return;
    let misses = 0;
    const timer = setInterval(() => {
      const shows = (e: Element | null) => !!e?.isConnected && visibleTarget(e).getBoundingClientRect().width > 0;
      if (shows(target.current)) { misses = 0; return; }
      const again = locate(step);
      if (again && again !== target.current && shows(again)) { misses = 0; setFound((n) => n + 1); return; }
      if (++misses === 3) send({ type: "guide:lost" });
    }, 1000);
    return () => clearInterval(timer);
  }, [step?.id, step?.instruction]);

  // Notice the person doing the step.
  useEffect(() => {
    if (!step || !el) return;
    let leaving = false;
    const onLeave = () => { leaving = true; };
    addEventListener("pagehide", onLeave);
    const inside = (e: Event) => e.composedPath().includes(el) || (!!view && e.composedPath().includes(view));
    // A press inside the spotlight counts only if the page swapped the element out from under it; while
    // it's still there, a press on something next to it isn't the step.
    const inHole = (e: Event) => {
      if (el.isConnected) return false;
      const b = boxRef.current;
      const { clientX: x, clientY: y } = e as MouseEvent;
      return !!b && !!(x || y) && x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 4 && y <= b.bottom + 4;
    };
    const onEngage = (e: Event) => { if ((step.kind === "choose" || step.kind === "type") && (inside(e) || inHole(e))) setEngaged(true); };
    let pressed = false;
    // Some sites act on pointerdown and redraw before a click ever arrives, so either one counts.
    const onClick = (e: Event) => {
      if (step.kind !== "click" || pressed || !(inside(e) || inHole(e))) return;
      pressed = true;
      // If the click opens a new page, that page carries the guide on; otherwise report it here. A link to
      // another page gets longer to start loading, so the guide doesn't plan the next step twice.
      const link = (el.closest("a[href]") as HTMLAnchorElement | null)?.getAttribute("href") ?? "";
      const leavesPage = !!link && !/^(#|javascript:)/i.test(link);
      // Tell the planner whether the click visibly did anything, so "it worked" is never assumed.
      const before = location.href;
      let changes = 0;
      const watch = new MutationObserver((records) => { changes += records.length; });
      watch.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      setTimeout(() => {
        watch.disconnect();
        if (leaving) return;
        const result = location.href !== before ? "clicked it; the page changed" : changes > 2 ? "clicked it; something on the page changed" : "clicked it, but nothing on the page changed";
        send({ type: "guide:advanced", result });
      }, leavesPage ? 4000 : 1200);
    };
    // Typing may bring up suggestions below the box (towns, addresses): they need to be clickable.
    const onInput = () => { setTyped(!!(el as HTMLInputElement).value); setEngaged(true); };
    const onChange = () => { if (step.kind === "choose") send({ type: "guide:advanced", result: "chose an option" }); };
    const onKey = (e: KeyboardEvent) => {
      if (step.kind === "type" && e.key === "Enter" && inside(e) && (el as HTMLInputElement).value) {
        setTimeout(() => { if (!leaving) send({ type: "guide:advanced", result: "typed it and pressed Enter" }); }, 700);
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerdown", onClick, true);
    document.addEventListener("pointerdown", onEngage, true);
    el.addEventListener("input", onInput);
    el.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey, true);
    return () => {
      removeEventListener("pagehide", onLeave);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerdown", onClick, true);
      document.removeEventListener("pointerdown", onEngage, true);
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [step?.id, step?.instruction, el, view]);

  const box = useTargetBox(step ? view : null);
  boxRef.current = box;
  if (!state) return null;
  // Prism's own rule, not only the AI's judgement: anything that submits, pays, sends or books gets the warning.
  const caution = !!step && (step.caution || (!!el && isConsequential(el)));

  const stop = () => send({ type: "guide:stop" });
  const stepNo = state.shown.length || 1;
  const panel = (body: preact.ComponentChildren, extra?: preact.ComponentChildren, where = "center") => (
    <div class={`guide-card guide-card--${where} pz-card`} role="dialog" aria-label={t("Guide me")} data-testid="guide-card">
      <span class="guide-card__goal">{t("Guide me")}: {state.goal}</span>
      {body}
      <div class="guide-card__row">
        {extra}
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={stop} data-testid="guide-stop"><Icon name="close" /> {t("Stop")}</button>
      </div>
    </div>
  );

  if (state.status === "thinking") {
    return panel(<p class="guide-card__text" role="status"><span class="pz-progress" aria-hidden="true" /> {t("Finding the next step…")}</p>);
  }
  if (state.status === "asking" && state.step) {
    return <GuideQuestion state={state} onStop={stop} />;
  }
  if (state.status === "done" || state.status === "stuck") {
    const text = state.step?.instruction || state.error || t("I couldn't find the next step.");
    // "Done" sits low on the screen so the result it's talking about stays visible.
    return panel(
      <p class="guide-card__text" data-testid="guide-final">{state.status === "done" ? <Icon name="check" /> : null} {text}</p>,
      state.status === "stuck"
        ? <>
            <button class="pz-btn pz-btn--small" type="button" onClick={() => send({ type: "guide:goback" })} data-testid="guide-goback"><Icon name="back" /> {t("Go back a page")}</button>
            <button class="pz-btn pz-btn--small" type="button" onClick={() => send({ type: "guide:retry" })}>{t("Try again")}</button>
          </>
        : null,
      state.status === "done" ? "bottom" : "center",
    );
  }
  if (!step) return null;

  // The spotlight: a dim layer with a rounded hole (clip-path's hole also lets clicks through).
  const vw = innerWidth, vh = innerHeight;
  const hole = box && box.width > 0
    ? { x: Math.max(0, box.left - PAD), y: Math.max(0, box.top - PAD), w: Math.min(vw, box.width + PAD * 2), h: Math.min(vh, box.height + PAD * 2) }
    : null;
  const r = 14;
  const path = hole
    ? `M0 0H${vw}V${vh}H0Z M${hole.x + r} ${hole.y}H${hole.x + hole.w - r}A${r} ${r} 0 0 1 ${hole.x + hole.w} ${hole.y + r}V${hole.y + hole.h - r}A${r} ${r} 0 0 1 ${hole.x + hole.w - r} ${hole.y + hole.h}H${hole.x + r}A${r} ${r} 0 0 1 ${hole.x} ${hole.y + hole.h - r}V${hole.y + r}A${r} ${r} 0 0 1 ${hole.x + r} ${hole.y}Z`
    : "";
  // Place the card where it covers the least: beside the target when there's room (always for "check before
  // you press" steps, so the person can still see what they're checking), else below or above.
  const CW = 420, CH = 230, GAP = 18;
  const clampX = (x: number) => Math.min(Math.max(12, x), vw - CW - 12);
  const clampY = (y: number) => Math.min(Math.max(12, y), vh - CH - 12);
  const spots = hole ? {
    left: hole.x - GAP - CW >= 12 ? { left: hole.x - GAP - CW, top: clampY(hole.y + hole.h / 2 - CH / 2) } : null,
    right: hole.x + hole.w + GAP + CW <= vw - 12 ? { left: hole.x + hole.w + GAP, top: clampY(hole.y + hole.h / 2 - CH / 2) } : null,
    below: hole.y + hole.h + GAP + CH <= vh ? { left: clampX(hole.x + hole.w / 2 - CW / 2), top: hole.y + hole.h + GAP } : null,
    above: hole.y - GAP - CH >= 0 ? { left: clampX(hole.x + hole.w / 2 - CW / 2), top: hole.y - GAP - CH } : null,
  } : null;
  // Dropdown lists and typing suggestions open below their box, so those steps keep the card off that side.
  const order = caution ? ["left", "right", "below", "above"]
    : step.kind === "choose" || step.kind === "type" ? ["right", "left", "above", "below"]
    : ["below", "above", "right", "left"];
  // No room beside it (a big block to read): use the screen edge farthest from it, so the card never sits on top.
  const farEdge = hole && hole.y + hole.h / 2 < vh / 2 ? vh - CH - 12 : 12;
  const spot = spots ? order.map((k) => spots[k as keyof typeof spots]).find(Boolean) ?? { left: clampX(vw / 2 - CW / 2), top: farEdge } : { left: vw / 2 - CW / 2, top: vh / 2 - CH / 2 };
  // Custom dropdowns don't always say when something was picked, so choosing has a Done button too.
  const needsDone = step.kind === "type" || step.kind === "read" || step.kind === "choose";

  return (
    <div class="guide" data-testid="guide" data-kind={step.kind}>
      <div class={`guide__dim${caution ? " guide__dim--light" : ""}${engaged ? " guide__dim--open" : ""}`} style={path ? `clip-path:path(evenodd, "${path}")` : ""} />
      {hole && <div class="guide__ring" style={`left:${hole.x - 4}px;top:${hole.y - 4}px;width:${hole.w + 8}px;height:${hole.h + 8}px`} data-testid="guide-ring" />}
      <div class={`guide-card pz-card${caution ? " guide-card--caution" : ""}`} role="dialog" aria-label={t("Guide me")} data-testid="guide-card"
        style={`left:${spot.left}px;top:${spot.top}px`} onPointerDown={keepPageFocus} onMouseDown={keepPageFocus}>
        <span class="guide-card__step">{t("Step {n}", { n: stepNo })}</span>
        <p class="guide-card__text" data-testid="guide-instruction">{step.instruction}</p>
        {step.detail && <p class="guide-card__detail">{step.detail}</p>}
        {caution && <p class="guide-card__caution"><Icon name="warning" /> {t("Check everything is right before you press it.")}</p>}
        {!hole && <p class="guide-card__detail">{t("Scroll the page until you see it.")}</p>}
        <div class="guide-card__row">
          {needsDone && (
            <button class="pz-btn pz-btn--primary pz-btn--small" type="button" data-typed={typed ? "" : undefined}
              onClick={() => send({ type: "guide:advanced", result: step.kind === "type" ? "typed it" : step.kind === "choose" ? "chose an option" : "read it" })} data-testid="guide-done">{t("Done")}</button>
          )}
          {state.shown.length > 1 && <button class="pz-btn pz-btn--small" type="button" onClick={() => send({ type: "guide:back" })} data-testid="guide-back">{t("Back")}</button>}
          <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={stop} data-testid="guide-stop"><Icon name="close" /> {t("Stop")}</button>
        </div>
      </div>
    </div>
  );
}

function GuideQuestion({ state, onStop }: { state: GuideState; onStop: () => void }) {
  useLanguage();
  const [other, setOther] = useState("");
  const answer = (a: string) => a.trim() && send({ type: "guide:answer", answer: a.trim() });
  return (
    <div class="guide-card guide-card--center pz-card" role="dialog" aria-label={t("Guide me")} data-testid="guide-card">
      <span class="guide-card__goal">{t("Guide me")}: {state.goal}</span>
      <p class="guide-card__text" data-testid="guide-question">{state.step!.instruction}</p>
      {state.step!.detail && <p class="guide-card__detail">{state.step!.detail}</p>}
      <div class="guide-card__choices">
        {state.step!.choices.map((c) => <button class="pz-btn" type="button" onClick={() => answer(c)}>{c}</button>)}
      </div>
      <form class="guide-card__row" onSubmit={(e) => { e.preventDefault(); answer(other); }}>
        <input class="pz-input" value={other} placeholder={t("Or type your answer")} onInput={(e) => setOther((e.target as HTMLInputElement).value)} />
        <MicButton small onText={(t2) => setOther(t2)} />
        <button class="pz-btn pz-btn--primary pz-btn--small" type="submit" disabled={!other.trim()}>{t("OK")}</button>
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={onStop}>{t("Stop")}</button>
      </form>
    </div>
  );
}
