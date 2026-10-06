/** Content script entry: mounts the Prism UI in a Shadow DOM root and wires messages. */
import { render } from "preact";
import { getSettings, getSitePrefs } from "../shared/storage";
import type { Rect, Settings, StyleId } from "../shared/types";
import uiCss from "../ui/prism-ui.css";
import overlayCss from "./overlay.css";
import { loadLanguage } from "../shared/i18n";
import { App, type Bus } from "./App";
import { GuideLayer } from "./guide";
import { cancelPendingActions, checkAction, executeAction, observePage } from "./actions";
import { SelectionController } from "./selection";
import { loadFonts, TidyEngine } from "./tidy";

declare global {
  interface Window { __prismLoaded?: boolean }
}

function main() {
  if (window.__prismLoaded) return;
  window.__prismLoaded = true;
  if (!document.documentElement || document.contentType !== "text/html") return;

  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const bus: Bus & { emit: (t: string, p?: unknown) => void } = {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
      return () => listeners.get(type)!.delete(fn);
    },
    emit(type, payload) { listeners.get(type)?.forEach((fn) => fn(payload)); },
  };

  const engine = new TidyEngine();
  const selection = new SelectionController();

  const host = document.createElement("prism-root");
  host.setAttribute("aria-live", "off");
  // Closed in production so page scripts can't read Prism's UI (which may show personal context).
  const shadow = host.attachShadow({ mode: __PRISM_TEST__ ? "open" : "closed" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${uiCss}\n${overlayCss}`);
  shadow.adoptedStyleSheets = [sheet];
  const mount = document.createElement("div");
  shadow.append(mount);
  document.documentElement.append(host);
  loadFonts(["Prism Inter", "Prism Instrument", "Prism Atkinson"]);

  // Keep Prism's root as the last element so it stays on top, even if the page re-renders <html>.
  new MutationObserver(() => {
    if (!host.isConnected) document.documentElement.append(host);
  }).observe(document.documentElement, { childList: true });

  const setHidden = async (hidden: boolean) => {
    host.style.setProperty("visibility", hidden ? "hidden" : "visible", "important");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };

  render(<App engine={engine} selection={selection} bus={bus} setHidden={setHidden} />, mount);
  // Guide me's spotlight sits above everything else Prism draws.
  const guideMount = document.createElement("div");
  shadow.append(guideMount);
  render(<GuideLayer />, guideMount);

  const applySettings = (s: Settings) => {
    loadLanguage(s.translateTo, (code) => chrome.runtime.sendMessage({ type: "i18n:words", code })).then((lang) => {
      host.setAttribute("dir", lang.rtl ? "rtl" : "ltr");
      host.setAttribute("lang", lang.code);
    });
    selection.shortcut = s.shortcut;
    if (s.reduceMotion === "on") host.setAttribute("data-reduce-motion", "");
    else host.removeAttribute("data-reduce-motion");
    bus.emit("settings", s);
  };
  getSettings().then(applySettings);
  engine.initStyle();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) {
      getSettings().then((s) => { applySettings(s); engine.refreshSettings(); engine.initStyle(); });
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const reply = (value: unknown) => { sendResponse(value); };
    switch (msg?.type) {
      case "prism:ping": reply({ ok: true }); return false;
      case "prism:status": reply({ ...engine.state, url: location.href, origin: location.origin }); return false;
      case "prism:toggle":
        // Always answer with the real state, even if something went wrong, so the popup never gets stuck.
        (msg.on ? engine.enable() : engine.disable("Showing the original page.")).catch((err) => console.warn("Prism:", err)).finally(() => reply(engine.state));
        return true;
      case "prism:set-style": engine.setStyle(msg.styleId as StyleId).catch(() => {}).finally(() => reply(engine.state)); return true;
      case "prism:set-touch": engine.setTouch(msg.touch === "light" ? "light" : "full").catch(() => {}).finally(() => reply(engine.state)); return true;
      case "prism:regenerate": engine.regenerate().catch(() => {}).finally(() => reply(engine.state)); return true;
      case "prism:start-selection":
        if (msg.mode === "keyboard") selection.startKeyboard(); else selection.startExplicit();
        reply({ ok: true });
        return false;
      case "prism:open-chat": bus.emit("open-chat"); reply({ ok: true }); return false;
      case "prism:read-page": bus.emit("read-page"); reply({ ok: true }); return false;
      case "prism:guide": chrome.runtime.sendMessage({ type: "guide:start", goal: String(msg.goal ?? "") }).then(() => reply({ ok: true }), () => reply({ ok: false })); return true;
      case "prism:open-panel": bus.emit("panel", true); reply({ ok: true }); return false;
      case "prism:context-ask": bus.emit("context-ask", contextRect(msg.selectionText, msg.srcUrl)); reply({ ok: true }); return false;
      case "prism:viewport": reply({ width: innerWidth, height: innerHeight }); return false;
      case "prism:hide-ui": setHidden(true).then(() => reply({ ok: true })); return true;
      case "prism:show-ui": setHidden(false).then(() => reply({ ok: true })); return true;
      case "prism:debug": reply({ ...engine.debug, status: engine.state.status, pageKey: location.href }); return false;
      case "prism:test-plan":
        // Test builds only: apply an arbitrary (possibly invalid) plan to check validation.
        if (!__PRISM_TEST__) { reply({ ok: false }); return false; }
        reply(engine.applyPlan(msg.plan));
        return false;
      case "chat:update": bus.emit("chat:update", msg.state); return false;
      case "chat:observe": reply({ text: observePage() }); return false;
      case "chat:check": reply(checkAction(msg.action)); return false;
      case "chat:exec": executeAction(msg.action).then(reply); return true;
      case "chat:cancel": cancelPendingActions(); reply({ ok: true }); return false;
      default: return false;
    }
  });

  // Tidy automatically on sites the person chose (or everywhere), using the saved layout if any.
  (async () => {
    const [settings, site] = await Promise.all([getSettings(), getSitePrefs(location.origin)]);
    if (site.tidy === "always" || (settings.tidyEverywhere && site.tidy !== "never")) {
      const start = () => engine.enable();
      if (document.readyState === "complete") start();
      else addEventListener("load", start, { once: true });
    }
  })();

  chrome.runtime.sendMessage({ type: "content:ready" }).catch(() => {});
}

function contextRect(selectionText: string, srcUrl: string): Rect {
  const sel = getSelection();
  if (selectionText && sel && sel.rangeCount) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r.width && r.height) return pad({ x: r.left, y: r.top, width: r.width, height: r.height });
  }
  if (srcUrl) {
    const img = [...document.images].find((i) => i.currentSrc === srcUrl || i.src === srcUrl);
    if (img) {
      const r = img.getBoundingClientRect();
      return pad({ x: r.left, y: r.top, width: r.width, height: r.height });
    }
  }
  const w = Math.min(600, innerWidth * 0.7);
  const h = Math.min(400, innerHeight * 0.6);
  return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, width: w, height: h };
}

function pad(r: Rect): Rect {
  const x = Math.max(0, r.x - 6);
  const y = Math.max(0, r.y - 6);
  return { x, y, width: Math.min(innerWidth - x, r.width + 12), height: Math.min(innerHeight - y, r.height + 12) };
}

main();
