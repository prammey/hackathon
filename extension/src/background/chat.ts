/**
 * The bounded chat/action loop. Lives in the service worker so it survives page navigations.
 * The model proposes one action at a time; the content script validates and classifies it;
 * consequential actions wait for the person's explicit confirmation.
 */
import {
  type ActionCheck, type ActionOutcome, type ChatState, MAX_MS, MAX_STEPS, newMessage,
} from "../shared/chat";
import { getProfile, getSettings, profileText } from "../shared/storage";
import type { ChatAction, ChatReply, ChatTurn } from "../shared/types";
import { callHelper } from "./api";
import { captureRegion } from "./capture";

const states = new Map<number, ChatState>();
const aborters = new Map<number, AbortController>();
const readyWaiters = new Map<number, () => void>();

const key = (tabId: number) => `chat:${tabId}`;

export async function loadState(tabId: number): Promise<ChatState | undefined> {
  if (states.has(tabId)) return states.get(tabId);
  const stored = await chrome.storage.session.get(key(tabId));
  const state = stored[key(tabId)] as ChatState | undefined;
  if (state) states.set(tabId, state);
  return state;
}

async function save(state: ChatState): Promise<void> {
  states.set(state.tabId, state);
  // Images are large; keep them out of session storage except the newest user turn.
  const slim = { ...state, turns: state.turns.map((t, i) => (i < state.turns.length - 1 ? { ...t, image: undefined } : t)) };
  await chrome.storage.session.set({ [key(state.tabId)]: slim });
  chrome.tabs.sendMessage(state.tabId, { type: "chat:update", state: publicState(state) }).catch(() => {});
}

function publicState(state: ChatState) {
  const { turns: _turns, ...rest } = state;
  return rest;
}

export function notifyReady(tabId: number): void {
  readyWaiters.get(tabId)?.();
  readyWaiters.delete(tabId);
  const state = states.get(tabId);
  if (state) chrome.tabs.sendMessage(tabId, { type: "chat:update", state: publicState(state) }).catch(() => {});
}

function waitForReady(tabId: number, ms = 15000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { readyWaiters.delete(tabId); resolve(false); }, ms);
    readyWaiters.set(tabId, () => { clearTimeout(timer); resolve(true); });
  });
}

async function toTab<T>(tabId: number, message: unknown): Promise<T | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch {
    return undefined;
  }
}

export async function startChat(tabId: number, opts: {
  regionLabel: string; regionText: string; image?: string; includeScreen?: boolean; question?: string;
}): Promise<ChatState> {
  const existing = await loadState(tabId);
  const state: ChatState = existing && !["done", "stopped", "error", "idle"].includes(existing.status)
    ? existing
    : {
        tabId, status: "idle", messages: [], turns: [], steps: 0, failures: 0, startedAt: Date.now(),
        sessionContext: existing?.sessionContext ?? "", includeScreen: !!opts.includeScreen,
        regionLabel: opts.regionLabel, pendingQueue: [],
      };
  state.regionLabel = opts.regionLabel;
  if (opts.regionText || opts.image) {
    state.messages.push(newMessage("notice", `Attached: ${opts.regionLabel}`));
    state.turns.push({
      role: "user",
      text: `The person selected this part of the page to talk about:\n${opts.regionText || "(see picture)"}`,
      image: opts.image,
    });
    // A model turn is needed between user turns; a short acknowledgement keeps the history valid.
    state.turns.push({ role: "model", raw: { role: "model", parts: [{ text: "I can see the selected area." }] } });
  }
  await save(state);
  if (opts.question) await sendUserMessage(tabId, opts.question);
  return state;
}

export async function setSessionContext(tabId: number, text: string): Promise<void> {
  const state = (await loadState(tabId)) ?? (await startChat(tabId, { regionLabel: "This page", regionText: "" }));
  state.sessionContext = text.slice(0, 2500);
  state.messages.push(newMessage("notice", text
    ? "Using these details just for now. Your saved profile is unchanged."
    : "Back to using your saved profile."));
  await save(state);
}

export async function sendUserMessage(tabId: number, text: string, includeScreen?: boolean): Promise<void> {
  const state = (await loadState(tabId)) ?? (await startChat(tabId, { regionLabel: "This page", regionText: "" }));
  if (includeScreen !== undefined) state.includeScreen = includeScreen;
  if (state.status === "waiting-user") state.status = "idle";
  // "I'm helping my mum…" — keep it as session context, never as a silent profile edit.
  const helping = text.match(/\b(i'?m|i am)\s+(helping|filling (this|it) (in|out) for|doing this for)\s+(.{2,120})/i);
  if (helping && !state.sessionContext) {
    state.sessionContext = `The person is helping someone else: ${helping[4]}. Details they mention in this chat are about that person.`;
    state.messages.push(newMessage("notice", "Got it — I'll treat details in this chat as being about the person you're helping. Your saved profile won't change."));
  }
  state.messages.push(newMessage("user", text));
  let image: string | undefined;
  if (state.includeScreen) {
    const tab = await chrome.tabs.get(tabId);
    const viewport = await toTab<{ width: number }>(tabId, { type: "prism:viewport" });
    await toTab(tabId, { type: "prism:hide-ui" });
    const shot = await captureRegion(tab.windowId, null, viewport?.width ?? 1280, 1400);
    await toTab(tabId, { type: "prism:show-ui" });
    if (shot.ok) image = shot.value.image;
  }
  if (state.turns.length && state.turns[state.turns.length - 1].role === "user") {
    state.turns.push({ role: "model", raw: { role: "model", parts: [{ text: "OK." }] } });
  }
  state.turns.push({ role: "user", text, image });
  state.startedAt = state.status === "idle" || state.status === "done" ? Date.now() : state.startedAt;
  state.steps = 0;
  state.failures = 0;
  await runLoop(state);
}

export async function stopChat(tabId: number): Promise<void> {
  const state = await loadState(tabId);
  aborters.get(tabId)?.abort();
  if (!state) return;
  state.status = "stopped";
  state.pending = undefined;
  state.pendingQueue = [];
  state.messages.push(newMessage("notice", "Stopped. Nothing else will be done."));
  // The model turn that asked for actions needs matching responses before the next message.
  closeOpenCalls(state, "The person stopped Prism.");
  await save(state);
}

export async function clearChat(tabId: number): Promise<void> {
  aborters.get(tabId)?.abort();
  states.delete(tabId);
  await chrome.storage.session.remove(key(tabId));
}

export async function confirmPending(tabId: number, approved: boolean): Promise<void> {
  const state = await loadState(tabId);
  if (!state?.pending) return;
  const { action, description } = state.pending;
  state.pending = undefined;
  if (!approved) {
    state.messages.push(newMessage("notice", `OK, I didn't do that: ${description}`));
    state.pendingQueue = [];
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: false, message: "The person said no. Do not try again; ask what they want instead." } }]);
    state.status = "idle";
    await save(state);
    await runLoop(state);
    return;
  }
  state.status = "acting";
  await save(state);
  const outcome = await execute(state, action, description);
  addToolResults(state, [{ id: action.id, name: action.name, response: outcomeResponse(outcome) }]);
  await runLoop(state);
}

function outcomeResponse(outcome: ActionOutcome): Record<string, unknown> {
  return { ok: outcome.ok, message: outcome.message, ...(outcome.url ? { url: outcome.url } : {}) };
}

function addToolResults(state: ChatState, results: { id: string; name: string; response: Record<string, unknown> }[]) {
  const last = state.turns[state.turns.length - 1];
  if (last?.role === "tool") last.results = [...(last.results ?? []), ...results];
  else state.turns.push({ role: "tool", results });
}

function closeOpenCalls(state: ChatState, message: string) {
  const lastModel = [...state.turns].reverse().find((t) => t.role === "model");
  const raw = lastModel?.raw as { parts?: { function_call?: { id?: string; name?: string } }[] } | undefined;
  const calls = raw?.parts?.filter((p) => p.function_call).map((p) => p.function_call!) ?? [];
  const last = state.turns[state.turns.length - 1];
  if (calls.length && last?.role === "model") {
    state.turns.push({
      role: "tool",
      results: calls.map((c) => ({ id: c.id ?? "", name: c.name ?? "", response: { ok: false, message } })),
    });
  } else if (calls.length && last?.role === "tool") {
    const answered = new Set((last.results ?? []).map((r) => r.id));
    for (const c of calls) if (!answered.has(c.id ?? "")) last.results!.push({ id: c.id ?? "", name: c.name ?? "", response: { ok: false, message } });
  }
}

async function execute(state: ChatState, action: ChatAction, description: string): Promise<ActionOutcome> {
  state.steps++;
  state.messages.push(newMessage("action", description));
  await save(state);
  const outcome = await toTab<ActionOutcome>(state.tabId, { type: "chat:exec", action });
  if (!outcome) {
    // The page went away mid-action (navigation). Wait for the new page.
    const ready = await waitForReady(state.tabId);
    return ready
      ? { ok: true, message: "The page changed (navigated to a new page)." }
      : { ok: false, message: "The page stopped responding." };
  }
  if (outcome.navigating) {
    const ready = await waitForReady(state.tabId);
    if (!ready) return { ok: false, message: "The new page didn't finish loading, or Prism can't work on it." };
  }
  if (!outcome.ok) state.failures++;
  return outcome;
}

async function runLoop(state: ChatState): Promise<void> {
  const settings = await getSettings();
  const profile = await getProfile();
  const aborter = new AbortController();
  aborters.get(state.tabId)?.abort();
  aborters.set(state.tabId, aborter);

  while (true) {
    if (aborter.signal.aborted) return;
    if (state.steps >= MAX_STEPS || Date.now() - state.startedAt > MAX_MS || state.failures >= 3) {
      closeOpenCalls(state, "Limit reached.");
      state.status = "done";
      state.messages.push(newMessage("notice", state.failures >= 3
        ? "I stopped because several steps didn't work. You can tell me what to try next."
        : "I stopped because this is taking many steps. Tell me if you'd like me to continue."));
      await save(state);
      return;
    }

    // Execute queued actions from the previous model turn first.
    const queued = state.pendingQueue.shift();
    if (queued) {
      const done = await handleAction(state, queued);
      if (!done) return; // paused for confirmation / question / finish
      continue;
    }

    const last = state.turns[state.turns.length - 1];
    if (!last || last.role === "model") {
      state.status = state.status === "acting" || state.status === "thinking" ? "idle" : state.status;
      await save(state);
      return;
    }

    state.status = "thinking";
    await save(state);
    const pageState = await toTab<{ text: string }>(state.tabId, { type: "chat:observe" });
    const reply = await callHelper<ChatReply>("/v1/chat", {
      turns: state.turns.slice(-60),
      pageState: pageState?.text ?? "(Prism can't read this page.)",
      profile: profileText(profile, "chat"),
      sessionContext: state.sessionContext,
      language: settings.translateTo || "English",
      allowActions: true,
    } satisfies { turns: ChatTurn[] } & Record<string, unknown>, aborter.signal);
    if (aborter.signal.aborted) return;
    if (!reply.ok) {
      state.status = "error";
      state.messages.push(newMessage("error", reply.error.message));
      await save(state);
      return;
    }
    state.turns.push({ role: "model", raw: reply.value.raw });
    if (reply.value.text) state.messages.push(newMessage("prism", reply.value.text));
    if (!reply.value.actions.length) {
      state.status = "idle";
      await save(state);
      return;
    }
    state.pendingQueue = reply.value.actions.slice(0, 4);
    state.status = "acting";
    await save(state);
  }
}

/** Returns false when the loop must pause (confirmation, question, finish, forbidden). */
async function handleAction(state: ChatState, action: ChatAction): Promise<boolean> {
  if (action.name === "finish") {
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: true } }]);
    state.messages.push(newMessage("prism", String(action.args.summary ?? "Done.")));
    closeOpenCalls(state, "Skipped because the task finished.");
    state.pendingQueue = [];
    state.status = "done";
    // Keep the history valid for a follow-up message.
    state.turns.push({ role: "model", raw: { role: "model", parts: [{ text: String(action.args.summary ?? "Done.") }] } });
    await save(state);
    return false;
  }
  if (action.name === "ask_user") {
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: true, message: "Question shown to the person; their reply will follow." } }]);
    closeOpenCalls(state, "Waiting for the person's answer.");
    state.messages.push(newMessage("question", String(action.args.question ?? "Could you tell me more?")));
    state.pendingQueue = [];
    state.turns.push({ role: "model", raw: { role: "model", parts: [{ text: String(action.args.question ?? "") }] } });
    state.status = "waiting-user";
    await save(state);
    return false;
  }
  if (action.name === "read_page") {
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: true, message: "Fresh page state is attached." } }]);
    return true;
  }
  const check = await toTab<ActionCheck>(state.tabId, { type: "chat:check", action });
  if (!check) {
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: false, message: "Prism can't work on this page." } }]);
    state.failures++;
    return true;
  }
  if (!check.ok || check.risk === "forbidden") {
    state.messages.push(newMessage("notice", check.reason ?? `I can't do that: ${check.description}`));
    addToolResults(state, [{ id: action.id, name: action.name, response: { ok: false, message: check.reason ?? "Not allowed." } }]);
    state.failures++;
    return true;
  }
  if (check.risk === "consequential") {
    state.pending = { action, description: check.description };
    state.messages.push(newMessage("confirm", check.description));
    state.status = "waiting-confirm";
    await save(state);
    return false;
  }
  const outcome = await execute(state, action, check.description);
  addToolResults(state, [{ id: action.id, name: action.name, response: outcomeResponse(outcome) }]);
  await save(state);
  return true;
}
