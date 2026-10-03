/** Calls to the Prism helper. Every response is validated before it reaches page code. */
import type { ZodType } from "zod";
import {
  ChatReplySchema, DefineAnswerSchema, FillAnswerSchema, ProfileCandidatesSchema, TidyPlanSchema,
  TranslateAnswerSchema,
} from "../shared/schemas";
import { getSettings } from "../shared/storage";
import type { PrismError, Result } from "../shared/types";
import { z } from "zod";

const TIMEOUT_MS = 45_000;

export async function helperBase(): Promise<string> {
  const settings = await getSettings();
  if (settings.helperMode === "hosted" && __PRISM_HOSTED_URL__) return __PRISM_HOSTED_URL__;
  return settings.localUrl.replace(/\/$/, "");
}

const SCHEMAS: Record<string, ZodType> = {
  "/v1/plan": z.object({ plan: TidyPlanSchema, model: z.string() }),
  "/v1/chat": ChatReplySchema,
  "/v1/import/extract": ProfileCandidatesSchema.extend({ model: z.string() }),
};

function assistSchema(action: string): ZodType {
  const answer = action === "define" ? DefineAnswerSchema : action === "translate" ? TranslateAnswerSchema : FillAnswerSchema;
  return z.object({ answer, model: z.string() });
}

export const stats = { calls: 0, byPath: {} as Record<string, number> };

export async function callHelper<T>(path: string, body: unknown, signal?: AbortSignal): Promise<Result<T>> {
  const settings = await getSettings();
  const base = await helperBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort("cancelled"));
  stats.calls++;
  stats.byPath[path] = (stats.byPath[path] ?? 0) + 1;
  try {
    const resp = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Prism-Install": settings.installId },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: httpError(resp.status, data) };
    const schema = path === "/v1/assist" ? assistSchema((body as { action: string }).action) : SCHEMAS[path];
    const parsed = schema ? schema.safeParse(data) : { success: true as const, data };
    if (!parsed.success) {
      console.warn("Prism: invalid helper response", path, parsed.error?.issues?.slice(0, 3));
      return { ok: false, error: { code: "invalid_response", message: "Prism got an answer it couldn't use. Please try again." } };
    }
    return { ok: true, value: parsed.data as T };
  } catch (err) {
    const reason = controller.signal.reason;
    if (reason === "cancelled") return { ok: false, error: { code: "unknown", message: "Stopped." } };
    if (reason === "timeout") return { ok: false, error: { code: "ai_unavailable", message: "Prism's AI took too long to answer. Please try again." } };
    if (!navigator.onLine) return { ok: false, error: { code: "offline", message: "You seem to be offline. Check your internet connection." } };
    return {
      ok: false,
      error: {
        code: "helper_unreachable",
        message: settings.helperMode === "local"
          ? "Prism can't reach its helper on this computer. Start it, or switch to the online service in Settings."
          : "Prism can't reach its online service right now. Please try again in a moment.",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function httpError(status: number, data: { message?: string; detail?: string }): PrismError {
  if (status === 429) return { code: "rate_limited", message: data.message ?? "Prism is busy. Please wait a minute and try again." };
  if (status === 403) return { code: "forbidden", message: "Prism's service refused the request." };
  if (status === 503) return { code: "ai_unavailable", message: data.message ?? "Prism's AI is not answering right now. Please try again." };
  if (status === 422) return { code: "bad_request", message: typeof data.detail === "string" ? data.detail : "Prism couldn't use that selection." };
  return { code: "unknown", message: `Something went wrong (error ${status}). Please try again.` };
}

export async function helperHealth(): Promise<{ ok: boolean; mode?: string; model?: string; base: string }> {
  const base = await helperBase();
  try {
    const resp = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    return { ok: resp.ok, mode: data.mode, model: data.model, base };
  } catch {
    return { ok: false, base };
  }
}
