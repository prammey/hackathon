/** Start-up for Prism's own pages: load the person's language (and its direction) before drawing. */
import { loadLanguage } from "../shared/i18n";
import { getSettings } from "../shared/storage";

export async function applyLanguage(name: string | undefined): Promise<void> {
  const lang = await loadLanguage(name);
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
}

export async function bootPage(draw: () => void): Promise<void> {
  await applyLanguage((await getSettings()).translateTo).catch(() => {});
  draw();
  // Changing the language anywhere (Settings, the first-run picker) redraws every open Prism page.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      const next = (changes.settings.newValue as { translateTo?: string } | undefined)?.translateTo;
      const prev = (changes.settings.oldValue as { translateTo?: string } | undefined)?.translateTo;
      if (next !== prev) applyLanguage(next);
    }
  });
}
