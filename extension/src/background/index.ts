/** Prism service worker: routing, helper calls, page CSS, capture, shortcuts, chat loop. */
import { getSettings, saveSettings } from "../shared/storage";
import type { Rect } from "../shared/types";
import { callHelper, helperHealth, stats } from "./api";
import { captureRegion } from "./capture";
import {
  clearChat, confirmPending, loadState, notifyReady, sendUserMessage, setSessionContext, startChat, stopChat,
} from "./chat";

// ---------- Install / startup ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();
  if (!settings.installId) await saveSettings({ installId: crypto.randomUUID() });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "prism-ask", title: "Ask Prism about this", contexts: ["selection", "image", "link", "page"],
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

async function applyCss(tabId: number, frameId: number, css: string) {
  const k = `${tabId}:${frameId}`;
  const previous = appliedCss.get(k);
  if (previous === css) return;
  // Insert the new sheet before removing the old one so there's no flash of the untidied page.
  await chrome.scripting.insertCSS({ target: { tabId, frameIds: [frameId] }, css, origin: "AUTHOR" });
  appliedCss.set(k, css);
  if (previous) await chrome.scripting.removeCSS({ target: { tabId, frameIds: [frameId] }, css: previous, origin: "AUTHOR" }).catch(() => {});
}

async function removeCss(tabId: number, frameId: number) {
  const k = `${tabId}:${frameId}`;
  const previous = appliedCss.get(k);
  appliedCss.delete(k);
  if (previous) await chrome.scripting.removeCSS({ target: { tabId, frameIds: [frameId] }, css: previous, origin: "AUTHOR" }).catch(() => {});
}

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const k of [...appliedCss.keys()]) if (k.startsWith(`${tabId}:`)) appliedCss.delete(k);
  clearChat(tabId);
});

// ---------- Message router ----------

type Handler = (msg: any, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown;

const handlers: Record<string, Handler> = {
  "content:ready": (_msg, sender) => {
    if (sender.tab?.id !== undefined) notifyReady(sender.tab.id);
    return { tabId: sender.tab?.id };
  },
  // Sent at document_start: a new document has none of the previously inserted CSS.
  "css:reset": (_msg, sender) => {
    if (sender.tab?.id !== undefined) appliedCss.delete(`${sender.tab.id}:${sender.frameId ?? 0}`);
    return { ok: true };
  },
  "css:apply": async (msg, sender) => {
    if (sender.tab?.id === undefined) return { ok: false };
    await applyCss(sender.tab.id, sender.frameId ?? 0, msg.css);
    return { ok: true };
  },
  "css:remove": async (_msg, sender) => {
    if (sender.tab?.id === undefined) return { ok: false };
    await removeCss(sender.tab.id, sender.frameId ?? 0);
    return { ok: true };
  },
  api: (msg) => callHelper(msg.path, msg.body),
  health: () => helperHealth(),
  stats: () => ({ ...stats }),
  capture: async (msg: { rect: Rect | null; viewportWidth: number }, sender) => {
    if (!sender.tab) return { ok: false, error: { code: "capture_blocked", message: "No tab." } };
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
      sendResponse({ ok: false, error: { code: "unknown", message: "Something went wrong inside Prism." } });
    });
  return true;
});
