import logoUrl from "./logo-96.png";
/** Small shared Preact components used by the in-page UI and the extension pages. */
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { StyleId } from "../shared/types";

/** The Prism logo artwork (extension/assets/logo-source.png), embedded so it works on any page. */
export function Logo({ size = 28, title = "Prism" }: { size?: number; title?: string }) {
  return <img class="pz-logo" src={logoUrl} width={size} height={size} alt={title} draggable={false} />;
}

/** Logo + serif-italic wordmark, used everywhere Prism names itself. */
export function Brand({ size = 28, label }: { size?: number; label?: string }) {
  return (
    <span class="pz-brand">
      <Logo size={size} />
      <span class="pz-wordmark" style={`font-size:${Math.round(size * 0.95)}px`}>Prism</span>
      {label && <span class="pz-muted" style="font-size:15px;font-weight:500;margin-left:2px">{label}</span>}
    </span>
  );
}

const paths: Record<string, string> = {
  define: "M5 4h9a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H5zM19 4h0M5 4v13M9 8h5M9 11h5",
  translate: "M3 5h10M8 3v2M5 5c0 4 3 7 6 8M11 5c0 4-3 7-7 9M13 20l4-9 4 9M14.5 17h5",
  fill: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  chat: "M4 5h16v11H9l-5 4z M8 9h8M8 12h5",
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 5l-7 7 7 7",
  select: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  undo: "M9 7H4V2M4 7a8 8 0 1 1-1 7",
  stop: "M7 7h10v10H7z",
  check: "M5 12l5 5 9-10",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  restore: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  sparkle: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  copy: "M8 8h11v12H8zM5 16V4h11",
  speak: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8",
};

export function Icon({ name, label }: { name: keyof typeof paths | string; label?: string }) {
  return (
    <svg class="pz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label}>
      <path d={paths[name] ?? paths.sparkle} />
    </svg>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; disabled?: boolean }) {
  return (
    // Never disabled while busy: disabling a focused control would drop keyboard focus.
    <button type="button" role="switch" id={props.id} class="pz-switch" aria-checked={props.checked}
      aria-busy={props.disabled ? "true" : undefined} onClick={() => !props.disabled && props.onChange(!props.checked)}>
      <span>{props.label}</span>
      <span style="display:flex;align-items:center">
        <span class="pz-switch__state" aria-hidden="true">{props.checked ? "On" : "Off"}</span>
        <span class="pz-switch__track" aria-hidden="true"><span class="pz-switch__thumb" /></span>
      </span>
    </button>
  );
}

export function StylePicker(props: { value: StyleId; onChange: (id: StyleId) => void; label?: string }) {
  return (
    <div role="group" aria-label={props.label ?? "Style"} class="pz-styles">
      {STYLE_ORDER.map((id) => {
        const s = STYLES[id];
        return (
          <button type="button" class="pz-style" aria-pressed={props.value === id} onClick={() => props.onChange(id)}
            title={s.tagline} data-style={id}>
            <span class="pz-style__swatch" aria-hidden="true">
              {s.preview.swatches.map((c) => <span style={`background:${c}`} />)}
            </span>
            <span class="pz-style__name">
              {s.name}
              {props.value === id && <svg class="pz-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Notice(props: { tone?: "info" | "error" | "ok" | "warn"; children: ComponentChildren; role?: "alert" | "status" | "note" }) {
  const tone = props.tone ?? "info";
  return (
    <div class={`pz-notice${tone === "info" ? "" : ` pz-notice--${tone}`}`} role={props.role ?? (tone === "error" ? "alert" : "status")}>
      <div>{props.children}</div>
    </div>
  );
}

export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}


export type MicPhase = "idle" | "listening" | "writing";

/**
 * Talk instead of typing: tap to start listening, tap again to stop; Prism writes the words down and hands
 * them to `onText`. Recording happens in Prism's own recorder page (see offscreen/record.ts).
 */
export function MicButton(props: { onText: (text: string) => void; onError?: (message: string) => void; onPhase?: (phase: MicPhase) => void; label?: string; small?: boolean; testId?: string }) {
  const [phase, setPhaseState] = useState<MicPhase>("idle");
  const live = useRef<MicPhase>("idle");
  const setPhase = (p: MicPhase) => { live.current = p; setPhaseState(p); props.onPhase?.(p); };
  // If the button goes away mid-recording, stop the microphone.
  useEffect(() => () => { if (live.current === "listening") chrome.runtime.sendMessage({ type: "dictate:stop" }).catch(() => {}); }, []);
  async function toggle(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (phase === "writing") return;
    if (phase === "idle") {
      const r = await chrome.runtime.sendMessage({ type: "dictate:start" }) as { ok: boolean; error?: { message: string } };
      if (r?.ok) setPhase("listening");
      else props.onError?.(r?.error?.message ?? "Prism couldn't start listening.");
      return;
    }
    setPhase("writing");
    const r = await chrome.runtime.sendMessage({ type: "dictate:stop" }) as { ok: boolean; value?: { text: string }; error?: { message: string } };
    setPhase("idle");
    if (r?.ok && r.value?.text) props.onText(r.value.text);
    else props.onError?.(r?.error?.message ?? "Prism didn't catch that. Please try again.");
  }
  const text = phase === "listening" ? "Tap to stop" : phase === "writing" ? "Writing it down…" : (props.label ?? "Talk");
  return (
    <button type="button" class={`pz-btn pz-mic${props.small ? " pz-btn--small" : ""} pz-mic--${phase}`} onMouseDown={(e) => e.preventDefault()} onClick={toggle}
      aria-pressed={phase === "listening"} aria-label={phase === "idle" ? `${props.label ?? "Talk"}: say it instead of typing` : text} data-testid={props.testId} data-phase={phase}>
      <Icon name="mic" /> {text}
    </button>
  );
}

/** Asks for the microphone on Prism's own page; Chrome remembers the answer for every website. */
export async function allowMicrophone(): Promise<string> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "";
  } catch (err) {
    return (err as Error).name === "NotAllowedError"
      ? "The microphone was blocked. Click the camera/microphone icon in the address bar, choose Allow, then try again."
      : "Prism couldn't find a microphone on this computer.";
  }
}
