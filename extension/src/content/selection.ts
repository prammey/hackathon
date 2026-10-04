/**
 * "Point at something": hold the shortcut and drag, or use explicit/keyboard modes.
 * State machine: idle → armed → dragging → complete (or cancelled on Esc/blur/tiny drag).
 * Rects are kept in document coordinates so scrolling mid-drag works; emitted rects are viewport CSS px.
 */
import { t } from "../shared/i18n";
import type { Rect, ShortcutId } from "../shared/types";

export type SelPhase = "idle" | "armed" | "dragging" | "complete";
export type SelMode = "hotkey" | "explicit" | "keyboard";

export interface SelState {
  phase: SelPhase;
  mode: SelMode;
  rect: Rect | null; // viewport coordinates
}

type Listener = (s: SelState) => void;

const MIN_SIZE = 8;

export function shortcutLabel(id: ShortcutId, mac: boolean): string {
  if (id === "alt") return mac ? t("Option ⌥") : t("Alt");
  if (id === "shift-alt") return mac ? t("Shift + Option ⌥") : t("Shift + Alt");
  return mac ? t("Control + Shift") : t("Ctrl + Shift");
}

export class SelectionController {
  state: SelState = { phase: "idle", mode: "hotkey", rect: null };
  shortcut: ShortcutId = "alt";
  enabled = true;
  private listeners = new Set<Listener>();
  private start: { x: number; y: number } | null = null; // document coords
  private current: { x: number; y: number } | null = null; // viewport coords
  private completeListeners = new Set<(rect: Rect) => void>();

  constructor() {
    addEventListener("keydown", (e) => this.onKeyDown(e), true);
    addEventListener("keyup", (e) => this.onKeyUp(e), true);
    addEventListener("blur", () => this.cancelIfHotkey(), true);
    document.addEventListener("visibilitychange", () => document.hidden && this.cancel());
    addEventListener("scroll", () => this.onScroll(), { passive: true, capture: true });
  }

  onChange(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  onComplete(fn: (rect: Rect) => void) { this.completeListeners.add(fn); return () => this.completeListeners.delete(fn); }

  private set(patch: Partial<SelState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  held(e: KeyboardEvent | PointerEvent | MouseEvent): boolean {
    if (this.shortcut === "alt") return e.altKey && !e.ctrlKey && !e.metaKey;
    if (this.shortcut === "shift-alt") return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;
    return e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && this.state.phase !== "idle") {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
      return;
    }
    if (this.state.mode === "keyboard" && this.state.phase === "dragging") {
      this.onKeyboardAdjust(e);
      return;
    }
    if (!this.enabled || this.state.phase !== "idle" || e.repeat || e.isComposing) return;
    const isModifier = ["Alt", "Shift", "Control"].includes(e.key);
    if (isModifier && this.held(e)) this.set({ phase: "armed", mode: "hotkey", rect: null });
  }

  private onKeyUp(e: KeyboardEvent) {
    if (this.state.mode !== "hotkey") return;
    if (this.state.phase === "armed" && !this.held(e)) this.set({ phase: "idle", rect: null });
    // Released mid-drag: keep dragging until the mouse is released (natural release order).
    if (this.state.phase === "dragging" || this.state.phase === "complete") {
      if (e.key === "Alt") e.preventDefault(); // stop Windows from focusing the menu bar
    }
  }

  private cancelIfHotkey() {
    if (this.state.mode === "hotkey" && this.state.phase !== "complete") this.cancel();
  }

  startExplicit() {
    this.set({ phase: "armed", mode: "explicit", rect: null });
  }

  startKeyboard() {
    const w = Math.min(480, innerWidth * 0.6);
    const h = Math.min(260, innerHeight * 0.4);
    const x = (innerWidth - w) / 2;
    const y = (innerHeight - h) / 2;
    this.start = { x: x + scrollX, y: y + scrollY };
    this.current = { x: x + w, y: y + h };
    this.set({ phase: "dragging", mode: "keyboard", rect: { x, y, width: w, height: h } });
  }

  private onKeyboardAdjust(e: KeyboardEvent) {
    const step = e.altKey ? 4 : 24;
    const r = { ...this.state.rect! };
    const keys: Record<string, () => void> = {
      ArrowLeft: () => (e.shiftKey ? (r.width = Math.max(40, r.width - step)) : (r.x -= step)),
      ArrowRight: () => (e.shiftKey ? (r.width += step) : (r.x += step)),
      ArrowUp: () => (e.shiftKey ? (r.height = Math.max(30, r.height - step)) : (r.y -= step)),
      ArrowDown: () => (e.shiftKey ? (r.height += step) : (r.y += step)),
    };
    if (keys[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keys[e.key]();
      const clamped = clampRect(r);
      this.start = { x: clamped.x + scrollX, y: clamped.y + scrollY };
      this.current = { x: clamped.x + clamped.width, y: clamped.y + clamped.height };
      this.set({ rect: clamped });
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      this.finish();
    }
  }

  pointerDown(x: number, y: number) {
    if (this.state.phase !== "armed") return;
    this.start = { x: x + scrollX, y: y + scrollY };
    this.current = { x, y };
    this.set({ phase: "dragging", rect: { x, y, width: 0, height: 0 } });
  }

  pointerMove(x: number, y: number) {
    if (this.state.phase !== "dragging" || this.state.mode === "keyboard") return;
    this.current = { x, y };
    this.set({ rect: this.computeRect() });
  }

  pointerUp(x: number, y: number) {
    if (this.state.phase !== "dragging" || this.state.mode === "keyboard") return;
    this.current = { x, y };
    this.set({ rect: this.computeRect() });
    this.finish();
  }

  private onScroll() {
    if (this.state.phase === "dragging" && this.start && this.current) this.set({ rect: this.computeRect() });
  }

  private computeRect(): Rect {
    const sx = this.start!.x - scrollX;
    const sy = this.start!.y - scrollY;
    const { x: cx, y: cy } = this.current!;
    return { x: Math.min(sx, cx), y: Math.min(sy, cy), width: Math.abs(cx - sx), height: Math.abs(cy - sy) };
  }

  private finish() {
    const rect = this.state.rect ? clampRect(this.state.rect) : null;
    if (!rect || rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      this.cancel(); // an accidental click: nothing happens, and the page never received it
      return;
    }
    this.set({ phase: "complete", rect });
    for (const fn of this.completeListeners) fn(rect);
  }

  /** Re-open a completed selection for adjustment by dragging again. */
  adjust() {
    this.set({ phase: "armed", mode: "explicit", rect: null });
  }

  cancel() {
    this.start = null;
    this.current = null;
    this.set({ phase: "idle", rect: null, mode: "hotkey" });
  }
}

/** Clip to the visible viewport (only what's visible can be captured). */
export function clampRect(r: Rect): Rect {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const right = Math.min(innerWidth, r.x + r.width);
  const bottom = Math.min(innerHeight, r.y + r.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** Place a floating box of size (w,h) near rect, flipping to stay fully inside the viewport. */
export function placeNear(rect: Rect, w: number, h: number, gap = 12, margin = 12): { x: number; y: number; docked: boolean } {
  const vw = innerWidth;
  const vh = innerHeight;
  const fitsX = (x: number) => x >= margin && x + w <= vw - margin;
  const fitsY = (y: number) => y >= margin && y + h <= vh - margin;
  const clampX = (x: number) => Math.min(Math.max(margin, x), Math.max(margin, vw - w - margin));
  const clampY = (y: number) => Math.min(Math.max(margin, y), Math.max(margin, vh - h - margin));
  const below = rect.y + rect.height + gap;
  if (fitsY(below)) return { x: clampX(rect.x), y: below, docked: false };
  const above = rect.y - gap - h;
  if (fitsY(above)) return { x: clampX(rect.x), y: above, docked: false };
  const right = rect.x + rect.width + gap;
  if (fitsX(right)) return { x: right, y: clampY(rect.y), docked: false };
  const left = rect.x - gap - w;
  if (fitsX(left)) return { x: left, y: clampY(rect.y), docked: false };
  // The selection covers most of the screen: dock to the bottom-right corner.
  return { x: clampX(vw - w - margin), y: clampY(vh - h - margin), docked: true };
}
