/** The in-page Prism UI: page tab + panel, selection layer, action menu, answer cards, chat. */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ChatState } from "../shared/chat";
import { getProfile, getSettings, profileText, saveProfile, saveSitePrefs } from "../shared/storage";
import type {
  AssistAction, DefineAnswer, FieldSuggestion, FillAnswer, Rect, Result, Settings, StyleId, TranslateAnswer,
} from "../shared/types";
import { Brand, Icon, isMac, Logo, StylePicker, Switch } from "../ui/components";
import { applyFill, fieldLabel, type FillResult, undoFill } from "./actions";
import { controlsIn, regionContext } from "./region";
import { placeNear, type SelState, SelectionController, shortcutLabel } from "./selection";
import type { TidyEngine, TidyState } from "./tidy";

export type PublicChat = Omit<ChatState, "turns">;

export interface Bus {
  on(type: string, fn: (payload: any) => void): () => void;
}

interface Props {
  engine: TidyEngine;
  selection: SelectionController;
  bus: Bus;
  setHidden: (hidden: boolean) => Promise<void>;
}

type CardState =
  | { kind: AssistAction; rect: Rect; status: "loading"; note?: string }
  | { kind: AssistAction; rect: Rect; status: "error"; message: string }
  | { kind: "define"; rect: Rect; status: "ready"; data: DefineAnswer; usedPicture: boolean }
  | { kind: "translate"; rect: Rect; status: "ready"; data: TranslateAnswer; usedPicture: boolean }
  | { kind: "fill"; rect: Rect; status: "ready"; data: FillAnswer; elements: Map<string, Element[]>; result?: FillResult };

const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Chinese (Simplified)", "Hindi", "Arabic", "Bengali", "Urdu", "Polish", "Vietnamese", "Korean", "Japanese", "Tagalog", "Russian", "Ukrainian", "Turkish"];

function send<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export function App({ engine, selection, bus, setHidden }: Props) {
  const [tidy, setTidy] = useState<TidyState>(engine.state);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sel, setSel] = useState<SelState>(selection.state);
  const [menuRect, setMenuRect] = useState<Rect | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [chat, setChat] = useState<PublicChat | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone?: "error" | "info" } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => engine.onChange(setTidy), [engine]);
  useEffect(() => selection.onChange(setSel), [selection]);
  useEffect(() => { getSettings().then(setSettings); }, []);
  useEffect(() => selection.onComplete((rect) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setCard(null);
    setMenuRect(rect);
  }), [selection]);
  useEffect(() => {
    const offs = [
      bus.on("chat:update", (state: PublicChat) => { setChat(state); }),
      bus.on("open-chat", () => openChat(null)),
      bus.on("toast", (t) => setToast(t)),
      bus.on("settings", (s: Settings) => setSettings(s)),
      bus.on("context-ask", (rect: Rect) => { setCard(null); setMenuRect(rect); }),
      bus.on("panel", (open: boolean) => setPanelOpen(open)),
    ];
    send<PublicChat | null>({ type: "chat:state" }).then((s) => {
      if (s && s.messages.length && !["done", "stopped", "idle", "error"].includes(s.status)) { setChat(s); setChatOpen(true); }
    }).catch(() => {});
    return () => offs.forEach((off) => off());
  }, []);

  // Registered once and reading a ref, so Esc works even in the instant after the menu appears.
  const live = useRef({ menuRect, card, panelOpen });
  live.current = { menuRect, card, panelOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = live.current;
      if (now.menuRect) { e.stopPropagation(); closeMenu(); }
      else if (now.card) { e.stopPropagation(); setCard(null); restoreFocus(); }
      else if (now.panelOpen) { e.stopPropagation(); setPanelOpen(false); }
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  function restoreFocus() {
    returnFocus.current?.focus?.({ preventScroll: true });
    returnFocus.current = null;
  }

  function closeMenu() {
    setMenuRect(null);
    selection.cancel();
    restoreFocus();
  }

  async function capture(rect: Rect | null): Promise<string | undefined> {
    await setHidden(true);
    try {
      const shot = await send<Result<{ image: string }>>({ type: "capture", rect, viewportWidth: innerWidth });
      return shot?.ok ? shot.value.image : undefined;
    } finally {
      await setHidden(false);
    }
  }

  async function runAssist(kind: AssistAction, rect: Rect, extra: { targetLanguage?: string; question?: string; justForNow?: string } = {}) {
    setMenuRect(null);
    selection.cancel();
    setCard({ kind, rect, status: "loading" });
    const s = (await getSettings());
    const { context, elements, needsPicture } = regionContext(rect, tidy.pagePurpose);
    if (kind === "fill" && !context.controls.length) {
      setCard({ kind, rect, status: "error", message: "There are no form fields in the area you selected. Try drawing the box around the questions you need help with." });
      return;
    }
    const wantPicture = needsPicture || (kind === "translate" && context.imageCount > 0);
    const image = wantPicture ? await capture(rect) : undefined;
    if (!context.text && !context.controls.length && !image) {
      setCard({ kind, rect, status: "error", message: "Prism couldn't read anything in that area, and the browser didn't allow a picture of it. Try a different area, or copy the text into Chat." });
      return;
    }
    const profile = await getProfile();
    const chatState = await send<PublicChat | null>({ type: "chat:state" }).catch(() => null);
    let profileFacts = profileText(profile, kind);
    if (chatState?.sessionContext) {
      // Helping someone else: their details replace the saved person's for form answers; the saved
      // person's reading preferences still apply to explanations.
      profileFacts = kind === "fill"
        ? `The user is filling this in for someone else. Use ONLY these details for answers, never the user's own:\n${chatState.sessionContext}`
        : `${profileText(profile, "translate")}\nJust for now: ${chatState.sessionContext}`;
    }
    if (extra.justForNow) profileFacts += `\nJust for now, the person told Prism: ${extra.justForNow}`;
    const target = extra.targetLanguage ?? (await siteLanguage()) ?? (s.translateTo || profile.language || "English");
    const result = await send<Result<{ answer: unknown }>>({
      type: "api", path: "/v1/assist",
      body: {
        action: kind, region: context, image, imageMime: "image/jpeg", profile: profileFacts,
        targetLanguage: target, explainLevel: s.explainLevel, question: extra.question ?? "",
      },
    });
    if (!result?.ok) {
      setCard({ kind, rect, status: "error", message: result?.error?.message ?? "Prism couldn't get an answer." });
      return;
    }
    const answer = result.value.answer;
    if (kind === "define") setCard({ kind, rect, status: "ready", data: answer as DefineAnswer, usedPicture: !!image });
    else if (kind === "translate") setCard({ kind, rect, status: "ready", data: answer as TranslateAnswer, usedPicture: !!image });
    else setCard({ kind, rect, status: "ready", data: answer as FillAnswer, elements });
  }

  async function siteLanguage(): Promise<string | undefined> {
    const key = `site:${location.origin}`;
    const stored = await chrome.storage.local.get(key);
    return (stored[key] as { translateTo?: string } | undefined)?.translateTo;
  }

  async function openChat(rect: Rect | null) {
    setMenuRect(null);
    selection.cancel();
    setCard(null);
    setPanelOpen(false);
    setChatOpen(true);
    if (rect) {
      const { context, needsPicture } = regionContext(rect, tidy.pagePurpose);
      const image = needsPicture ? await capture(rect) : undefined;
      const regionText = [
        context.text && `Selected text: “${context.text}”`,
        context.surrounding && `Surrounding context (not selected): ${context.surrounding}`,
        ...context.controls.map((c) => `[${c.id}] ${c.type} “${c.label}”${c.options.length ? ` options: ${c.options.slice(0, 12).join(" / ")}` : ""}`),
      ].filter(Boolean).join("\n");
      await send({ type: "chat:start", opts: { regionLabel: "Selected area", regionText: regionText.slice(0, 7000), image } });
    } else {
      await send({ type: "chat:start", opts: { regionLabel: "This page", regionText: "" } });
    }
    setChat(await send<PublicChat | null>({ type: "chat:state" }));
  }

  const shape = tidy.styleId === "bold" ? "square" : tidy.styleId === "soft" ? "soft" : "";
  useEffect(() => {
    const host = document.querySelector("prism-root") as HTMLElement | null;
    if (host) { if (shape) host.setAttribute("data-shape", shape); else host.removeAttribute("data-shape"); }
  }, [shape]);

  const busy = tidy.status === "planning";
  const tidyOn = tidy.status !== "off";
  // Once the page has been tidied, the widget stays so tidying can be switched back on from the page.
  const [widget, setWidget] = useState(false);
  useEffect(() => { if (tidyOn) setWidget(true); }, [tidyOn]);
  const showTab = widget && !chatOpen;

  return (
    <div class="layer">
      {showTab && !panelOpen && (
        <button class="tab" type="button" aria-label={`Prism: ${tidy.message || "page tidied"}. Open Prism panel`} onClick={() => setPanelOpen(true)}
          data-testid="prism-tab">
          <Logo size={30} />
          <span class={`tab__dot${busy ? " tab__dot--busy" : ""}${tidyOn ? "" : " tab__dot--off"}`} aria-hidden="true" />
          <span class="tab__status">{!tidyOn ? "Original" : busy ? "Tidying…" : "Tidied"}</span>
        </button>
      )}
      {showTab && tidyOn && !panelOpen && tidy.nextStep && !menuRect && !card && sel.phase === "idle" && (
        <div class="nextstep pz-card" role="region" aria-label="Next step" data-testid="prism-next">
          <span class="nextstep__label">Next step</span>
          <span class="nextstep__text">{tidy.nextStep}</span>
          <button class="pz-btn pz-btn--primary pz-btn--small" type="button" onClick={() => engine.showNextStep()}>Show me</button>
        </div>
      )}
      {panelOpen && (
        <PagePanel tidy={tidy} engine={engine} settings={settings}
          onClose={() => setPanelOpen(false)}
          onPoint={() => { setPanelOpen(false); selection.startExplicit(); }}
          onChat={() => openChat(null)} />
      )}
      <SelectionLayer sel={sel} selection={selection} settings={settings} menuRect={menuRect} />
      {menuRect && (
        <ActionMenu rect={menuRect} onAction={(a) => (a === "chat" ? openChat(menuRect) : runAssist(a, menuRect))}
          onAdjust={() => { setMenuRect(null); selection.adjust(); }} onClose={closeMenu} />
      )}
      {card && <AnswerCard card={card} onClose={() => { setCard(null); restoreFocus(); }}
        onRetry={(extra) => runAssist(card.kind, card.rect, extra)}
        onChat={() => openChat(card.rect)}
        onUpdate={setCard} />}
      {chatOpen && (
        <ChatPanel chat={chat} onClose={() => setChatOpen(false)} />
      )}
      {toast && (
        <div class="toast pz-card" role={toast.tone === "error" ? "alert" : "status"}>
          <span>{toast.text}</span>
          <button class="pz-btn pz-btn--small" type="button" onClick={() => setToast(null)}>OK</button>
        </div>
      )}
    </div>
  );
}

// ---------- Page panel ----------

function PagePanel(props: { tidy: TidyState; engine: TidyEngine; settings: Settings | null; onClose: () => void; onPoint: () => void; onChat: () => void }) {
  const { tidy, engine } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const mac = isMac();
  return (
    <section class="panel pz-card" role="dialog" aria-label="Prism" data-testid="prism-panel">
      <div class="panel__head">
        <Brand size={26} />
        <button ref={closeRef} class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={props.onClose} aria-label="Close Prism panel">
          <Icon name="close" /> Close
        </button>
      </div>
      <div class="panel__body">
        <div class="panel__section" aria-live="polite">
          {tidy.status === "planning" && <div class="pz-progress" aria-hidden="true" />}
          <Switch checked={tidy.status !== "off"} label="Tidy this page" id="panel-tidy-switch"
            onChange={(on) => (on ? engine.enable() : engine.disable("Showing the original page."))} />
          {tidy.status !== "off" && <p style="margin:0;font-weight:600">{tidy.message}</p>}
          {tidy.status !== "off" && tidy.pagePurpose && <p class="pz-muted" style="margin:0">This page: {tidy.pagePurpose}</p>}
        </div>
        <div class="panel__section">
          <button class="pz-btn pz-btn--block" type="button" onClick={props.onPoint}>
            <Icon name="select" /> Point at something
          </button>
          <p class="pz-hint" style="margin:0">Or hold <strong>{shortcutLabel(props.settings?.shortcut ?? "alt", mac)}</strong> and drag over anything on the page.</p>
          <button class="pz-btn pz-btn--block" type="button" onClick={props.onChat}><Icon name="chat" /> Chat about this page</button>
        </div>
        {tidy.status !== "off" && <div class="panel__section">
          <span class="pz-label">Style for this website</span>
          <StylePicker value={tidy.styleId} onChange={(id: StyleId) => engine.setStyle(id)} />
        </div>}
        {tidy.steps.length > 0 && (
          <div class="panel__section">
            <span class="pz-label">Next steps on this page</span>
            <ol class="steps">
              {tidy.steps.map((s) => <li><button type="button" onClick={() => engine.focusStep(s.id)}>{s.label}</button></li>)}
            </ol>
          </div>
        )}
        {tidy.hiddenClutter > 0 && (
          <div class="panel__section">
            <span class="pz-label">Hidden to reduce clutter</span>
            <button class="pz-btn pz-btn--small" type="button" aria-pressed={tidy.clutterShown} onClick={() => engine.toggleClutter()} data-testid="toggle-clutter">
              {tidy.clutterShown ? "Hide" : "Show"} adverts and promotions ({tidy.hiddenClutter})
            </button>
          </div>
        )}
        {tidy.folds.length > 0 && (
          <div class="panel__section">
            <span class="pz-label">Tucked away to reduce clutter</span>
            {tidy.folds.map((f) => (
              <button class="pz-btn pz-btn--small" type="button" aria-pressed={f.open} onClick={() => engine.toggleFold(f.gid)}>
                {f.open ? "Hide" : "Show"} {f.label.toLowerCase()} ({f.count})
              </button>
            ))}
          </div>
        )}
        <div class="panel__section">
          <button class="pz-btn pz-btn--quiet" type="button" onClick={() => engine.regenerate()}><Icon name="restore" /> Tidy again from scratch</button>
          <button class="pz-btn pz-btn--quiet" type="button" onClick={() => saveSitePrefs(location.origin, { tidy: "never" }).then(() => engine.disable("Prism won't tidy this website automatically."))}>
            Don't tidy this website
          </button>
          <button class="pz-btn pz-btn--quiet" type="button" onClick={() => send({ type: "open-options" })}><Icon name="settings" /> Settings</button>
        </div>
      </div>
    </section>
  );
}

// ---------- Selection ----------

function SelectionLayer(props: { sel: SelState; selection: SelectionController; settings: Settings | null; menuRect: Rect | null }) {
  const { sel, selection } = props;
  const catcherRef = useRef<HTMLDivElement>(null);
  const active = sel.phase === "armed" || sel.phase === "dragging";
  useEffect(() => {
    if (sel.mode === "keyboard" && sel.phase === "dragging") catcherRef.current?.focus();
  }, [sel.mode, sel.phase]);
  if (!active && !props.menuRect) return null;
  // While the menu is open, highlight the area it's about (from a drag or a right-click).
  const r = active ? sel.rect : props.menuRect;
  const block = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <>
      {active && (
        <div ref={catcherRef} class={`catcher${sel.mode === "hotkey" ? " catcher--hotkey" : ""}`} tabIndex={-1} data-testid="prism-catcher"
          aria-label="Prism selection area"
          onPointerDown={(e) => { block(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); selection.pointerDown(e.clientX, e.clientY); }}
          onPointerMove={(e) => { block(e); selection.pointerMove(e.clientX, e.clientY); }}
          onPointerUp={(e) => { block(e); selection.pointerUp(e.clientX, e.clientY); }}
          onClick={block} onContextMenu={block} onMouseDown={block} onMouseUp={block} onDblClick={block} />
      )}
      {r && r.width > 0 && (
        <div class="sel-rect" style={`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`} data-testid="prism-sel-rect">
          {sel.phase === "dragging" && r.y > 36 && <span class="sel-label">Selected area</span>}
        </div>
      )}
      {active && sel.mode !== "hotkey" && (
        <div class="sel-hint pz-card" role="status">
          <Icon name="select" />
          <span>{sel.mode === "keyboard"
            ? "Use the arrow keys to move the box, Shift + arrows to resize it, then press Enter."
            : "Drag a box around what you want help with."}</span>
          <button class="pz-btn pz-btn--small" type="button" onClick={() => selection.cancel()}>Cancel (Esc)</button>
        </div>
      )}
    </>
  );
}

function ActionMenu(props: { rect: Rect; onAction: (a: AssistAction | "chat") => void; onAdjust: () => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const hasFields = useMemo(() => controlsIn(props.rect).controls.length > 0, [props.rect]);
  useEffect(() => { first.current?.focus(); }, []);
  const pos = placeNear(props.rect, 316, 240); // matches .menu width in overlay.css
  const items: { id: AssistAction | "chat"; label: string; hint: string; icon: string; disabled?: boolean }[] = [
    { id: "define", label: "Define", hint: "What does this mean?", icon: "define" },
    { id: "translate", label: "Translate", hint: "Put it in my language", icon: "translate" },
    { id: "fill", label: "Fill out", hint: hasFields ? "Help with these questions" : "No form fields here", icon: "fill", disabled: !hasFields },
    { id: "chat", label: "Chat", hint: "Ask anything or get help doing it", icon: "chat" },
  ];
  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(".menu__action")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement) === -1
      ? buttons.findIndex((b) => b === (e.target as HTMLElement)) : buttons.indexOf(e.target as HTMLButtonElement);
    const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 };
    if (move[e.key] !== undefined && i >= 0) {
      e.preventDefault();
      buttons[(i + move[e.key] + buttons.length) % buttons.length].focus();
    }
  };
  return (
    <div class="menu pz-card" role="menu" aria-label="What would you like Prism to do?" style={`left:${pos.x}px;top:${pos.y}px`}
      onKeyDown={onKeyDown} data-testid="prism-menu">
      <div class="menu__grid">
        {items.map((it, idx) => (
          <button ref={idx === 0 ? first : undefined} type="button" role="menuitem" class="menu__action"
            aria-disabled={it.disabled ? "true" : undefined} data-action={it.id}
            onClick={() => !it.disabled && props.onAction(it.id)}>
            <Icon name={it.icon} />
            {it.label}
            <small>{it.hint}</small>
          </button>
        ))}
      </div>
      <div class="menu__foot">
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={props.onAdjust}>Adjust area</button>
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={props.onClose}>Close (Esc)</button>
      </div>
    </div>
  );
}

// ---------- Answer cards ----------

const TITLES: Record<AssistAction, string> = { define: "What this means", translate: "Translation", fill: "Help filling this out" };

function AnswerCard(props: {
  card: CardState; onClose: () => void; onRetry: (extra?: { targetLanguage?: string; question?: string; justForNow?: string }) => void;
  onChat: () => void; onUpdate: (c: CardState) => void;
}) {
  const { card } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const [lang, setLang] = useState<string>("");
  // Once the person drags the window, it stays where they put it (until a new selection).
  const [moved, setMoved] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h?: number } | null>(null);
  useEffect(() => { closeRef.current?.focus(); }, [card.status]);
  useEffect(() => { setMoved(null); setSize(null); }, [card.rect]);
  // Short answers sit next to the selection; long ones (forms, many lines) dock to the side, full height.
  const tall = card.status === "ready" && (card.kind === "fill" || (card.kind === "translate" && card.data.lines.length > 3));
  const pos = placeNear(card.rect, Math.min(450, innerWidth - 28), 360); // matches .answer width
  const docked = !moved && (tall || innerHeight - pos.y < 300);
  // A moved window is at most 70% of the screen tall (scrolls inside) unless the person resized it.
  const sizeCss = `${size ? `width:${size.w}px;` : ""}${size?.h ? `height:${size.h}px;` : "max-height:70vh;"}`;
  const style = moved
    ? `left:${moved.x}px;top:${moved.y}px;${sizeCss}`
    : docked ? "" : `left:${pos.x}px;top:${pos.y}px;max-height:${Math.max(240, innerHeight - pos.y - 12)}px`;

  const clampTo = (x: number, y: number) => {
    const r = boxRef.current!.getBoundingClientRect();
    // Keep the whole window (including its resize corner) on screen.
    return { x: Math.min(Math.max(8, x), innerWidth - Math.min(r.width, innerWidth) - 8), y: Math.min(Math.max(8, y), Math.max(8, innerHeight - r.height - 8)) };
  };
  const startDrag = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,select,input,a")) return;
    const box = boxRef.current!;
    const r = box.getBoundingClientRect();
    // Leaving the docked layout: fix the current size so the window doesn't jump.
    if (!size) setSize({ w: r.width, h: docked ? Math.min(r.height, Math.round(innerHeight * 0.7)) : undefined });
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setMoved(clampTo(ev.clientX - dx, ev.clientY - dy));
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    setMoved({ x: r.left, y: r.top });
    e.preventDefault();
  };
  const startResize = (e: PointerEvent) => {
    const box = boxRef.current!;
    const r = box.getBoundingClientRect();
    if (!moved) setMoved({ x: r.left, y: r.top });
    const sx = e.clientX, sy = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setSize({
      w: Math.min(innerWidth - r.left - 8, Math.max(300, r.width + ev.clientX - sx)),
      h: Math.min(innerHeight - r.top - 8, Math.max(180, r.height + ev.clientY - sy)),
    });
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    e.preventDefault();
    e.stopPropagation();
  };
  const nudge = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 24;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!d[e.key]) return;
    e.preventDefault();
    const r = boxRef.current!.getBoundingClientRect();
    if (!size) setSize({ w: r.width });
    setMoved(clampTo(r.left + d[e.key][0], r.top + d[e.key][1]));
  };
  return (
    <section ref={boxRef} class={`answer pz-card${docked ? " answer--docked" : ""}${moved ? " answer--moved" : ""}`} role="dialog" aria-label={TITLES[card.kind]} style={style} data-testid="prism-card" data-kind={card.kind} data-status={card.status}>
      <div class="answer__head answer__grip" onPointerDown={startDrag} title="Drag to move">
        <button class="answer__move" type="button" aria-label="Move window (use arrow keys)" onKeyDown={nudge} data-testid="card-move">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="4" r="1.3" /><circle cx="11" cy="4" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="11" cy="12" r="1.3" /></g></svg>
        </button>
        <Logo size={24} />
        <h2 class="answer__title">{TITLES[card.kind]}</h2>
        <span class="answer__resize" onPointerDown={startResize} title="Drag to resize" aria-hidden="true" data-testid="card-resize" />
        <button ref={closeRef} class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={props.onClose} aria-label="Close">
          <Icon name="close" /> Close
        </button>
      </div>
      <div class="answer__body" aria-live="polite" key={card.status === "ready" && card.kind === "fill" && card.result ? "result" : "main"}>
        {card.status === "loading" && (
          <>
            <div class="pz-progress" aria-hidden="true" />
            <p>{card.kind === "translate" ? "Translating…" : card.kind === "fill" ? "Reading the form…" : "Working out what this means…"}</p>
          </>
        )}
        {card.status === "error" && <div class="pz-notice pz-notice--error" role="alert"><div>{card.message}</div></div>}
        {card.status === "ready" && card.kind === "define" && <DefineView data={card.data} />}
        {card.status === "ready" && card.kind === "translate" && <TranslateView data={card.data} />}
        {card.status === "ready" && card.kind === "fill" && (
          <FillView card={card} onRetry={props.onRetry} onUpdate={props.onUpdate} />
        )}
      </div>
      <div class="answer__foot">
        {card.status === "error" && <button class="pz-btn pz-btn--small" type="button" onClick={() => props.onRetry()}>Try again</button>}
        {card.status === "ready" && card.kind === "define" && (
          <button class="pz-btn pz-btn--small" type="button" onClick={() => props.onRetry({ question: "Explain this even more simply, in very short sentences." })}>Explain more simply</button>
        )}
        {card.status === "ready" && card.kind === "translate" && (
          <span class="lang-row">
            <label for="pz-lang">Into</label>
            <select id="pz-lang" value={lang || card.data.targetLanguage} onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setLang(v);
              saveSitePrefs(location.origin, { translateTo: v });
              props.onRetry({ targetLanguage: v });
            }}>
              {[...new Set([card.data.targetLanguage, ...LANGUAGES])].map((l) => <option value={l}>{l}</option>)}
            </select>
            <SpeakButton text={card.data.lines.map((l) => l.translation).join(". ")} />
          </span>
        )}
        {card.status === "ready" && <button class="pz-btn pz-btn--small" type="button" onClick={props.onChat}><Icon name="chat" /> Ask a follow-up</button>}
      </div>
    </section>
  );
}

/** Shows AI text safely: **bold** becomes bold, stray markdown symbols are removed. No HTML is injected. */
export function Rich({ text }: { text: string }) {
  const cleaned = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1$2");
  const parts = cleaned.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((part, i) => (i % 2 ? <strong>{part}</strong> : part.replace(/\*\*/g, "")))}</>;
}

function SpeakButton({ text }: { text: string }) {
  if (!("speechSynthesis" in window)) return null;
  return (
    <button class="pz-btn pz-btn--small" type="button" onClick={() => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }}>
      <Icon name="speak" /> Read aloud
    </button>
  );
}

function DefineView({ data }: { data: DefineAnswer }) {
  return (
    <>
      <p class="lead"><Rich text={data.summary} /></p>
      {data.explanation && <p><Rich text={data.explanation} /></p>}
      {data.terms.length > 0 && (
        <dl class="terms">
          {data.terms.map((t) => <div><dt>{t.term}</dt><dd>{t.meaning}</dd></div>)}
        </dl>
      )}
      {data.whatToDoHere && <div class="todo"><strong>What you can do here: </strong><Rich text={data.whatToDoHere} /></div>}
      {data.uncertain.length > 0 && <p class="pz-muted">Unclear: {data.uncertain.join("; ")}</p>}
    </>
  );
}

function TranslateView({ data }: { data: TranslateAnswer }) {
  return (
    <>
      <p class="pz-muted" style="margin:0">{data.sourceLanguage} → {data.targetLanguage}</p>
      <ol class="lines">
        {data.lines.map((l) => (
          <li class="line">
            <span class="line__dst">{l.unclear ? <span class="unclear">[unclear] </span> : null}{l.translation}</span>
            <span class="line__src" lang="">Original: {l.source}</span>
            {l.note && <span class="line__note">{l.note}</span>}
          </li>
        ))}
      </ol>
    </>
  );
}

function sourceLabel(s: FieldSuggestion): string {
  if (s.source === "profile") return "From About you";
  if (s.source === "session") return "From what you told Prism just now";
  if (s.source === "page") return "Shown on the page";
  if (s.source === "inference") return "Prism's guess — please check";
  return "";
}

function FillView(props: { card: Extract<CardState, { kind: "fill"; status: "ready" }>; onRetry: (extra?: { justForNow?: string }) => void; onUpdate: (c: CardState) => void }) {
  const { card } = props;
  const [chosen, setChosen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(card.data.fields.map((f) => [f.id, f.hasSuggestion && ["profile", "session", "page"].includes(f.source)])));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(card.data.fields.map((f) => [f.id, f.optionValues.join(", ") || f.value])));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const suggestions = card.data.fields.filter((f) => f.hasSuggestion);
  const explainOnly = card.data.fields.filter((f) => !f.hasSuggestion);
  const count = Object.values(chosen).filter(Boolean).length;

  function apply() {
    const picked = suggestions.filter((f) => chosen[f.id]).map((f) => {
      const v = values[f.id] ?? "";
      return f.optionValues.length ? { ...f, optionValues: v.split(",").map((x) => x.trim()).filter(Boolean) } : { ...f, value: v };
    });
    const result = applyFill(picked, card.elements);
    props.onUpdate({ ...card, result });
  }

  async function saveAnswers() {
    const profile = await getProfile();
    const facts = Object.entries(answers).filter(([, v]) => v.trim()).map(([fid, v]) => {
      const q = card.data.questions.find((x) => x.fieldId === fid)?.question ?? "";
      return { id: Math.random().toString(36).slice(2), text: `${q.replace(/\?$/, "")}: ${v.trim()}`, source: "typed" as const, addedAt: Date.now() };
    });
    await saveProfile({ ...profile, extraFacts: [...profile.extraFacts, ...facts] });
    setSaved(true);
  }

  if (card.result) {
    const r = card.result;
    return (
      <>
        <div class="pz-notice pz-notice--ok" role="status" data-testid="fill-result">
          <div><strong>{r.changed.length} {r.changed.length === 1 ? "answer" : "answers"} filled in.</strong> Not submitted.</div>
        </div>
        <ul class="fields">
          {r.changed.map((c) => <li class="field"><span class="field__name">{c.label}</span><span>{c.value}</span></li>)}
          {r.failed.map((f) => <li class="field"><span class="field__name">{f.label}</span><span class="pz-muted">{f.reason}</span></li>)}
        </ul>
        <div>
          <button class="pz-btn" type="button" data-testid="fill-undo" onClick={() => { undoFill(r.undo); props.onUpdate({ ...card, result: undefined }); }}>
            <Icon name="undo" /> Undo — put the old answers back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {card.data.overview && <p class="lead">{card.data.overview}</p>}
      {suggestions.length > 0 && (
        <ul class="fields">
          {suggestions.map((f) => (
            <li class="field" data-field={f.id}>
              <span class="field__name">{labelOf(card, f.id)}</span>
              <span>{f.explanation}</span>
              <label class="field__value">
                <input type="checkbox" checked={chosen[f.id]} onChange={(e) => setChosen({ ...chosen, [f.id]: (e.target as HTMLInputElement).checked })}
                  aria-label={`Use this answer for ${labelOf(card, f.id)}`} />
                {isCheckbox(card, f.id)
                  ? <span><strong>{f.checked ? "Tick this box" : "Leave unticked"}</strong></span>
                  : <input class="pz-input" value={values[f.id]} onInput={(e) => setValues({ ...values, [f.id]: (e.target as HTMLInputElement).value })}
                      aria-label={`Answer for ${labelOf(card, f.id)}`} />}
              </label>
              {sourceLabel(f) && <span><span class={`source source--${f.source}`}>{sourceLabel(f)}</span>{f.evidence && <span class="pz-hint"> · “{f.evidence}”</span>}</span>}
            </li>
          ))}
        </ul>
      )}
      {explainOnly.length > 0 && (
        <ul class="fields">
          {explainOnly.map((f) => <li class="field"><span class="field__name">{labelOf(card, f.id)}</span><span>{f.explanation}</span></li>)}
        </ul>
      )}
      {card.data.questions.length > 0 && (
        <div class="question">
          <strong>Prism needs a little more information</strong>
          {card.data.questions.map((q) => (
            <label class="pz-field">
              <span>{q.question}</span>
              <input class="pz-input" value={answers[q.fieldId] ?? ""} onInput={(e) => setAnswers({ ...answers, [q.fieldId]: (e.target as HTMLInputElement).value })} />
            </label>
          ))}
          <div class="lang-row">
            <button class="pz-btn pz-btn--small" type="button" onClick={() => props.onRetry({ justForNow: Object.entries(answers).map(([k, v]) => `${card.data.questions.find((q) => q.fieldId === k)?.question} ${v}`).join("; ") })}>
              Use these answers just for now
            </button>
            <button class="pz-btn pz-btn--small pz-btn--quiet" type="button" onClick={saveAnswers} disabled={saved}>{saved ? "Saved to About you" : "Save to About you"}</button>
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <button class="pz-btn pz-btn--primary" type="button" onClick={apply} disabled={!count} data-testid="fill-apply">
            Fill in {count} {count === 1 ? "answer" : "answers"}
          </button>
        </div>
      )}
    </>
  );
}

function labelOf(card: Extract<CardState, { kind: "fill" }>, id: string): string {
  const el = card.status === "ready" ? card.elements.get(id)?.[0] : undefined;
  return (el && fieldLabel(el)) || "This field";
}

function isCheckbox(card: Extract<CardState, { kind: "fill"; status: "ready" }>, id: string): boolean {
  return (card.elements.get(id)?.[0] as HTMLInputElement | undefined)?.type === "checkbox";
}

// ---------- Chat ----------

function ChatPanel(props: { chat: PublicChat | null; onClose: () => void }) {
  const { chat } = props;
  const [text, setText] = useState("");
  const [includeScreen, setIncludeScreen] = useState(false);
  const [helping, setHelping] = useState(false);
  const [helpingText, setHelpingText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [chat?.messages.length, chat?.status]);
  const busy = chat && ["thinking", "acting"].includes(chat.status);
  const waitingConfirm = chat?.status === "waiting-confirm" && chat.pending;

  function submit(e?: Event) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    send({ type: "chat:send", text: t, includeScreen });
  }

  return (
    <section class="chat pz-card" role="dialog" aria-label="Chat with Prism" data-testid="prism-chat" data-status={chat?.status ?? "idle"}>
      <div class="chat__head">
        <span style="flex:1"><Brand size={26} label="Chat" /></span>
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => send({ type: "chat:clear" }).then(props.onClose)}>New chat</button>
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={props.onClose} aria-label="Close chat"><Icon name="close" /> Close</button>
      </div>
      <div class="chat__context">
        <span class="chip"><Icon name="select" /> Talking about: {chat?.regionLabel ?? "This page"}</span>
        {chat?.sessionContext
          ? <span class="chip"><Icon name="person" /> Helping someone else <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => send({ type: "chat:session", text: "" })}>Stop</button></span>
          : <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => setHelping(!helping)} aria-expanded={helping}>I'm helping someone else</button>}
      </div>
      {helping && !chat?.sessionContext && (
        <div class="chat__compose">
          <label class="pz-field"><span>Who are you helping? Add anything useful.</span>
            <input class="pz-input" value={helpingText} placeholder="My mum, Joan Ellis, 81, lives in Leeds" onInput={(e) => setHelpingText((e.target as HTMLInputElement).value)} />
          </label>
          <button class="pz-btn pz-btn--small" type="button" onClick={() => { send({ type: "chat:session", text: helpingText }); setHelping(false); }}>Use just for now</button>
        </div>
      )}
      <div class="chat__log" ref={logRef} aria-live="polite" data-testid="chat-log">
        {(!chat || chat.messages.length === 0) && (
          <p class="pz-muted" style="margin:0">Ask about this page, or tell Prism what to do.</p>
        )}
        {chat?.messages.map((m) => {
          if (m.kind === "confirm") return null;
          if (m.kind === "action") return <div class="msg msg--action"><Icon name="check" /> {m.text}</div>;
          return <div class={`msg msg--${m.kind}`}>{m.kind === "prism" || m.kind === "question" ? <Rich text={m.text} /> : m.text}</div>;
        })}
        {waitingConfirm && (
          <div class="confirm" role="alertdialog" aria-label="Prism needs your permission" data-testid="chat-confirm">
            <span class="pz-label">Prism needs your OK</span>
            <span class="confirm__what">{chat!.pending!.description}</span>
            <div class="confirm__row">
              <button class="pz-btn pz-btn--primary" type="button" data-testid="confirm-yes" onClick={() => send({ type: "chat:confirm", approved: true })}>Yes, do it</button>
              <button class="pz-btn" type="button" data-testid="confirm-no" onClick={() => send({ type: "chat:confirm", approved: false })}>No, stop here</button>
            </div>
          </div>
        )}
      </div>
      {(busy || waitingConfirm) && (
        <div class="chat__status" role="status">
          {busy && <div class="pz-progress" style="flex:1" aria-hidden="true" />}
          <span>{chat?.status === "thinking" ? "Thinking…" : chat?.status === "acting" ? "Working on the page…" : "Waiting for you"}</span>
          <button class="pz-btn pz-btn--danger pz-btn--small" type="button" data-testid="chat-stop" onClick={() => send({ type: "chat:stop" })}><Icon name="stop" /> Stop</button>
        </div>
      )}
      <form class="chat__compose" onSubmit={submit}>
        <label class="pz-sr" for="pz-chat-input">Message to Prism</label>
        <textarea id="pz-chat-input" ref={inputRef} class="pz-input" value={text} placeholder="Type your question or what you'd like done…"
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }} data-testid="chat-input" />
        <div class="chat__row">
          <label class="toggle"><input type="checkbox" checked={includeScreen} onChange={(e) => setIncludeScreen((e.target as HTMLInputElement).checked)} /> Include the whole screen</label>
          <button class="pz-btn pz-btn--primary pz-btn--small" type="submit" disabled={!text.trim() || !!busy} data-testid="chat-send">Send</button>
        </div>
      </form>
    </section>
  );
}
