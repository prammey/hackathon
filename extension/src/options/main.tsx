/** Prism settings page. Everything here is stored in this browser only (chrome.storage.local). */
import { render } from "preact";
import { bootPage } from "../ui/boot";
import { useEffect, useState } from "preact/hooks";
import {
  deleteCachedPlans, EMPTY_PROFILE, getProfile, getSettings, listCachedPlans, listSitePrefs, saveProfile, saveSettings,
  saveSitePrefs,
} from "../shared/storage";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { CachedPlan, Person, PersonDetails, Profile, Settings, SitePrefs, StyleId } from "../shared/types";
import { t, tj, k, UI_LANGUAGES } from "../shared/i18n";
import { allowMicrophone, Brand, Icon, MicButton, Notice, Switch, useLanguage } from "../ui/components";
import { ImportSection } from "./imports";
import { MiniPreview } from "./preview";


export const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Polish", "Ukrainian", "Russian", "Turkish", "Arabic", "Urdu", "Hindi", "Bengali", "Punjabi", "Chinese (Simplified)", "Chinese (Traditional)", "Vietnamese", "Korean", "Japanese", "Tagalog"];

function Settings() {
  useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    getProfile().then(setProfile);
    const go = () => {
      const id = location.hash.slice(1);
      if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50);
    };
    addEventListener("hashchange", go);
    go();
    return () => removeEventListener("hashchange", go);
  }, []);

  if (!settings || !profile) return <main class="page"><p>{t("Loading settings…")}</p></main>;
  const update = async (patch: Partial<Settings>) => setSettings(await saveSettings(patch));

  return (
    <main class="page page--simple">
      <header class="page__head">
        <h1 style="margin:0"><Brand size={40} label={t("Settings")} /></h1>
        <p class="pz-muted" style="margin:0">{t("Most changes save by themselves.")}</p>
      </header>
      <div class="simple-settings">
        <StyleSection settings={settings} update={update} />
        <LanguageSection settings={settings} update={update} />
        <DictationSection settings={settings} update={update} />
        <AboutSection profile={profile} onSaved={setProfile} />
        <DataSection onCleared={async () => { setProfile(await getProfile()); setSettings(await getSettings()); }} />
        {/* For developers only: reached by opening options.html#service. */}
        {location.hash === "#service" && <ServiceSection settings={settings} update={update} />}
      </div>
    </main>
  );
}

// ---------- Style ----------

function StyleSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  useLanguage();
  const [sites, setSites] = useState<[string, SitePrefs][]>([]);
  useEffect(() => { listSitePrefs().then(setSites); }, []);
  const overrides = sites.filter(([, p]) => p.styleId);
  return (
    <section id="style" class="section" aria-labelledby="style-h">
      <h2 id="style-h">{t("How pages look")}</h2>
      <div class="style-cards" role="radiogroup" aria-label={t("Default style")}>
        {STYLE_ORDER.map((id) => {
          const style = STYLES[id];
          return (
            <button type="button" class="style-card" role="radio" aria-checked={settings.styleId === id} aria-pressed={settings.styleId === id}
              onClick={() => update({ styleId: id })} data-style={id}>
              <MiniPreview t={style} />
              <span class="style-card__name">{style.name}{settings.styleId === id && <span class="pz-label" style="color:var(--pz-violet)"><Icon name="check" /> {t("Default")}</span>}</span>
              <span class="style-card__tag">{t(style.tagline)}</span>
            </button>
          );
        })}
      </div>
      <div class="text-size" role="radiogroup" aria-label={t("Text size")}>
        <span class="text-size__label">{t("Text size")}</span>
        {([1, 1.15, 1.3, 1.5] as const).map((v) => (
          <button type="button" class="text-size__btn" role="radio" aria-checked={settings.textScale === v} onClick={() => update({ textScale: v })}
            style={`font-size:${Math.round(16 * v)}px`}>{v === 1 ? t("Normal") : v === 1.15 ? t("Large") : v === 1.3 ? t("Larger") : t("Largest")}</button>
        ))}
      </div>
      {overrides.length > 0 && (
        <div class="group">
          <h3>{t("Websites with their own style")}</h3>
          <table class="simple">
            <thead><tr><th>{t("Website")}</th><th>{t("Style")}</th><th><span class="pz-sr">{t("Action")}</span></th></tr></thead>
            <tbody>
              {overrides.map(([origin, p]) => (
                <tr>
                  <td>{new URL(origin).host}</td>
                  <td>{STYLES[p.styleId as StyleId].name}</td>
                  <td><button class="pz-btn pz-btn--small" type="button" onClick={async () => { await saveSitePrefs(origin, { styleId: undefined }); setSites(await listSitePrefs()); }}>{t("Use default")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}



// ---------- About you ----------

const FIELDS: { key: keyof PersonDetails; label: string; theirs?: string; hint?: string; type?: "text" | "tel" | "email" | "date" | "textarea"; group: string; options?: string[] }[] = [
  { key: "name", label: k("Your name"), theirs: k("Their name"), group: "talk" },
  { key: "formOfAddress", label: k("What should Prism call you?"), theirs: k("What do they like to be called?"), hint: k("For example “Margaret” or “Mr Patel”."), group: "talk" },
  { key: "ageRange", label: k("Age range"), group: "talk", options: ["", k("Under 18"), "18–34", "35–54", "55–69", k("70 or over")] },
  { key: "language", label: k("Language you prefer to read"), theirs: k("Language they prefer to read"), group: "talk", options: ["", ...LANGUAGES] },
  { key: "otherLanguages", label: k("Other languages you understand"), theirs: k("Other languages they understand"), group: "talk" },
  { key: "readingNeeds", label: k("Reading or accessibility needs"), hint: k("For example “I use a magnifier” or “Short sentences please”."), group: "talk" },
  { key: "country", label: k("Country"), group: "where" },
  { key: "city", label: k("Town or city"), group: "where" },
  { key: "background", label: k("About you"), hint: k("Anything that helps Prism explain things for you, e.g. “Retired nurse, not confident with computers”."), group: "goals", type: "textarea" },
  { key: "goals", label: k("What are you trying to do online at the moment?"), hint: k("e.g. “Renew my driver's license and sign up for Medicare”."), group: "goals", type: "textarea" },
  { key: "addressLine1", label: k("Address line 1"), group: "forms" },
  { key: "addressLine2", label: k("Address line 2"), group: "forms" },
  { key: "postcode", label: k("ZIP code"), group: "forms" },
  { key: "phone", label: k("Phone number"), group: "forms", type: "tel" },
  { key: "email", label: k("Email address"), group: "forms", type: "email" },
  { key: "dateOfBirth", label: k("Date of birth"), group: "forms", type: "date" },
];

const BASIC: (keyof PersonDetails)[] = ["name", "formOfAddress", "city"];

function DetailsForm(props: { value: PersonDetails; onChange: (v: PersonDetails) => void; idPrefix: string; groups: string[]; only?: (keyof PersonDetails)[]; skip?: (keyof PersonDetails)[]; someoneElse?: boolean }) {
  useLanguage();
  return (
    <div class="grid2">
      {FIELDS.filter((f) => props.groups.includes(f.group) && (!props.only || props.only.includes(f.key)) && !props.skip?.includes(f.key)).map((f) => {
        const id = `${props.idPrefix}-${f.key}`;
        const set = (v: string) => props.onChange({ ...props.value, [f.key]: v });
        return (
          <label class="pz-field" style={f.type === "textarea" ? "grid-column:1 / -1" : ""} for={id}>
            <span>{t(props.someoneElse && f.theirs ? f.theirs : f.label)}</span>
            {f.hint && <span class="pz-hint">{t(f.hint)}</span>}
            {f.options
              ? <select id={id} class="pz-input" value={props.value[f.key]} onChange={(e) => set((e.target as HTMLSelectElement).value)}>{f.options.map((o) => <option value={o}>{!o ? t("Prefer not to say") : f.key === "language" ? o : t(o)}</option>)}</select>
              : f.type === "textarea"
                ? <textarea id={id} class="pz-input" value={props.value[f.key]} onInput={(e) => set((e.target as HTMLTextAreaElement).value)} />
                : <input id={id} class="pz-input" type={(f.type ?? "text") as "text"} value={props.value[f.key]} autocomplete="off" onInput={(e) => set((e.target as HTMLInputElement).value)} />}
          </label>
        );
      })}
    </div>
  );
}

function AboutSection({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  useLanguage();
  const [draft, setDraft] = useState<Profile>(profile);
  const [status, setStatus] = useState("");
  const [newFact, setNewFact] = useState("");
  useEffect(() => setDraft(profile), [profile]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const save = async (next = draft) => {
    await saveProfile(next);
    const saved = await getProfile();
    onSaved(saved);
    setStatus(t("Saved."));
    setTimeout(() => setStatus(""), 3000);
  };
  const addPerson = () => setDraft({ ...draft, people: [...draft.people, { ...EMPTY_PROFILE, id: crypto.randomUUID(), relationship: "" } as Person] });
  return (
    <section id="about" class="section" aria-labelledby="about-h">
      <h2 id="about-h">{t("About you")}</h2>
      <p>{t("Optional. It helps Prism talk to you the way you like. Never put passwords or card numbers here.")}</p>
      <div class="group"><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["talk", "where"]} only={BASIC} /></div>
      <div class="group">
        <h3>{t("Anything else Prism should know")}</h3>
        {draft.extraFacts.length === 0 && <p class="pz-muted" style="margin:0">{t("Nothing yet. Add a fact below, or import from ChatGPT or Claude.")}</p>}
        <ul class="facts">
          {draft.extraFacts.map((f) => (
            <li class="fact">
              <span><span>{f.text}</span><br /><span class="fact__meta">{t(({ typed: k("Typed by you"), pasted: k("Pasted"), "imported-chatgpt": k("Imported from ChatGPT"), "imported-claude": k("Imported from Claude"), chat: k("From a chat") } as Record<string, string>)[f.source] ?? "")} · {f.addedAt ? new Date(f.addedAt).toLocaleDateString() : ""}</span></span>
              <button class="pz-btn pz-btn--small" type="button" aria-label={t("Delete: {fact}", { fact: f.text })} onClick={() => setDraft({ ...draft, extraFacts: draft.extraFacts.filter((x) => x.id !== f.id) })}>{t("Delete")}</button>
            </li>
          ))}
        </ul>
        <div class="row">
          <label class="pz-sr" for="new-fact">{t("New fact")}</label>
          <input id="new-fact" class="pz-input" style="flex:1;min-width:240px" placeholder={t("e.g. I get Social Security")} value={newFact} onInput={(e) => setNewFact((e.target as HTMLInputElement).value)} />
          <MicButton onText={(text) => setNewFact(text)} />
          <button class="pz-btn" type="button" disabled={!newFact.trim()} onClick={() => { setDraft({ ...draft, extraFacts: [...draft.extraFacts, { id: crypto.randomUUID(), text: newFact.trim(), source: "typed", addedAt: Date.now() }] }); setNewFact(""); }}>{t("Add")}</button>
        </div>
      </div>
      <div class="group">
        <h3>{t("People you help")}</h3>
        <p class="pz-hint" style="margin:0">{t("Filling in forms or asking for someone else, like a parent? Add them here. Fill out and Chat will let you choose them, and their details are never mixed up with yours.")}</p>
        {draft.people.map((p, i) => (
          <div class="group">
            <div class="row" style="justify-content:space-between">
              <strong>{p.name || t("Person {number}", { number: i + 1 })}</strong>
              <button class="pz-btn pz-btn--small" type="button" onClick={() => setDraft({ ...draft, people: draft.people.filter((x) => x.id !== p.id) })}>{t("Remove")}</button>
            </div>
            <label class="pz-field"><span>{t("How do you know them?")}</span><input class="pz-input" value={p.relationship} placeholder={t("e.g. My mom")} onInput={(e) => setDraft({ ...draft, people: draft.people.map((x) => x.id === p.id ? { ...x, relationship: (e.target as HTMLInputElement).value } : x) })} /></label>
            <DetailsForm value={p} idPrefix={`person-${i}`} groups={["talk", "where", "forms"]} someoneElse
              onChange={(v) => setDraft({ ...draft, people: draft.people.map((x) => x.id === p.id ? { ...x, ...v } : x) })} />
          </div>
        ))}
        <div class="row"><button class="pz-btn" type="button" onClick={addPerson}><Icon name="person" /> {t("Add a person")}</button></div>
      </div>
      <details class="more-about" open={location.hash === "#about" || location.hash === "#import"}>
      <summary>{t("More about you")}</summary>
      <div class="group"><h3>{t("How Prism should talk to you")}</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["talk"]} skip={BASIC} /></div>
      <div class="group"><h3>{t("Where you live")}</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["where"]} skip={BASIC} /></div>
      <div class="group"><h3>{t("Your background and goals")}</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["goals"]} /></div>
      <div class="group">
        <h3>{t("For filling in forms")}</h3>
        <p class="pz-hint" style="margin:0">{tj("Only used to suggest answers when you choose {fillOut}. Prism always shows suggestions first and never sends a form.", { fillOut: <strong>{t("Fill out")}</strong> })}</p>
        <DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["forms"]} />
      </div>
      <ImportSection profile={profile} onSaved={onSaved} />
      </details>
      {dirty && (
        <div class="save-bar">
          <button class="pz-btn pz-btn--primary" type="button" onClick={() => save()} data-testid="save-profile">{t("Save “About you”")}</button>
          <button class="pz-btn pz-btn--quiet" type="button" onClick={() => setDraft(profile)}>{t("Undo changes")}</button>
        </div>
      )}
      <span role="status" class="pz-muted">{status}</span>
    </section>
  );
}

// ---------- Talking instead of typing ----------

function DictationSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  useLanguage();
  const [problem, setProblem] = useState("");
  const [heard, setHeard] = useState("");
  async function turn(on: boolean) {
    setProblem("");
    if (!on) { update({ dictation: false }); return; }
    const error = await allowMicrophone();
    if (error) setProblem(error);
    else update({ dictation: true });
  }
  return (
    <section id="talk" class="section" aria-labelledby="talk-h">
      <h2 id="talk-h">{t("Talking instead of typing")}</h2>
      <p>{tj("Press {talk} next to any box and say what you want to write. Prism writes it down for you.", { talk: <strong>{t("Talk")}</strong> })}</p>
      <div class="group">
        <Switch checked={settings.dictation} onChange={turn} label={t("Let me talk instead of typing")} id="dictation" />
        {problem && <Notice tone="error">{problem}</Notice>}
        {settings.dictation && (
          <div class="talk-try">
            <span>{t("Try it:")}</span>
            <MicButton onText={setHeard} onError={setProblem} testId="settings-talk" />
            {heard && <span class="talk-try__heard" data-testid="settings-heard">“{heard}”</span>}
          </div>
        )}
        <p class="pz-hint" style="margin:0">{t("Your voice is sent to Google's Gemini AI to be written down, then thrown away.")}</p>
      </div>
    </section>
  );
}

// ---------- Language ----------

function LanguageSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  useLanguage();
  return (
    <section id="language" class="section" aria-labelledby="lang-h">
      <h2 id="lang-h">{t("Your language")}</h2>
      <div class="group">
        <label class="pz-field" for="translate-to"><span>{t("Prism explains and translates into")}</span>
          <select id="translate-to" class="pz-input" style="max-width:360px" value={settings.translateTo} onChange={(e) => update({ translateTo: (e.target as HTMLSelectElement).value, languageChosen: true })}>
            <optgroup label={t("Prism's buttons and menus in this language too")}>
              {UI_LANGUAGES.map((l) => <option value={l.english}>{l.native === l.english ? l.native : `${l.native} — ${l.english}`}</option>)}
            </optgroup>
            <optgroup label={t("Explanations only")}>
              {LANGUAGES.filter((l) => !UI_LANGUAGES.some((u) => u.english === l)).map((l) => <option value={l}>{l}</option>)}
            </optgroup>
          </select>
        </label>
      </div>
    </section>
  );
}


// ---------- Privacy ----------

/** Everything Prism keeps, in plain words (the download has the full detail). */
async function storedSummary(layouts: number, siteCount: number): Promise<{ label: string; value: string }[]> {
  const settings = await getSettings();
  const profile = await getProfile();
  const about = FIELDS.filter((f) => profile[f.key]?.trim()).map((f) => `${t(f.label)}: ${profile[f.key]}`);
  const size = { 1: t("Normal"), 1.15: t("Large"), 1.3: t("Larger"), 1.5: t("Largest") }[settings.textScale] ?? "";
  return [
    { label: t("Your settings"), value: [settings.translateTo || "English", STYLES[settings.styleId].name, size, settings.dictation ? t("Talking is turned on") : ""].filter(Boolean).join(" · ") },
    { label: t("About you"), value: about.length ? about.join(" · ") : t("Nothing yet") },
    { label: t("Anything else Prism should know"), value: profile.extraFacts.length ? profile.extraFacts.map((f) => f.text).join(" · ") : t("Nothing yet") },
    { label: t("People you help"), value: profile.people.length ? profile.people.map((p) => p.name || t("Unnamed")).join(", ") : t("Nobody yet") },
    { label: t("Saved page layouts"), value: String(layouts) },
    { label: t("Websites with their own settings"), value: String(siteCount) },
  ];
}

function DataSection({ onCleared }: { onCleared: () => void }) {
  useLanguage();
  const [plans, setPlans] = useState<CachedPlan[]>([]);
  const [sites, setSites] = useState<[string, SitePrefs][]>([]);
  const [view, setView] = useState<{ label: string; value: string }[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => { setPlans(await listCachedPlans()); setSites(await listSitePrefs()); };
  useEffect(() => { refresh(); }, []);
  const chosen = sites.filter(([, p]) => p.tidy);
  const exportData = async () => {
    const all = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prism-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section id="privacy" class="section" aria-labelledby="priv-h">
      <h2 id="priv-h">{t("Your data")}</h2>
      <p>{t("Everything Prism knows about you stays in this browser. When you ask for help, only what's needed is sent to Google's Gemini AI, never passwords or card details.")}{" "}
        <a href="https://prism-helper.vercel.app/privacy.html" target="_blank" rel="noopener">{t("Read the full privacy policy")}</a></p>
      <div class="group">
        <div class="row">
          <button class="pz-btn" type="button" disabled={!plans.length} onClick={async () => { await deleteCachedPlans(() => true); refresh(); }}>{t("Forget saved page layouts ({count})", { count: plans.length })}</button>
          <button class="pz-btn" type="button" onClick={async () => setView(view ? null : await storedSummary(plans.length, sites.length))}>{view ? t("Hide what Prism stores") : t("See what Prism stores")}</button>
          <button class="pz-btn" type="button" onClick={exportData}>{t("Download a copy")}</button>
          {!confirming
            ? <button class="pz-btn pz-btn--danger" type="button" onClick={() => setConfirming(true)}>{t("Delete everything")}</button>
            : <span class="row"><strong>{t("Delete all Prism settings, About you and saved layouts?")}</strong>
                <button class="pz-btn pz-btn--danger" type="button" onClick={async () => { await chrome.storage.local.clear(); await saveSettings({ installId: crypto.randomUUID(), onboarded: true }); setConfirming(false); setMessage(t("Everything was deleted.")); onCleared(); refresh(); }}>{t("Yes, delete everything")}</button>
                <button class="pz-btn" type="button" onClick={() => setConfirming(false)}>{t("Cancel")}</button></span>}
        </div>
        {message && <Notice tone="ok">{message}</Notice>}
        {view && (
          <dl class="stored" data-testid="stored">
            {view.map((row) => <div><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            <p class="pz-hint" style="margin:0">{t("“Download a copy” saves all of it as a file.")}</p>
          </dl>
        )}
        {chosen.length > 0 && (
          <table class="simple">
            <tbody>
              {chosen.map(([origin, p]) => (
                <tr>
                  <td>{new URL(origin).host}</td>
                  <td>{p.tidy === "always" ? t("Tidied automatically") : t("Never tidied")}</td>
                  <td><button class="pz-btn pz-btn--small" type="button" onClick={async () => { await saveSitePrefs(origin, { tidy: undefined }); refresh(); }}>{t("Remove")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ---------- Service ----------

function ServiceSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  useLanguage();
  const [health, setHealth] = useState<{ ok: boolean; mode?: string; model?: string; base: string } | null>(null);
  const test = async () => { setHealth(null); setHealth(await chrome.runtime.sendMessage({ type: "health" })); };
  useEffect(() => { test(); }, [settings.helperMode, settings.localUrl]);
  return (
    <section id="service" class="section" aria-labelledby="svc-h">
      <h2 id="svc-h">{t("Prism service")}</h2>
      <p>{t("Prism's explanations, translations and chat use Google's Gemini AI through a small Prism service.")}</p>
      <div class="group">
        <div class="radio-list" role="radiogroup" aria-label={t("Prism service")}>
          <label class="pz-choice"><input type="radio" name="svc" disabled={!__PRISM_HOSTED_URL__} checked={settings.helperMode === "hosted"} onChange={() => update({ helperMode: "hosted" })} />
            <span>{tj("{service} (recommended)", { service: <strong>{t("Prism's online service")}</strong> })}<br /><span class="pz-hint">{__PRISM_HOSTED_URL__ ? t("Works straight away. Nothing to install.") : t("Not available in this build.")}</span></span></label>
          <label class="pz-choice"><input type="radio" name="svc" checked={settings.helperMode === "local"} onChange={() => update({ helperMode: "local" })} />
            <span>{tj("{helper} (for developers)", { helper: <strong>{t("A helper on this computer")}</strong> })}<br /><span class="pz-hint">{t("Uses your own Google Cloud sign-in. See the README for setup.")}</span></span></label>
        </div>
        {settings.helperMode === "local" && (
          <label class="pz-field" for="local-url"><span>{t("Helper address")}</span>
            <input id="local-url" class="pz-input" style="max-width:360px" value={settings.localUrl} onChange={(e) => update({ localUrl: (e.target as HTMLInputElement).value })} /></label>
        )}
        <div class="row">
          <button class="pz-btn pz-btn--small" type="button" onClick={test}>{t("Check connection")}</button>
          {health === null ? <span class="pz-muted">{t("Checking…")}</span> : health.ok
            ? <span style="color:var(--pz-ok);font-weight:700">{health.model ? t("Connected · AI model: {model}", { model: health.model }) : t("Connected")}</span>
            : <span style="color:var(--pz-danger);font-weight:700">{t("Not connected to {address}", { address: health.base })}</span>}
        </div>
      </div>
      <p class="pz-hint">Prism {__PRISM_VERSION__}</p>
    </section>
  );
}

bootPage(() => render(<Settings />, document.getElementById("app")!));
