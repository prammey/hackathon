import { describe, expect, it } from "vitest";
import { t, tj, setDictionary, UI_LANGUAGES, uiLanguageFor } from "../src/shared/i18n";
import source from "../src/locales/_source.json";
import es from "../src/locales/es.json";
import fr from "../src/locales/fr.json";
import pt from "../src/locales/pt.json";
import zh from "../src/locales/zh.json";
import hi from "../src/locales/hi.json";
import bn from "../src/locales/bn.json";
import ar from "../src/locales/ar.json";
import vi from "../src/locales/vi.json";
import tl from "../src/locales/tl.json";
import ko from "../src/locales/ko.json";
import ru from "../src/locales/ru.json";

const LOCALES: Record<string, Record<string, string>> = { es, fr, pt, zh, hi, bn, ar, vi, tl, ko, ru };
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("i18n", () => {
  it("falls back to English and fills placeholders", () => {
    setDictionary("en", {});
    expect(t("Saved {count} facts", { count: 3 })).toBe("Saved 3 facts");
    setDictionary("es", { "Saved {count} facts": "Guardé {count} datos" });
    expect(t("Saved {count} facts", { count: 3 })).toBe("Guardé 3 datos");
    expect(t("Not translated")).toBe("Not translated");
    expect(tj("Hold {key} now", { key: "ALT" })).toEqual(["Hold ", "ALT", " now"]);
    setDictionary("en", {});
  });

  it("maps stored language names to interface languages", () => {
    expect(uiLanguageFor("Arabic").rtl).toBe(true);
    expect(uiLanguageFor("Polish").code).toBe("en");
  });

  for (const lang of UI_LANGUAGES.filter((l) => l.code !== "en")) {
    it(`${lang.english}: every phrase translated, placeholders intact`, () => {
      const words = LOCALES[lang.code];
      const missing = (source as string[]).filter((key) => !words[key]);
      expect(missing, `missing in ${lang.code}.json`).toEqual([]);
      const broken = (source as string[]).filter((key) => holes(key) !== holes(words[key]));
      expect(broken, `placeholders differ in ${lang.code}.json`).toEqual([]);
    });
  }
});
