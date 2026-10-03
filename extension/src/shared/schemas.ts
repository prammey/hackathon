/** Client-side validation of everything that comes back from the helper (defence in depth). */
import { z } from "zod";

const ROLES = [
  "primary-action", "secondary-action", "nav", "main", "aside", "header", "footer", "notice",
  "required-notice", "form", "field", "error", "step", "clutter", "media", "table", "heading", "text",
] as const;

const id = z.string().max(24).regex(/^p[0-9a-z]+$/);

export const TidyPlanSchema = z.object({
  pagePurpose: z.string().max(200),
  primaryTask: z.string().max(200),
  isOfficialSite: z.boolean(),
  roles: z.array(z.object({ id, role: z.enum(ROLES) })).max(400),
  emphasis: z.array(z.object({ id, level: z.enum(["primary", "secondary", "quiet"]) })).max(40),
  collapse: z
    .array(z.object({ ids: z.array(id).max(60), label: z.string().max(60), reason: z.string().max(30) }))
    .max(12),
  protect: z.array(id).max(200),
  steps: z.array(z.object({ id, label: z.string().max(80) })).max(12),
});

export const DefineAnswerSchema = z.object({
  summary: z.string().max(1200),
  explanation: z.string().max(4000),
  terms: z.array(z.object({ term: z.string().max(200), meaning: z.string().max(800) })).max(12),
  whatToDoHere: z.string().max(1200),
  uncertain: z.array(z.string().max(400)).max(12),
});

export const TranslateAnswerSchema = z.object({
  sourceLanguage: z.string().max(60),
  targetLanguage: z.string().max(60),
  lines: z
    .array(z.object({
      source: z.string().max(4000), translation: z.string().max(4000), unclear: z.boolean(), note: z.string().max(800),
    }))
    .max(200),
});

export const FillAnswerSchema = z.object({
  overview: z.string().max(800),
  fields: z
    .array(z.object({
      id: z.string().max(24),
      explanation: z.string().max(1200),
      hasSuggestion: z.boolean(),
      value: z.string().max(600),
      optionValues: z.array(z.string().max(300)).max(60),
      checked: z.boolean(),
      source: z.enum(["profile", "session", "page", "inference", "none"]),
      evidence: z.string().max(600),
      confidence: z.enum(["high", "medium", "low"]),
    }))
    .max(80),
  questions: z.array(z.object({ fieldId: z.string().max(24), question: z.string().max(600) })).max(40),
});

export const ChatReplySchema = z.object({
  text: z.string().max(20000),
  actions: z.array(z.object({ id: z.string().max(80), name: z.string().max(40), args: z.record(z.string(), z.unknown()) })).max(8),
  raw: z.unknown(),
  model: z.string().max(80),
});

export const ProfileCandidatesSchema = z.object({
  facts: z.array(z.object({ field: z.string().max(40), value: z.string().max(600), evidence: z.string().max(800) })).max(40),
});
