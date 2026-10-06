/** Prism service worker: routing, helper calls, page CSS, capture, shortcuts, chat loop. */
import { loadLanguage, t } from "../shared/i18n";
import { getSettings, saveSettings } from "../shared/storage";
import type { Rect } from "../shared/types";
import { callHelper, helperHealth, stats } from "./api";
import { captureRegion } from "./capture";
import { followNewTabs, guideAdvanced, guideAnswer, guideBack, guidePageReady, guideRetry, guideLost, guideGoBack, loadGuide, startGuide, stopGuide } from "./guide";
import {
  clearChat, confirmPending, loadState, notifyReady, sendUserMessage, setSessionContext, startChat, stopChat,
} from "./chat";

// ---------- Install / startup ----------

// Error messages and chat notices from here are shown to the person, so they use the person's language.
async function loadPersonLanguage() {
  await loadLanguage((await getSettings()).translateTo);
  chrome.contextMenus.update("prism-ask", { title: t("Ask Prism about this") }, () => void chrome.runtime.lastError);
}
loadPersonLanguage();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) loadPersonLanguage();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();
  if (!settings.installId) await saveSettings({ installId: crypto.randomUUID() });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "prism-ask", title: t("Ask Prism about this"), contexts: ["selection", "image", "link", "page"],
    });
  });
  if (details.reason === "install" && !__PRISM_TEST__) {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
  await injectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (!settings.installId) await saveSettings({ installId: crypto.randomUUID() });
});

// Allow content scripts to read chat state if needed; the loop itself stays here.
chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});

/** Tabs opened before install don't have the content script yet. */
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) if (tab.id !== undefined) await ensureContent(tab.id);
}

export async function ensureContent(tabId: number): Promise<boolean> {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "prism:ping" });
    if (pong?.ok) return true;
  } catch {
    // not injected yet
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return true;
  } catch {
    return false;
  }
}

// ---------- Shortcuts and context menu ----------

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;
  if (!(await ensureContent(tab.id))) return;
  if (command === "start-selection") chrome.tabs.sendMessage(tab.id, { type: "prism:start-selection" });
  if (command === "open-chat") chrome.tabs.sendMessage(tab.id, { type: "prism:open-chat" });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || info.menuItemId !== "prism-ask") return;
  if (!(await ensureContent(tab.id))) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "prism:context-ask", selectionText: info.selectionText ?? "", srcUrl: info.srcUrl ?? "",
  });
});

// ---------- Page CSS per tab/frame ----------

const appliedCss = new Map<string, string>();

// Each frame can hold more than one Prism sheet ("page" for tidying, "spotlight" for chat highlights).
async function applyCss(tabId: number, frameId: number, css: string, key = "page") {
  const k = `${tabId}:${frameId}:${key}`;
  const previous = appliedCss.get(k);
  if (previous === css) return;
  // Insert the new sheet before removing the old one so there's no flash of the untidied page.
  await chrome.scripting.insertCSS({ target: { tabId, frameIds: [frameId] }, css, origin: "AUTHOR" });
  appliedCss.set(k, css);
  if (previous) await chrome.scripting.removeCSS({ target: { tabId, frameIds: [frameId] }, css: previous, origin: "AUTHOR" }).catch(() => {});
}

async function removeCss(tabId: number, frameId: number, key = "page") {
  const k = `${tabId}:${frameId}:${key}`;
  const previous = appliedCss.get(k);
  appliedCss.delete(k);
  if (previous) await chrome.scripting.removeCSS({ target: { tabId, frameIds: [frameId] }, css: previous, origin: "AUTHOR" }).catch(() => {});
}

followNewTabs();

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const k of [...appliedCss.keys()]) if (k.startsWith(`${tabId}:`)) appliedCss.delete(k);
  clearChat(tabId);
  stopGuide(tabId);
});

// ---------- Dictation ----------

async function ensureRecorder(): Promise<void> {
  const url = chrome.runtime.getURL("offscreen.html");
  const existing = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [url] });
  if (existing.length) return;
  await chrome.offscreen.createDocument({ url, reasons: [chrome.offscreen.Reason.USER_MEDIA], justification: "Record the person's voice when they choose to talk instead of type." });
}

// Built on each call so the words follow the person's current language.
function dictationError(code: string | undefined): string | undefined {
  const messages: Record<string, string> = {
    "not-allowed": t("Prism isn't allowed to use the microphone yet. Turn on “Talking instead of typing” in Prism's settings."),
    "no-microphone": t("Prism couldn't find a microphone on this computer."),
    "too-short": t("Prism didn't hear anything. Try again and speak after pressing Talk."),
    "not-recording": t("Prism wasn't listening."),
  };
  return messages[code ?? ""];
}

async function dictateStart() {
  if (!(await getSettings()).dictation) return { ok: false, error: { code: "forbidden", message: dictationError("not-allowed") } };
  await ensureRecorder();
  const r = await chrome.runtime.sendMessage({ target: "offscreen", type: "rec:start" }) as { ok: boolean; error?: string };
  return r.ok ? { ok: true } : { ok: false, error: { code: "forbidden", message: dictationError(r.error) ?? t("Prism couldn't start listening.") } };
}

async function dictateStop() {
  const r = await chrome.runtime.sendMessage({ target: "offscreen", type: "rec:stop" }).catch(() => null) as { ok: boolean; audio?: string; mime?: string; error?: string } | null;
  chrome.offscreen.closeDocument().catch(() => {});
  if (!r?.ok || !r.audio) return { ok: false, error: { code: "nothing_selected", message: dictationError(r?.error) ?? t("Prism didn't hear anything.") } };
  const settings = await getSettings();
  return callHelper("/v1/transcribe", { audio: r.audio, mime: r.mime, language: settings.translateTo });
}

// ---------- Message router ----------

type Handler = (msg: any, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown;

const handlers: Record<string, Handler> = {
  "content:ready": (_msg, sender) => {
    if (sender.tab?.id !== undefined) { notifyReady(sender.tab.id); guidePageReady(sender.tab.id); }
    return { tabId: sender.tab?.id };
  },
  // Sent at document_start: a new document has none of the previously inserted CSS.
  "css:reset": (_msg, sender) => {
    const prefix = `${sender.tab?.id}:${sender.frameId ?? 0}:`;
    for (const k of [...appliedCss.keys()]) if (k.startsWith(prefix)) appliedCss.delete(k);
    return { ok: true };
  },
  "css:apply": async (msg, sender) => {
    if (sender.tab?.id === undefined) return { ok: false };
    await applyCss(sender.tab.id, sender.frameId ?? 0, msg.css, msg.key);
    return { ok: true };
  },
  "css:remove": async (msg, sender) => {
    if (sender.tab?.id === undefined) return { ok: false };
    await removeCss(sender.tab.id, sender.frameId ?? 0, msg.key);
    return { ok: true };
  },
  api: (msg) => callHelper(msg.path, msg.body),
  // Page code can't read extension files directly, so the service worker hands it the dictionary.
  "i18n:words": async (msg) => {
    if (!/^[a-z]{2}$/.test(String(msg.code))) return {};
    return (await fetch(chrome.runtime.getURL(`locales/${msg.code}.json`)).catch(() => null))?.json().catch(() => ({})) ?? {};
  },
  // Guide me. The popup passes tabId (it isn't a tab); the page's own spotlight is the sender's tab.
  "guide:start": async (msg, sender) => startGuide(msg.tabId ?? sender.tab!.id!, String(msg.goal ?? "")),
  "guide:state": async (msg, sender) => (await loadGuide(msg.tabId ?? sender.tab!.id!)) ?? null,
  "guide:advanced": (msg, sender) => { guideAdvanced(msg.tabId ?? sender.tab!.id!, String(msg.result ?? "")); return { ok: true }; },
  "guide:answer": (msg, sender) => { guideAnswer(msg.tabId ?? sender.tab!.id!, String(msg.answer ?? "")); return { ok: true }; },
  "guide:back": (msg, sender) => { guideBack(msg.tabId ?? sender.tab!.id!); return { ok: true }; },
  "guide:retry": (msg, sender) => { guideRetry(msg.tabId ?? sender.tab!.id!); return { ok: true }; },
  "guide:lost": (msg, sender) => { guideLost(msg.tabId ?? sender.tab!.id!); return { ok: true }; },
  "guide:goback": (msg, sender) => { guideGoBack(msg.tabId ?? sender.tab!.id!); return { ok: true }; },
  "guide:stop": (msg, sender) => stopGuide(msg.tabId ?? sender.tab!.id!).then(() => ({ ok: true })),
  // Read aloud with the computer's own voices (free, offline). One reading at a time across Prism.
  "tts:speak": (msg, sender) => {
    const tabId = sender.tab?.id;
    chrome.tts.stop();
    chrome.tts.speak(String(msg.text ?? "").slice(0, 30000), {
      lang: typeof msg.lang === "string" && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(msg.lang) ? msg.lang : undefined,
      rate: 0.92, // a little slower than normal, easier to follow
      onEvent: (e) => {
        if (["end", "interrupted", "cancelled", "error"].includes(e.type) && tabId !== undefined) {
          chrome.tabs.sendMessage(tabId, { type: "tts:ended", id: msg.id }).catch(() => {});
        }
      },
    });
    return { ok: true };
  },
  "tts:stop": () => { chrome.tts.stop(); return { ok: true }; },
  "dictate:start": () => dictateStart(),
  "dictate:stop": () => dictateStop(),
  health: () => helperHealth(),
  stats: () => ({ ...stats }),
  capture: async (msg: { rect: Rect | null; viewportWidth: number }, sender) => {
    if (!sender.tab) return { ok: false, error: { code: "capture_blocked", message: t("No tab.") } };
    return captureRegion(sender.tab.windowId, msg.rect, msg.viewportWidth);
  },
  "open-options": (msg) => chrome.tabs.create({ url: chrome.runtime.getURL(`options.html${msg.hash ? `#${msg.hash}` : ""}`) }),
  "chat:start": (msg, sender) => startChat(sender.tab!.id!, msg.opts).then(() => ({ ok: true })),
  "chat:send": (msg, sender) => { sendUserMessage(msg.tabId ?? sender.tab!.id!, msg.text, msg.includeScreen); return { ok: true }; },
  "chat:stop": (msg, sender) => stopChat(msg.tabId ?? sender.tab!.id!).then(() => ({ ok: true })),
  "chat:confirm": (msg, sender) => { confirmPending(msg.tabId ?? sender.tab!.id!, msg.approved); return { ok: true }; },
  "chat:clear": (msg, sender) => clearChat(msg.tabId ?? sender.tab!.id!).then(() => ({ ok: true })),
  "chat:session": (msg, sender) => setSessionContext(msg.tabId ?? sender.tab!.id!, msg.text).then(() => ({ ok: true })),
  "chat:state": async (msg, sender) => {
    const state = await loadState(msg.tabId ?? sender.tab!.id!);
    if (!state) return null;
    const { turns: _t, ...rest } = state;
    return rest;
  },
  "ensure-content": (msg) => ensureContent(msg.tabId),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  Promise.resolve(handler(msg, sender))
    .then(sendResponse)
    .catch((err) => {
      console.error("Prism background error", msg?.type, err);
      sendResponse({ ok: false, error: { code: "unknown", message: t("Something went wrong inside Prism.") } });
    });
  return true;
});
