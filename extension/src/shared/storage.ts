import type { CachedPlan, Person, Profile, Settings, SitePrefs } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  styleId: "clear",
  textScale: 1,
  extraLegible: false,
  strongContrast: false,
  reduceMotion: "system",
  underlineLinks: true,
  bigTargets: false,
  shortcut: "alt",
  explainLevel: "simple",
  translateTo: "English",
  helperMode: __PRISM_HOSTED_URL__ && !__PRISM_TEST__ ? "hosted" : "local",
  localUrl: "http://127.0.0.1:8787",
  tidyEverywhere: false,
  dictation: false,
  onboarded: false,
  installId: "",
};

export const EMPTY_PROFILE: Profile = {
  name: "", formOfAddress: "", ageRange: "", country: "", city: "", language: "", otherLanguages: "",
  readingNeeds: "", background: "", goals: "", addressLine1: "", addressLine2: "", postcode: "", phone: "",
  email: "", dateOfBirth: "", people: [], extraFacts: [], updatedAt: 0,
};

/** Bump when the tidy engine or plan schema changes so stale cached plans are ignored. */
export const PLAN_VERSION = 3;
const PLAN_CACHE_LIMIT = 500;

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getSitePrefs(origin: string): Promise<SitePrefs> {
  const key = `site:${origin}`;
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as SitePrefs) ?? {};
}

export async function saveSitePrefs(origin: string, patch: Partial<SitePrefs>): Promise<SitePrefs> {
  const key = `site:${origin}`;
  const next = { ...(await getSitePrefs(origin)), ...patch };
  for (const k of Object.keys(next) as (keyof SitePrefs)[]) if (next[k] === undefined) delete next[k];
  await chrome.storage.local.set({ [key]: next });
  return next;
}

export async function listSitePrefs(): Promise<[string, SitePrefs][]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith("site:"))
    .map(([k, v]) => [k.slice(5), v as SitePrefs]);
}

export async function getProfile(): Promise<Profile> {
  const { profile } = await chrome.storage.local.get("profile");
  return { ...EMPTY_PROFILE, ...(profile ?? {}) };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({ profile: { ...profile, updatedAt: Date.now() } });
}

// ---------- Plan cache (LRU by lastUsedAt) ----------

export async function getCachedPlan(pageKey: string): Promise<CachedPlan | undefined> {
  const key = `plan:${pageKey}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] as CachedPlan | undefined;
}

export async function putCachedPlan(entry: CachedPlan): Promise<void> {
  await chrome.storage.local.set({ [`plan:${entry.pageKey}`]: entry });
  const all = await chrome.storage.local.get(null);
  const plans = Object.entries(all).filter(([k]) => k.startsWith("plan:")) as [string, CachedPlan][];
  if (plans.length > PLAN_CACHE_LIMIT) {
    plans.sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
    await chrome.storage.local.remove(plans.slice(0, plans.length - PLAN_CACHE_LIMIT).map(([k]) => k));
  }
}

export async function touchCachedPlan(entry: CachedPlan): Promise<void> {
  await chrome.storage.local.set({
    [`plan:${entry.pageKey}`]: { ...entry, lastUsedAt: Date.now(), hits: entry.hits + 1 },
  });
}

export async function deleteCachedPlans(filter: (pageKey: string) => boolean): Promise<number> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("plan:") && filter(k.slice(5)));
  await chrome.storage.local.remove(keys);
  return keys.length;
}

export async function listCachedPlans(): Promise<CachedPlan[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith("plan:"))
    .map(([, v]) => v as CachedPlan)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Plain-text summary of the facts the person chose to share, for AI requests. */
export function profileText(profile: Profile, purpose: "define" | "translate" | "fill" | "chat"): string {
  const lines: string[] = [];
  const add = (label: string, value: string) => value.trim() && lines.push(`${label}: ${value.trim()}`);
  add("Name", profile.name);
  add("Likes to be addressed as", profile.formOfAddress);
  add("Age range", profile.ageRange);
  add("Lives in", [profile.city, profile.country].filter(Boolean).join(", "));
  add("Preferred language", profile.language);
  add("Other languages", profile.otherLanguages);
  if (purpose !== "translate") {
    add("Reading and accessibility needs", profile.readingNeeds);
    add("Background", profile.background);
    add("Goals", profile.goals);
  }
  if (purpose === "fill" || purpose === "chat") {
    add("Address line 1", profile.addressLine1);
    add("Address line 2", profile.addressLine2);
    add("Postcode / ZIP", profile.postcode);
    add("Phone", profile.phone);
    add("Email", profile.email);
    add("Date of birth", profile.dateOfBirth);
  }
  if (purpose !== "translate") {
    for (const fact of profile.extraFacts.slice(0, 40)) lines.push(`Other fact: ${fact.text}`);
  }
  return lines.join("\n").slice(0, 5800);
}

export function personText(person: Person): string {
  return profileText({ ...EMPTY_PROFILE, ...person }, "fill") +
    (person.relationship ? `\nRelationship to the user: ${person.relationship}` : "");
}
