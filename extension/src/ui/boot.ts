/** Start-up for Prism's own pages: load the person's language (and its direction) before drawing. */
import { loadLanguage } from "../shared/i18n";
import { getSettings } from "../shared/storage";

export async function applyLanguage(name: string | undefined): Promise<void> {
  const lang = await loadLanguage(name);
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
}

/** Prism's own pages (popup, Settings, welcome) follow the person's Text size. */
function applyTextSize(scale: number | undefined): void {
  document.documentElement.style.zoom = String(scale || 1);
}

export async function bootPage(draw: () => void): Promise<void> {
  const settings = await getSettings();
  applyTextSize(settings.textScale);
  await applyLanguage(settings.translateTo).catch(() => {});
  draw();
  // Changing the language anywhere (Settings, the first-run picker) redraws every open Prism page.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      const next = (changes.settings.newValue as { translateTo?: string } | undefined)?.translateTo;
      const prev = (changes.settings.oldValue as { translateTo?: string } | undefined)?.translateTo;
      if (next !== prev) applyLanguage(next);
      applyTextSize((changes.settings.newValue as { textScale?: number } | undefined)?.textScale);
    }
  });
}
