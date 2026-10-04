/**
 * Prism's own words in the person's language. English text is the lookup key, so anything without a
 * translation simply shows in English. Dictionaries live in extension/src/locales/<code>.json and are
 * loaded on demand (page code would otherwise carry all twelve languages).
 */
import type { ComponentChildren } from "preact";

export interface UiLanguage {
  code: string;
  /** The name the AI is given and the value stored in settings.translateTo. */
  english: string;
  /** The language's name in itself, shown on the picker. */
  native: string;
  rtl?: boolean;
}

export const UI_LANGUAGES: UiLanguage[] = [
  { code: "en", english: "English", native: "English" },
  { code: "es", english: "Spanish", native: "Español" },
  { code: "fr", english: "French", native: "Français" },
  { code: "pt", english: "Portuguese", native: "Português" },
  { code: "zh", english: "Chinese (Simplified)", native: "中文" },
  { code: "hi", english: "Hindi", native: "हिन्दी" },
  { code: "bn", english: "Bengali", native: "বাংলা" },
  { code: "ar", english: "Arabic", native: "العربية", rtl: true },
  { code: "vi", english: "Vietnamese", native: "Tiếng Việt" },
  { code: "tl", english: "Tagalog", native: "Tagalog" },
  { code: "ko", english: "Korean", native: "한국어" },
  { code: "ru", english: "Russian", native: "Русский" },
];

/** The interface language for a stored language name; languages without a translation fall back to English. */
export function uiLanguageFor(name: string | undefined): UiLanguage {
  return UI_LANGUAGES.find((l) => l.english === name) ?? UI_LANGUAGES[0];
}

let dict: Record<string, string> = {};
let current = "en";
const listeners = new Set<() => void>();

export function currentLanguage(): UiLanguage {
  return UI_LANGUAGES.find((l) => l.code === current) ?? UI_LANGUAGES[0];
}

/** Install a dictionary (`{}` for English) and tell the interface to redraw. */
export function setDictionary(code: string, words: Record<string, string>): void {
  current = code;
  dict = words;
  for (const fn of listeners) fn();
}

export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function fill(text: string, vars?: Record<string, string | number>): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Marks English kept in data (labels, taglines, reasons) for translators; translate it with t() where shown. */
export const k = (text: string): string => text;

/** Plain text: `t("Saved {count} facts", { count })`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  return fill(dict[text] || text, vars);
}

/**
 * Text with pieces of markup in it: `tj("Hold {key} and drag", { key: <strong>Alt</strong> })`.
 * Translators move the {placeholders}; each becomes the element given for it.
 */
export function tj(text: string, parts: Record<string, ComponentChildren>): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const source = dict[text] || text;
  let last = 0;
  for (const m of source.matchAll(/\{(\w+)\}/g)) {
    if (m.index! > last) out.push(source.slice(last, m.index));
    out.push(m[1] in parts ? parts[m[1]] : m[0]);
    last = m.index! + m[0].length;
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

/** Loads the dictionary for a stored language name, from the extension's own files. */
export async function loadLanguage(name: string | undefined, fetchWords?: (code: string) => Promise<Record<string, string>>): Promise<UiLanguage> {
  const lang = uiLanguageFor(name);
  if (lang.code === "en") { setDictionary("en", {}); return lang; }
  try {
    const words = fetchWords
      ? await fetchWords(lang.code)
      : await (await fetch(chrome.runtime.getURL(`locales/${lang.code}.json`))).json();
    setDictionary(lang.code, words ?? {});
  } catch {
    setDictionary("en", {}); // a missing file means English, never a broken interface
  }
  return lang;
}
