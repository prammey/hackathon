/**
 * Runs at document_start on every page. For sites the person set to "tidy automatically", it applies
 * the Style's base stylesheet before first paint so the untidied page doesn't flash. The main content
 * script finishes the job at document_idle.
 */
import { DEFAULT_SETTINGS } from "../shared/storage";
import { pageCss } from "../shared/styles";
import type { Settings, SitePrefs } from "../shared/types";

(async () => {
  if (document.contentType !== "text/html") return;
  await chrome.runtime.sendMessage({ type: "css:reset" }).catch(() => {});
  const key = `site:${location.origin}`;
  const stored = await chrome.storage.local.get(["settings", key]);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) };
  const site = (stored[key] ?? {}) as SitePrefs;
  const auto = site.tidy === "always" || (settings.tidyEverywhere && site.tidy !== "never");
  if (!auto) return;
  const styleId = site.styleId ?? settings.styleId;
  document.documentElement.setAttribute("data-prism-on", "");
  document.documentElement.setAttribute("data-prism-style", styleId);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  chrome.runtime.sendMessage({ type: "css:apply", css: pageCss(styleId, settings, reduced) }).catch(() => {});
})();
