/**
 * Guide me: walks the person through a task one step at a time. The helper picks the next thing to point
 * at; the page shows a spotlight on it; the PERSON clicks or types, and their action moves the guide on.
 * State lives in storage.session per tab so a guide survives page changes.
 */
import { t } from "../shared/i18n";
import { getProfile, getSettings, profileText } from "../shared/storage";
import type { Result } from "../shared/types";
import { callHelper } from "./api";

export interface GuideStep {
  kind: "click" | "type" | "choose" | "read" | "go" | "ask" | "done" | "stuck";
  id: string;
  instruction: string;
  detail: string;
  url: string;
  choices: string[];
  caution: boolean;
}

export interface GuideState {
  tabId: number;
  goal: string;
  status: "thinking" | "showing" | "asking" | "done" | "stuck" | "stopped";
  step?: GuideStep;
  /** Steps shown so far (for Back) with the page each was on. */
  shown: { step: GuideStep; url: string }[];
  history: { instruction: string; result: string }[];
  answers: string[];
  error?: string;
}

const key = (tabId: number) => `guide:${tabId}`;
const MAX_STEPS = 40;

export async function loadGuide(tabId: number): Promise<GuideState | undefined> {
  return (await chrome.storage.session.get(key(tabId)))[key(tabId)] as GuideState | undefined;
}

async function save(state: GuideState): Promise<void> {
  await chrome.storage.session.set({ [key(state.tabId)]: state });
  // Every open view of this guide (the page's spotlight, the popup) redraws from the latest state.
  chrome.tabs.sendMessage(state.tabId, { type: "guide:update", state }).catch(() => {});
  chrome.runtime.sendMessage({ type: "guide:update", state }).catch(() => {});
}

async function toTab<T>(tabId: number, message: unknown): Promise<T | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch {
    return undefined;
  }
}

// ---------- page readiness (a new page's Prism announces itself) ----------

const readyWaiters = new Map<number, () => void>();

export function guidePageReady(tabId: number): void {
  readyWaiters.get(tabId)?.();
  readyWaiters.delete(tabId);
  // A page that loads mid-guide (the person's click opened it) continues the guide there.
  loadGuide(tabId).then(async (state) => {
    // A finished guide doesn't follow the person onto the next page.
    if (state?.status === "done") { await chrome.storage.session.remove(key(tabId)); return; }
    if (!state || (state.status !== "showing" && state.status !== "thinking")) return;
    if (state.status === "showing") {
      state.history.push({ instruction: state.step?.instruction ?? "", result: "a new page opened" });
      state.status = "thinking";
      await save(state);
    }
    nextStep(tabId);
  });
}

function waitForPage(tabId: number, ms = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { readyWaiters.delete(tabId); resolve(false); }, ms);
    readyWaiters.set(tabId, () => { clearTimeout(timer); resolve(true); });
  });
}

// ---------- the loop ----------

const inFlight = new Set<number>();
/** Something happened (a new page, the person's action) while a step was being planned: plan again. */
const rerun = new Set<number>();

async function nextStep(tabId: number): Promise<void> {
  if (inFlight.has(tabId)) { rerun.add(tabId); return; }
  inFlight.add(tabId);
  try {
    do {
      rerun.delete(tabId);
      await planStep(tabId);
    } while (rerun.has(tabId));
  } finally {
    inFlight.delete(tabId);
  }
}

async function planStep(tabId: number): Promise<void> {
  let state = await loadGuide(tabId);
  if (!state || state.status === "stopped") return;
  if (state.history.length >= MAX_STEPS) {
    state.status = "stuck";
    state.step = { kind: "stuck", id: "", instruction: t("That's a lot of steps. Let's stop here and try Chat."), detail: "", url: "", choices: [], caution: false };
    await save(state);
    return;
  }
  state.status = "thinking";
  state.error = undefined;
  await save(state);
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  const onWebPage = !!tab?.url && /^https?:/.test(tab.url);
  let page = onWebPage ? await toTab<{ text: string }>(tabId, { type: "chat:observe" }) : undefined;
  // A page still loading (a portal that draws itself with scripts) shows almost nothing yet: give it time.
  for (let wait = 0; onWebPage && wait < 4 && (page?.text.match(/\n\[p/g)?.length ?? 0) < 4; wait++) {
    await new Promise((r) => setTimeout(r, 1500));
    page = await toTab<{ text: string }>(tabId, { type: "chat:observe" });
  }
  const settings = await getSettings();
  const profile = await getProfile();
  const reply = (await callHelper("/v1/guide", {
    goal: state.goal,
    pageState: page?.text ?? "",
    history: state.history.slice(-20),
    answers: state.answers,
    profile: profileText(profile, "chat"),
    language: settings.translateTo || "English",
  })) as Result<GuideStep>;
  // Work from the latest state: the person may have stopped, acted, or moved to a new page meanwhile.
  state = await loadGuide(tabId);
  if (!state || state.status === "stopped" || rerun.has(tabId)) return;
  if (!reply.ok) {
    state.status = "stuck";
    state.error = reply.error.message;
    state.step = undefined;
    await save(state);
    return;
  }
  const step = reply.value;
  state.step = step;
  if (step.kind === "go") {
    state.history.push({ instruction: step.instruction, result: `opened ${step.url}` });
    state.status = "thinking";
    await save(state);
    const ready = waitForPage(tabId);
    await chrome.tabs.update(tabId, { url: step.url });
    if (!(await ready)) {
      state.status = "stuck";
      state.step = { kind: "stuck", id: "", instruction: t("That website didn't open. Check your internet connection and try again."), detail: "", url: "", choices: [], caution: false };
      await save(state);
    }
    // guidePageReady asks for a rerun, which plans the first step on the new page.
    return;
  }
  if (step.kind === "ask") state.status = "asking";
  else if (step.kind === "done") state.status = "done";
  else if (step.kind === "stuck") state.status = "stuck";
  else {
    state.status = "showing";
    state.shown.push({ step, url: tab?.url ?? "" });
  }
  await save(state);
}

export async function startGuide(tabId: number, goal: string): Promise<GuideState> {
  const state: GuideState = { tabId, goal: goal.trim().slice(0, 400), status: "thinking", shown: [], history: [], answers: [] };
  await save(state);
  nextStep(tabId);
  return state;
}

/** The person did what the step asked (clicked, typed, chose, read). */
export async function guideAdvanced(tabId: number, result: string): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state || state.status !== "showing") return;
  state.history.push({ instruction: state.step?.instruction ?? "", result: result.slice(0, 200) });
  state.status = "thinking";
  await save(state);
  await nextStep(tabId);
}

export async function guideAnswer(tabId: number, answer: string): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state || state.status !== "asking") return;
  state.answers.push(answer.slice(0, 200));
  state.history.push({ instruction: state.step?.instruction ?? "", result: `answered: ${answer.slice(0, 120)}` });
  state.status = "thinking";
  await save(state);
  await nextStep(tabId);
}

const LOST = "that wasn't showing on the page (it may appear only after choosing something first, like a size, colour or price option)";

/** The page no longer has the step's element (it changed or redrew itself): plan again, once. */
export async function guideLost(tabId: number): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state || state.status !== "showing") return;
  if (state.history[state.history.length - 1]?.result === LOST) {
    state.status = "stuck";
    state.step = { kind: "stuck", id: "", instruction: t("I can't find that on the page any more. Press Try again, or scroll and look for it."), detail: "", url: "", choices: [], caution: false };
    await save(state);
    return;
  }
  state.history.push({ instruction: state.step?.instruction ?? "", result: LOST });
  state.status = "thinking";
  await save(state);
  await nextStep(tabId);
}

/** Show the previous step again (going back a page first if it was on another page). */
export async function guideBack(tabId: number): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state || state.shown.length < 2) return;
  state.shown.pop();
  const prev = state.shown[state.shown.length - 1];
  state.history.push({ instruction: "", result: "the person went back a step" });
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  state.step = prev.step;
  state.status = "showing";
  if (tab?.url && prev.url && tab.url !== prev.url) {
    // The earlier step was on the previous page: go back there; the new page re-plans from its state.
    state.status = "thinking";
    await save(state);
    await chrome.tabs.goBack(tabId).catch(() => {});
    return;
  }
  await save(state);
}

/** Stuck on a page that failed or blocked Prism: go back to the previous page and plan from there. */
export async function guideGoBack(tabId: number): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state) return;
  state.history.push({ instruction: state.step?.instruction ?? "", result: "that page didn't work, so the person went back" });
  state.status = "thinking";
  state.step = undefined;
  await save(state);
  try {
    await chrome.tabs.goBack(tabId); // the previous page announces itself and the guide plans from there
  } catch {
    await nextStep(tabId); // nothing to go back to: plan again from here
  }
}

export async function stopGuide(tabId: number): Promise<void> {
  const state = await loadGuide(tabId);
  if (!state) return;
  state.status = "stopped";
  await save(state);
  await chrome.storage.session.remove(key(tabId));
}

/** Try the same step again (after an error). */
export async function guideRetry(tabId: number): Promise<void> {
  if (await loadGuide(tabId)) await nextStep(tabId);
}

/**
 * A click in the guided tab that opens a new tab (target=_blank links, sign-in windows) takes the guide
 * with it: the person keeps following the spotlight where the page actually went.
 */
export function followNewTabs(): void {
  chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.id === undefined || tab.openerTabId === undefined) return;
    const state = await loadGuide(tab.openerTabId);
    if (!state || state.status !== "showing") return;
    await chrome.storage.session.remove(key(tab.openerTabId));
    chrome.tabs.sendMessage(tab.openerTabId, { type: "guide:update", state: { ...state, status: "stopped" } }).catch(() => {});
    state.history.push({ instruction: state.step?.instruction ?? "", result: "it opened in a new tab" });
    state.tabId = tab.id;
    state.status = "thinking";
    await chrome.storage.session.set({ [key(tab.id)]: state });
    // The new tab's Prism announces itself when ready (guidePageReady), which continues the guide.
  });
}
