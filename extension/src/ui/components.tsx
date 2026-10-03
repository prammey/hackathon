/** Small shared Preact components used by the in-page UI and the extension pages. */
import type { ComponentChildren } from "preact";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { StyleId } from "../shared/types";

/** Placeholder Prism mark: a prism outline splitting one beam into four soft bands. */
export function Logo({ size = 28, title = "Prism" }: { size?: number; title?: string }) {
  return (
    <svg class="pz-logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <path d="M2 34 L22 31" stroke="#1B1F3B" stroke-width="3.5" stroke-linecap="round" />
      <path d="M31 8 L54 50 L8 50 Z" fill="#FFFFFF" stroke="#1B1F3B" stroke-width="4.5" stroke-linejoin="round" />
      <path d="M22 31 L40 33" stroke="#1B1F3B" stroke-width="2" stroke-linecap="round" opacity=".35" />
      <path d="M43 30 L62 22" stroke="#FF7A59" stroke-width="4" stroke-linecap="round" />
      <path d="M44 33 L62 30" stroke="#FFC24B" stroke-width="4" stroke-linecap="round" />
      <path d="M44 36 L62 38" stroke="#2BB3A3" stroke-width="4" stroke-linecap="round" />
      <path d="M43 39 L62 46" stroke="#3D7BFD" stroke-width="4" stroke-linecap="round" />
    </svg>
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
