export type StyleId = "clear" | "bold" | "calm" | "soft";
export type ShortcutId = "alt" | "shift-alt" | "ctrl-shift";
export type HelperMode = "hosted" | "local";

export interface Settings {
  styleId: StyleId;
  textScale: 1 | 1.15 | 1.3 | 1.5;
  extraLegible: boolean;
  strongContrast: boolean;
  reduceMotion: "system" | "on";
  underlineLinks: boolean;
  bigTargets: boolean;
  shortcut: ShortcutId;
  explainLevel: "simple" | "normal" | "detailed";
  translateTo: string;
  helperMode: HelperMode;
  localUrl: string;
  tidyEverywhere: boolean;
  /** Talking instead of typing: the microphone was allowed once on Prism's own page. */
  dictation: boolean;
  /** The person picked their language on the first-run screen. */
  languageChosen: boolean;
  onboarded: boolean;
  installId: string;
}

export interface SitePrefs {
  /** "always" re-tidies on every visit; "never" disables Prism's tidy on this site. */
  tidy?: "always" | "never";
  styleId?: StyleId;
  fromScratch?: boolean;
  translateTo?: string;
}

export type FactSource = "typed" | "pasted" | "imported-chatgpt" | "imported-claude" | "chat";

export interface ExtraFact {
  id: string;
  text: string;
  source: FactSource;
  addedAt: number;
}

export interface PersonDetails {
  name: string;
  formOfAddress: string;
  ageRange: string;
  country: string;
  city: string;
  language: string;
  otherLanguages: string;
  readingNeeds: string;
  background: string;
  goals: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  phone: string;
  email: string;
  dateOfBirth: string;
}

export interface Person extends PersonDetails {
  id: string;
  relationship: string;
}

export interface Profile extends PersonDetails {
  people: Person[];
  extraFacts: ExtraFact[];
  updatedAt: number;
}

export type PrismRole =
  | "primary-action" | "secondary-action" | "nav" | "main" | "aside" | "header" | "footer" | "notice"
  | "required-notice" | "form" | "field" | "error" | "step" | "clutter" | "media" | "table" | "heading"
  | "text";

export interface TidyPlan {
  pagePurpose: string;
  primaryTask: string;
  isOfficialSite: boolean;
  roles: { id: string; role: PrismRole }[];
  emphasis: { id: string; level: "primary" | "secondary" | "quiet" }[];
  collapse: { ids: string[]; label: string; reason: string }[];
  protect: string[];
  steps: { id: string; label: string }[];
}

export interface CachedPlan {
  planVersion: number;
  pageKey: string;
  structureHash: string;
  idSignature: string[];
  prefsHash: string;
  plan: TidyPlan;
  createdAt: number;
  lastUsedAt: number;
  hits: number;
}

export interface OutlineElement {
  id: string;
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  box?: [number, number, number, number];
  interactive?: boolean;
  hint?: string;
  field?: { type: string; label: string; required: boolean };
}

export interface Outline {
  title: string;
  url: string;
  lang: string;
  viewport: [number, number];
  elements: OutlineElement[];
}

export interface RegionControl {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options: string[];
  value: string;
  checked?: boolean;
  constraints: string;
  error: string;
}

export interface RegionContext {
  /** Exactly the words inside the selection box. */
  text: string;
  /** The full line(s) around a partial selection, for context only. */
  surrounding: string;
  controls: RegionControl[];
  imageCount: number;
  pageTitle: string;
  pageUrl: string;
  pagePurpose: string;
}

export interface DefineAnswer {
  summary: string;
  explanation: string;
  terms: { term: string; meaning: string }[];
  whatToDoHere: string;
  uncertain: string[];
}

export interface TranslateAnswer {
  sourceLanguage: string;
  targetLanguage: string;
  lines: { source: string; translation: string; unclear: boolean; note: string }[];
}

export interface FieldSuggestion {
  id: string;
  explanation: string;
  hasSuggestion: boolean;
  value: string;
  optionValues: string[];
  checked: boolean;
  source: "profile" | "session" | "page" | "inference" | "none";
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface FillAnswer {
  overview: string;
  fields: FieldSuggestion[];
  questions: { fieldId: string; question: string }[];
}

export type AssistAction = "define" | "translate" | "fill";

export interface ChatAction {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatTurn {
  role: "user" | "model" | "tool";
  text?: string;
  image?: string;
  raw?: unknown;
  results?: { id: string; name: string; response: Record<string, unknown> }[];
}

export interface ChatReply {
  text: string;
  actions: ChatAction[];
  raw: unknown;
  model: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Result envelope used across extension messaging so failures are explicit, never swallowed. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: PrismError };

export interface PrismError {
  code:
    | "offline" | "helper_unreachable" | "rate_limited" | "ai_unavailable" | "invalid_response" | "forbidden"
    | "capture_blocked" | "restricted_page" | "nothing_selected" | "bad_request" | "unknown";
  message: string;
}
