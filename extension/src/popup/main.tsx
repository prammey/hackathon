/** Toolbar popup: the quickest way to tidy, choose a style, point at something, or open settings. */
import { render } from "preact";
import { bootPage } from "../ui/boot";
import { useEffect, useState } from "preact/hooks";
import { getSettings, getSitePrefs, saveSitePrefs } from "../shared/storage";
import type { Settings, SitePrefs, StyleId } from "../shared/types";
import { t, tj } from "../shared/i18n";
import { Brand, Icon, MicButton, Notice, StylePicker, Switch, useLanguage } from "../ui/components";
import type { GuideState } from "../background/guide";

interface PageStatus {
  status: string;
  styleId: StyleId;
  message: string;
  pagePurpose: string;
  origin: string;
  url: string;
}

type Load = { kind: "loading" } | { kind: "restricted"; reason: string; tabId?: number } | { kind: "ready"; tabId: number; page: PageStatus };

/** "What do you want to do?": starts Guide me on this tab — even a blank new tab — and shows its questions. */
function GuideBox({ tabId }: { tabId: number }) {
  useLanguage();
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<GuideState | null>(null);
  const [other, setOther] = useState("");
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "guide:state", tabId }).then((s) => setState((s as GuideState | null) ?? null)).catch(() => {});
    const onMsg = (msg: { type?: string; state?: GuideState }) => {
      if (msg?.type === "guide:update" && msg.state?.tabId === tabId) setState(msg.state.status === "stopped" ? null : msg.state);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, [tabId]);
  // Once the page shows the spotlight, the popup steps out of the way.
  useEffect(() => {
    if (state?.status !== "showing") return;
    const timer = setTimeout(() => window.close(), 1600);
    return () => clearTimeout(timer);
  }, [state?.status]);

  const start = (e?: Event) => {
    e?.preventDefault();
    if (!goal.trim()) return;
    chrome.runtime.sendMessage({ type: "guide:start", tabId, goal: goal.trim() }).then((s) => setState(s as GuideState));
  };
  const stop = () => { chrome.runtime.sendMessage({ type: "guide:stop", tabId }); setState(null); };
  const answer = (a: string) => a.trim() && chrome.runtime.sendMessage({ type: "guide:answer", tabId, answer: a.trim() });

  if (state) {
    return (
      <section class="guide-box" aria-live="polite" data-testid="popup-guide">
        <span class="pz-label"><Icon name="guide" /> {t("Guide me")}: {state.goal}</span>
        {state.status === "thinking" && <p class="guide-box__text"><span class="pz-progress" aria-hidden="true" /> {t("Finding the next step…")}</p>}
        {state.status === "showing" && <p class="guide-box__text">{t("Follow the purple highlight on the page.")}</p>}
        {state.status === "asking" && state.step && (
          <>
            <p class="guide-box__text" data-testid="popup-guide-question">{state.step.instruction}</p>
            <div class="guide-box__choices">
              {state.step.choices.map((c) => <button class="pz-btn" type="button" onClick={() => answer(c)}>{c}</button>)}
            </div>
            <form class="guide-box__row" onSubmit={(e) => { e.preventDefault(); answer(other); }}>
              <input class="pz-input" value={other} placeholder={t("Or type your answer")} onInput={(e) => setOther((e.target as HTMLInputElement).value)} />
              <button class="pz-btn pz-btn--primary pz-btn--small" type="submit" disabled={!other.trim()}>{t("OK")}</button>
            </form>
          </>
        )}
        {(state.status === "done" || state.status === "stuck") && <p class="guide-box__text">{state.step?.instruction || state.error}</p>}
        <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={stop} data-testid="popup-guide-stop"><Icon name="close" /> {state.status === "done" ? t("Close") : t("Stop")}</button>
      </section>
    );
  }
  return (
    <form class="guide-box" onSubmit={start}>
      <label class="pz-label" for="guide-goal">{t("What do you want to do?")}</label>
      <div class="guide-box__row">
        <input id="guide-goal" class="pz-input" value={goal} placeholder={t("For example: send an email to my son")}
          onInput={(e) => setGoal((e.target as HTMLInputElement).value)} data-testid="popup-guide-goal" />
        <MicButton small iconOnly onText={(text) => setGoal(text)} />
        <button class="pz-btn pz-btn--primary pz-btn--small" type="submit" disabled={!goal.trim()} data-testid="popup-guide-start"><Icon name="guide" /> {t("Guide me")}</button>
      </div>
    </form>
  );
}

function Popup() {
  useLanguage();
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
      // A blank new tab needs no warning: "What do you want to do?" is all there is to say there.
      const blankTab = !!tab?.url && /^(chrome|edge):\/\/(newtab|new-tab-page)|^about:blank/.test(tab.url);
      const reason = tab?.url?.startsWith("file:")
        ? t("To use Prism on files on your computer, turn on “Allow access to file URLs” for Prism in your browser's extension settings.")
        : t("Prism can't change this page — the browser protects pages like this one (for example settings pages, the new tab page and extension stores).");
      setLoad({ kind: "restricted", reason: blankTab ? "" : reason, tabId: tab?.id });
      return;
    }
    const injected = await chrome.runtime.sendMessage({ type: "ensure-content", tabId: tab.id });
    if (!injected) {
      setLoad({ kind: "restricted", reason: t("Prism isn't allowed to work on this page. It may be protected by the browser or by your organisation.") });
      return;
    }
    try {
      const page = (await chrome.tabs.sendMessage(tab.id, { type: "prism:status" })) as PageStatus;
      setLoad({ kind: "ready", tabId: tab.id, page });
      setSite(await getSitePrefs(page.origin));
    } catch {
      setLoad({ kind: "restricted", reason: t("This page is still loading. Close this window and try again in a moment.") });
    }
  }

  useEffect(() => {
    refresh();
    chrome.runtime.sendMessage({ type: "health" }).then(setHealth);
  }, []);

  // Keep the popup in step with the page while it's open (e.g. when the AI layout finishes).
  useEffect(() => {
    if (load.kind !== "ready") return;
    const timer = setInterval(async () => {
      try {
        const next = (await chrome.tabs.sendMessage(load.tabId, { type: "prism:status" })) as PageStatus;
        if (!busy && next) setLoad((cur) => (cur.kind === "ready" ? { ...cur, page: { ...cur.page, ...next } } : cur));
      } catch { /* page navigated away */ }
    }, 1000);
    return () => clearInterval(timer);
  }, [load.kind === "ready" ? load.tabId : 0, busy]);

  if (load.kind === "loading" || !settings) {
    return <Shell><div class="pz-progress" aria-hidden="true" /><p>{t("Opening Prism…")}</p></Shell>;
  }
  if (load.kind === "restricted") {
    return (
      <Shell>
        {load.tabId !== undefined && <GuideBox tabId={load.tabId} />}
        {load.reason && <Notice>{load.reason}</Notice>}
        <button class="pz-btn pz-btn--block" type="button" onClick={() => chrome.runtime.openOptionsPage()}><Icon name="settings" /> {t("Settings")}</button>
        <HelperStatus health={health} />
      </Shell>
    );
  }

  const { tabId, page } = load;
  const host = new URL(page.url).host;
  const on = page.status !== "off";
  const tabMsg = async (message: { type: string; on?: boolean; styleId?: StyleId }) => {
    // Show the change straight away; the page's own answer then confirms it.
    if (message.type === "prism:toggle") setLoad({ kind: "ready", tabId, page: { ...page, status: message.on ? "base" : "off" } });
    if (message.type === "prism:set-style" && message.styleId) setLoad({ kind: "ready", tabId, page: { ...page, styleId: message.styleId } });
    setBusy(true);
    try {
      const next = (await chrome.tabs.sendMessage(tabId, message)) as PageStatus | undefined;
      if (next && "status" in next) setLoad({ kind: "ready", tabId, page: { ...page, ...next } });
    } catch {
      setLoad({ kind: "ready", tabId, page });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell host={host}>
      <GuideBox tabId={tabId} />
      <Switch checked={on} label={t("Tidy this page")} id="tidy-switch" disabled={busy}
        onChange={(v) => tabMsg({ type: "prism:toggle", on: v })} />
      <label class="pz-choice">
        <input type="checkbox" checked={site.tidy === "always"} onChange={async (e) => {
          const always = (e.target as HTMLInputElement).checked;
          setSite(await saveSitePrefs(page.origin, { tidy: always ? "always" : undefined }));
          if (always && !on) tabMsg({ type: "prism:toggle", on: true });
        }} />
        <span>{tj("Tidy {host} automatically every time", { host: <strong>{host}</strong> })}</span>
      </label>
      {page.message && (
        <p class="pz-muted" role="status" style="margin:0">{page.status === "planning" ? t("Prism is studying the page…") : page.message}</p>
      )}
      <div style="display:grid;gap:8px">
        <span class="pz-label" id="style-label">{t("Style")}</span>
        <StylePicker value={page.styleId} label={t("Style")} onChange={(id) => tabMsg({ type: "prism:set-style", styleId: id })} />
      </div>
      <div style="display:grid;gap:6px">
        <div class="popup__actions">
          <button class="pz-btn pz-btn--primary" type="button" data-testid="popup-point"
            onClick={async () => { await chrome.tabs.sendMessage(tabId, { type: "prism:start-selection" }); window.close(); }}>
            <Icon name="select" /> {t("Point at something")}
          </button>
          <button class="pz-btn" type="button"
            onClick={async () => { await chrome.tabs.sendMessage(tabId, { type: "prism:open-chat" }); window.close(); }}>
            <Icon name="chat" /> {t("Chat")}
          </button>
        </div>
      </div>
      <div class="popup__foot">
        <HelperStatus health={health} />
        <span style="display:flex;gap:2px">
          {on && <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" title={t("Tidy again from scratch")} aria-label={t("Tidy again from scratch")} onClick={() => tabMsg({ type: "prism:regenerate" })}><Icon name="restore" /></button>}
          <button class="pz-btn pz-btn--quiet pz-btn--small" type="button" onClick={() => chrome.runtime.openOptionsPage()}><Icon name="settings" /> {t("Settings")}</button>
        </span>
      </div>
    </Shell>
  );
}

function HelperStatus({ health }: { health: { ok: boolean; mode?: string } | null }) {
  useLanguage();
  if (!health) return null;
  return health.ok
    ? <p class="pz-hint" style="margin:0;display:flex;gap:8px;align-items:center"><span class="status-dot" aria-hidden="true" /> {t("AI connected")}</p>
    : <Notice tone="warn">{t("Prism's AI isn't reachable right now. Tidying still works; explanations need the AI.")} <a href="options.html#service" target="_blank">{t("Check the connection")}</a></Notice>;
}

function Shell(props: { host?: string; children: preact.ComponentChildren }) {
  return (
    <main class="popup">
      <header class="popup__head">
        <Brand size={28} />
        {props.host && <span class="pz-muted popup__host" title={props.host}>{props.host}</span>}
      </header>
      {props.children}
    </main>
  );
}

bootPage(() => render(<Popup />, document.getElementById("app")!));
