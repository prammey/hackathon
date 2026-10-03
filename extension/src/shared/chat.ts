import type { ChatAction, ChatTurn } from "./types";

export type ChatStatus =
  | "idle" | "thinking" | "acting" | "waiting-confirm" | "waiting-user" | "done" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  kind: "user" | "prism" | "action" | "notice" | "question" | "confirm" | "error";
  text: string;
  detail?: string;
  at: number;
}

export interface PendingAction {
  action: ChatAction;
  description: string;
}

export interface ChatState {
  tabId: number;
  status: ChatStatus;
  messages: ChatMessage[];
  turns: ChatTurn[];
  steps: number;
  failures: number;
  startedAt: number;
  sessionContext: string;
  includeScreen: boolean;
  regionLabel: string;
  pending?: PendingAction;
  pendingQueue: ChatAction[];
}

export const MAX_STEPS = 20;
export const MAX_MS = 10 * 60 * 1000;

export type ActionRisk = "routine" | "consequential" | "forbidden";

export interface ActionCheck {
  ok: boolean;
  risk: ActionRisk;
  description: string;
  reason?: string;
}

export interface ActionOutcome {
  ok: boolean;
  message: string;
  navigating?: boolean;
  url?: string;
}

export function newMessage(kind: ChatMessage["kind"], text: string, detail?: string): ChatMessage {
  return { id: Math.random().toString(36).slice(2, 10), kind, text, detail, at: Date.now() };
}
