/** Toolbar popup: the quickest way to tidy, choose a style, point at something, or open settings. */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, getSitePrefs, saveSitePrefs } from "../shared/storage";
import type { Settings, SitePrefs, StyleId } from "../shared/types";
import { Icon, isMac, Logo, Notice, StylePicker, Switch } from "../ui/components";
import { shortcutLabel } from "../content/selection";

interface PageStatus {
  status: string;
  styleId: StyleId;
  message: string;
  pagePurpose: string;
  origin: string;
  url: string;
}

type Load = { kind: "loading" } | { kind: "restricted"; reason: string } | { kind: "ready"; tabId: number; page: PageStatus };

function Popup() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [site, setSite] = useState<SitePrefs>({});
  const [health, setHealth] = useState<{ ok: boolean; mode?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    // ?tabId= lets automated tests (which open the popup as a normal tab) point it at a page.
    const forced = Number(new URLSearchParams(location.search).get("tabId"));
    const [tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true });
    setSettings(await getSettings());
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      const reason = tab?.url?.startsWith("file:")
        ? "To use Prism on files on your computer, turn on “Allow access to file URLs” for Prism in your browser's extension settings."
        : "Prism can't change this page — the browser protects pages like this one (for example settings pages, the new tab page and extension stores).";
      setLoad({ kind: "restricted", reason });
      return;
    }
    const injected = await chrome.runtime.sendMessage({ type: "ensure-content", tabId: tab.id });
    if (!injected) {
      setLoad({ kind: "restricted", reason: "Prism isn't allowed to work on this page. It may be protected by the browser or by your organisation." });
      return;
    }
    try {
      const page = (await chrome.tabs.sendMessage(tab.id, { type: "prism:status" })) as PageStatus;
      setLoad({ kind: "ready", tabId: tab.id, page });
      setSite(await getSitePrefs(page.origin));
    } catch {
      setLoad({ kind: "restricted", reason: "This page is still loading. Close this window and try again in a moment." });
    }
  }

  useEffect(() => {
    refresh();
    chrome.runtime.sendMessage({ type: "health" }).then(setHealth);
  }, []);

  if (load.kind === "loading" || !settings) {
    return <Shell><div class="pz-progress" aria-hidden="true" /><p>Opening Prism…</p></Shell>;
  }
  if (load.kind === "restricted") {
    return (
      <Shell>
        <Notice>{load.reason}</Notice>
        <button class="pz-btn pz-btn--block" type="button" onClick={() => chrome.runtime.openOptionsPage()}><Icon name="settings" /> Settings</button>
        <HelperStatus health={health} />
      </Shell>
    );
  }

  const { tabId, page } = load;
  const host = new URL(page.url).host;
  const on = page.status !== "off";
  const tabMsg = async (message: unknown) => {
    setBusy(true);
    try {
      const next = (await chrome.tabs.sendMessage(tabId, message)) as PageStatus | undefined;
      if (next && "status" in next) setLoad({ kind: "ready", tabId, page: { ...page, ...next } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell host={host}>
      <Switch checked={on} label="Tidy this page" id="tidy-switch" disabled={busy}
        onChange={(v) => tabMsg({ type: "prism:toggle", on: v })} />
      <label class="pz-choice">
        <input type="checkbox" checked={site.tidy === "always"} onChange={async (e) => {
          const always = (e.target as HTMLInputElement).checked;
          setSite(await saveSitePrefs(page.origin, { tidy: always ? "always" : undefined }));
          if (always && !on) tabMsg({ type: "prism:toggle", on: true });
        }} />
        <span>Tidy <strong>{host}</strong> automatically every time</span>
      </label>
      {page.message && (
        <p class="pz-muted" role="status" style="margin:0">{page.status === "planning" ? "Prism is studying the page…" : page.message}</p>
      )}
      <div style="display:grid;gap:8px">
        <span class="pz-label" id="style-label">Style</span>
        <StylePicker value={page.styleId} label="Style" onChange={(id) => tabMsg({ type: "prism:set-style", styleId: id })} />
      </div>
      <div style="display:grid;gap:6px">
        <div class="popup__actions">
          <button class="pz-btn pz-btn--primary" type="button" data-testid="popup-point"
            onClick={async () => { await chrome.tabs.sendMessage(tabId, { type: "prism:start-selection" }); window.close(); }}>
            <Icon name="select" /> Point at something
          </button>
          <button class="pz-btn" type="button"
            onClick={async () => { await chrome.tabs.sendMessage(tabId, { type: "prism:open-chat" }); window.close(); }}>
            <Icon name="chat" /> Chat
          </button>
        </div>
        <p class="pz-hint" style="margin:0;text-align:center">Or on the page, hold <strong>{shortcutLabel(settings.shortcut, isMac())}</strong> and drag.</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:space-between">
        {on && <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => tabMsg({ type: "prism:regenerate" })}><Icon name="restore" /> Tidy again from scratch</button>}
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => chrome.runtime.openOptionsPage()}><Icon name="settings" /> Settings</button>
      </div>
      <HelperStatus health={health} />
    </Shell>
  );
}

function HelperStatus({ health }: { health: { ok: boolean; mode?: string } | null }) {
  if (!health) return null;
  return health.ok
    ? <p class="pz-hint" style="margin:0;display:flex;gap:6px;align-items:center"><span style="width:10px;height:10px;border-radius:50%;background:#11704F" aria-hidden="true" /> Prism's AI is connected</p>
    : <Notice tone="warn">Prism's AI isn't reachable right now. Tidying still works; explanations need the AI. <a href="options.html#service" target="_blank">Check the connection</a></Notice>;
}

function Shell(props: { host?: string; children: preact.ComponentChildren }) {
  return (
    <main class="popup">
      <header class="popup__head">
        <span class="pz-brand"><Logo /> Prism</span>
        {props.host && <span class="pz-muted popup__host" title={props.host}>{props.host}</span>}
      </header>
      {props.children}
    </main>
  );
}

render(<Popup />, document.getElementById("app")!);
