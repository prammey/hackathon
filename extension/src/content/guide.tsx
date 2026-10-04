/**
 * Guide me's spotlight. Everything is dimmed except a cut-out around the one thing to use; clicks pass
 * straight through the cut-out to the real element. The person does the click or the typing; noticing it
 * moves the guide on.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { GuideState } from "../background/guide";
import { t } from "../shared/i18n";
import { Icon, MicButton, useLanguage } from "../ui/components";
import { findById } from "./region";

function send(message: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch(() => undefined);
}

const PAD = 10;

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
  const target = useRef<Element | null>(null);
  const [el, setEl] = useState<Element | null>(null);

  useEffect(() => {
    const onMsg = (msg: { type?: string; state?: GuideState }) => {
      if (msg?.type === "guide:update") setState(msg.state && msg.state.status !== "stopped" ? msg.state : null);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    send({ type: "guide:state" }).then((s) => setState((s as GuideState | null) ?? null));
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  // Find the element for the current step, bring it into view, enlarge it gently.
  const step = state?.status === "showing" ? state.step : undefined;
  useEffect(() => {
    setTyped(false);
    const found = step?.id ? findById(step.id) : null;
    target.current = found;
    setEl(found);
    if (!found) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    found.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    const html = found as HTMLElement;
    const before = html.getAttribute("style");
    if (canEnlarge(found)) {
      html.style.setProperty("transition", reduce ? "none" : "transform .25s ease", "important");
      html.style.setProperty("transform", "scale(1.12)", "important");
      html.style.setProperty("transform-origin", "center", "important");
    }
    if (step?.kind === "type") (found as HTMLElement).focus({ preventScroll: true });
    return () => {
      if (before === null) html.removeAttribute("style");
      else html.setAttribute("style", before);
    };
  }, [step?.id, step?.instruction]);

  // Notice the person doing the step.
  useEffect(() => {
    if (!step || !el) return;
    let leaving = false;
    const onLeave = () => { leaving = true; };
    addEventListener("pagehide", onLeave);
    const inside = (e: Event) => e.composedPath().includes(el);
    const onClick = (e: Event) => {
      if (step.kind !== "click" || !inside(e)) return;
      // If the click opens a new page, that page carries the guide on; otherwise report it here.
      setTimeout(() => { if (!leaving) send({ type: "guide:advanced", result: "clicked it" }); }, 700);
    };
    const onInput = () => setTyped(!!(el as HTMLInputElement).value);
    const onChange = () => { if (step.kind === "choose") send({ type: "guide:advanced", result: "chose an option" }); };
    const onKey = (e: KeyboardEvent) => {
      if (step.kind === "type" && e.key === "Enter" && inside(e) && (el as HTMLInputElement).value) {
        setTimeout(() => { if (!leaving) send({ type: "guide:advanced", result: "typed it and pressed Enter" }); }, 700);
      }
    };
    document.addEventListener("click", onClick, true);
    el.addEventListener("input", onInput);
    el.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey, true);
    return () => {
      removeEventListener("pagehide", onLeave);
      document.removeEventListener("click", onClick, true);
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [step?.id, step?.instruction, el]);

  const box = useTargetBox(step ? el : null);
  if (!state) return null;

  const stop = () => send({ type: "guide:stop" });
  const stepNo = state.shown.length || 1;
  const panel = (body: preact.ComponentChildren, extra?: preact.ComponentChildren) => (
    <div class="guide-card guide-card--center pz-card" role="dialog" aria-label={t("Guide me")} data-testid="guide-card">
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
    return panel(
      <p class="guide-card__text" data-testid="guide-final">{state.status === "done" ? <Icon name="check" /> : null} {text}</p>,
      state.status === "stuck" ? <button class="pz-btn pz-btn--small" type="button" onClick={() => send({ type: "guide:retry" })}>{t("Try again")}</button> : null,
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
  const order = step.caution ? ["left", "right", "below", "above"] : ["below", "above", "right", "left"];
  const spot = spots ? order.map((k) => spots[k as keyof typeof spots]).find(Boolean) ?? { left: clampX(vw / 2 - CW / 2), top: 12 } : { left: vw / 2 - CW / 2, top: vh / 2 - CH / 2 };
  const needsDone = step.kind === "type" || step.kind === "read";

  return (
    <div class="guide" data-testid="guide" data-kind={step.kind}>
      <div class={`guide__dim${step.caution ? " guide__dim--light" : ""}`} style={path ? `clip-path:path(evenodd, "${path}")` : ""} />
      {hole && <div class="guide__ring" style={`left:${hole.x - 4}px;top:${hole.y - 4}px;width:${hole.w + 8}px;height:${hole.h + 8}px`} data-testid="guide-ring" />}
      <div class={`guide-card pz-card${step.caution ? " guide-card--caution" : ""}`} role="dialog" aria-label={t("Guide me")} data-testid="guide-card"
        style={`left:${spot.left}px;top:${spot.top}px`}>
        <span class="guide-card__step">{t("Step {n}", { n: stepNo })}</span>
        <p class="guide-card__text" data-testid="guide-instruction">{step.instruction}</p>
        {step.detail && <p class="guide-card__detail">{step.detail}</p>}
        {step.caution && <p class="guide-card__caution"><Icon name="warning" /> {t("Check everything is right before you press it.")}</p>}
        {!hole && <p class="guide-card__detail">{t("Scroll the page until you see it.")}</p>}
        <div class="guide-card__row">
          {needsDone && (
            <button class="pz-btn pz-btn--primary pz-btn--small" type="button" disabled={step.kind === "type" && !typed}
              onClick={() => send({ type: "guide:advanced", result: step.kind === "type" ? "typed it" : "read it" })} data-testid="guide-done">{t("Done")}</button>
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
