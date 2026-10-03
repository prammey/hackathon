/** Prism settings page. Everything here is stored in this browser only (chrome.storage.local). */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  deleteCachedPlans, EMPTY_PROFILE, getProfile, getSettings, listCachedPlans, listSitePrefs, saveProfile, saveSettings,
  saveSitePrefs,
} from "../shared/storage";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { CachedPlan, Person, PersonDetails, Profile, Settings, SitePrefs, StyleId } from "../shared/types";
import { allowMicrophone, Brand, Icon, isMac, MicButton, Notice, Switch } from "../ui/components";
import { ImportSection } from "./imports";
import { MiniPreview } from "./preview";

// Sections that live inside "More settings": a link straight to one of them opens it.
const MORE = ["tidying", "pointing", "import", "reading", "privacy", "service", "more"];

export const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Polish", "Ukrainian", "Russian", "Turkish", "Arabic", "Urdu", "Hindi", "Bengali", "Punjabi", "Chinese (Simplified)", "Chinese (Traditional)", "Vietnamese", "Korean", "Japanese", "Tagalog"];

function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [moreOpen, setMoreOpen] = useState(MORE.includes(location.hash.slice(1)));

  useEffect(() => {
    getSettings().then(setSettings);
    getProfile().then(setProfile);
    const go = () => {
      const id = location.hash.slice(1);
      if (MORE.includes(id)) setMoreOpen(true);
      if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50);
    };
    addEventListener("hashchange", go);
    go();
    return () => removeEventListener("hashchange", go);
  }, []);

  if (!settings || !profile) return <main class="page"><p>Loading settings…</p></main>;
  const update = async (patch: Partial<Settings>) => setSettings(await saveSettings(patch));

  return (
    <main class="page page--simple">
      <header class="page__head">
        <h1 style="margin:0"><Brand size={40} label="Settings" /></h1>
        <p class="pz-muted" style="margin:0">Most changes save by themselves.</p>
      </header>
      <div class="simple-settings">
        <StyleSection settings={settings} update={update} />
        <DictationSection settings={settings} update={update} />
        <LanguageSection settings={settings} update={update} />
        <AboutSection profile={profile} onSaved={setProfile} />
        <details id="more" class="more-settings" open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
          <summary data-testid="more-settings">More settings</summary>
          <div class="more-settings__body">
            <TidyingSection settings={settings} update={update} />
            <PointingSection settings={settings} update={update} />
            <ReadingSection settings={settings} update={update} />
            <ImportSection profile={profile} onSaved={setProfile} />
            <PrivacySection onCleared={async () => { setProfile(await getProfile()); setSettings(await getSettings()); }} />
            <ServiceSection settings={settings} update={update} />
          </div>
        </details>
      </div>
    </main>
  );
}

// ---------- Style ----------

function StyleSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [sites, setSites] = useState<[string, SitePrefs][]>([]);
  useEffect(() => { listSitePrefs().then(setSites); }, []);
  const overrides = sites.filter(([, p]) => p.styleId);
  return (
    <section id="style" class="section" aria-labelledby="style-h">
      <h2 id="style-h">How pages look</h2>
      <div class="style-cards" role="radiogroup" aria-label="Default style">
        {STYLE_ORDER.map((id) => {
          const t = STYLES[id];
          return (
            <button type="button" class="style-card" role="radio" aria-checked={settings.styleId === id} aria-pressed={settings.styleId === id}
              onClick={() => update({ styleId: id })} data-style={id}>
              <MiniPreview t={t} />
              <span class="style-card__name">{t.name}{settings.styleId === id && <span class="pz-label" style="color:var(--pz-violet)"><Icon name="check" /> Default</span>}</span>
              <span class="style-card__tag">{t.tagline}</span>
            </button>
          );
        })}
      </div>
      <div class="text-size" role="radiogroup" aria-label="Text size">
        <span class="text-size__label">Text size</span>
        {([1, 1.15, 1.3, 1.5] as const).map((v) => (
          <button type="button" class="text-size__btn" role="radio" aria-checked={settings.textScale === v} onClick={() => update({ textScale: v })}
            style={`font-size:${Math.round(16 * v)}px`}>{v === 1 ? "Normal" : v === 1.15 ? "Large" : v === 1.3 ? "Larger" : "Largest"}</button>
        ))}
      </div>
      {overrides.length > 0 && (
        <div class="group">
          <h3>Websites with their own style</h3>
          <table class="simple">
            <thead><tr><th>Website</th><th>Style</th><th><span class="pz-sr">Action</span></th></tr></thead>
            <tbody>
              {overrides.map(([origin, p]) => (
                <tr>
                  <td>{new URL(origin).host}</td>
                  <td>{STYLES[p.styleId as StyleId].name}</td>
                  <td><button class="pz-btn pz-btn--small" type="button" onClick={async () => { await saveSitePrefs(origin, { styleId: undefined }); setSites(await listSitePrefs()); }}>Use default</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- Tidying ----------

function TidyingSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [plans, setPlans] = useState<CachedPlan[]>([]);
  const [sites, setSites] = useState<[string, SitePrefs][]>([]);
  const refresh = async () => { setPlans(await listCachedPlans()); setSites(await listSitePrefs()); };
  useEffect(() => { refresh(); }, []);
  const always = sites.filter(([, p]) => p.tidy === "always");
  const never = sites.filter(([, p]) => p.tidy === "never");
  return (
    <section id="tidying" class="section" aria-labelledby="tidy-h">
      <h2 id="tidy-h">Tidying</h2>
      <div class="group">
        <h3>When should Prism tidy websites?</h3>
        <div class="radio-list" role="radiogroup" aria-label="When to tidy">
          <label class="pz-choice"><input type="radio" name="when" checked={!settings.tidyEverywhere} onChange={() => update({ tidyEverywhere: false })} />
            <span><strong>Only when I turn it on</strong><br /><span class="pz-hint">Use the Prism button. You can choose websites to tidy automatically.</span></span></label>
          <label class="pz-choice"><input type="radio" name="when" checked={settings.tidyEverywhere} onChange={() => update({ tidyEverywhere: true })} />
            <span><strong>On every website</strong><br /><span class="pz-hint">Except websites where you chose “Don't tidy this website”.</span></span></label>
        </div>
      </div>
      <div class="group">
        <h3>Saved layouts</h3>
        <p style="margin:0">So a page looks the same each time, Prism remembers how it tidied it ({plans.length} {plans.length === 1 ? "page" : "pages"}). It never saves what you typed into forms, or pictures of pages.</p>
        {plans.length > 0 && (
          <table class="simple">
            <thead><tr><th>Page</th><th>Last used</th><th><span class="pz-sr">Action</span></th></tr></thead>
            <tbody>
              {plans.slice(0, 12).map((p) => (
                <tr>
                  <td style="overflow-wrap:anywhere">{p.pageKey.replace(/^https?:\/\//, "")}<br /><span class="pz-hint">{p.plan.pagePurpose}</span></td>
                  <td>{new Date(p.lastUsedAt).toLocaleDateString()}</td>
                  <td><button class="pz-btn pz-btn--small" type="button" onClick={async () => { await deleteCachedPlans((k) => k === p.pageKey); refresh(); }}>Forget</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div class="row">
          <button class="pz-btn" type="button" disabled={!plans.length} onClick={async () => { await deleteCachedPlans(() => true); refresh(); }}>Forget all saved layouts</button>
        </div>
      </div>
      {(always.length > 0 || never.length > 0) && (
        <div class="group">
          <h3>Your choices for particular websites</h3>
          <table class="simple">
            <tbody>
              {[...always, ...never].map(([origin, p]) => (
                <tr>
                  <td>{new URL(origin).host}</td>
                  <td>{p.tidy === "always" ? "Tidy automatically" : "Never tidy"}</td>
                  <td><button class="pz-btn pz-btn--small" type="button" onClick={async () => { await saveSitePrefs(origin, { tidy: undefined }); refresh(); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- Pointing ----------

function PointingSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const mac = isMac();
  const [commands, setCommands] = useState<chrome.commands.Command[]>([]);
  useEffect(() => { chrome.commands.getAll().then(setCommands); }, []);
  const options: [Settings["shortcut"], string, string][] = [
    ["alt", mac ? "Hold Option ⌥ and drag" : "Hold Alt and drag", "The simplest. Recommended."],
    ["shift-alt", mac ? "Hold Shift + Option ⌥ and drag" : "Hold Shift + Alt and drag", "If Option/Alt alone does something else for you."],
    ["ctrl-shift", mac ? "Hold Control + Shift and drag" : "Hold Ctrl + Shift and drag", "Another alternative."],
  ];
  return (
    <section id="pointing" class="section" aria-labelledby="point-h">
      <h2 id="point-h">Pointing at things</h2>
      <p>Draw a box around anything on a web page to get help with it: <strong>Define</strong>, <strong>Translate</strong>, <strong>Fill out</strong>, or <strong>Chat</strong>.</p>
      <div class="group">
        <h3>Shortcut</h3>
        <div class="radio-list" role="radiogroup" aria-label="Selection shortcut">
          {options.map(([v, label, hint]) => (
            <label class="pz-choice"><input type="radio" name="shortcut" checked={settings.shortcut === v} onChange={() => update({ shortcut: v })} />
              <span><strong>{label}</strong><br /><span class="pz-hint">{hint}</span></span></label>
          ))}
        </div>
        <p class="pz-hint" style="margin:0">Press <strong>Esc</strong> at any time to cancel.</p>
      </div>
      <div class="group">
        <h3>If holding keys is hard</h3>
        <ul style="margin:0;padding-left:20px;display:grid;gap:6px">
          <li>Click the Prism button in your toolbar, then <strong>Point at something</strong>, and drag without holding any keys.</li>
          <li>Right-click on a page, selected text, or a picture and choose <strong>Ask Prism about this</strong>.</li>
          {commands.filter((c) => c.name === "start-selection" || c.name === "open-chat").map((c) => (
            <li>{c.description}: {c.shortcut ? <kbd>{c.shortcut}</kbd> : <span class="pz-muted">no keyboard shortcut set</span>} (use the arrow keys to move the box and Enter to choose)</li>
          ))}
        </ul>
        <div class="row">
          <button class="pz-btn pz-btn--small" type="button" onClick={() => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}>Change keyboard shortcuts</button>
        </div>
      </div>
    </section>
  );
}

// ---------- About you ----------

const FIELDS: { key: keyof PersonDetails; label: string; hint?: string; type?: "text" | "tel" | "email" | "date" | "textarea"; group: string; options?: string[] }[] = [
  { key: "name", label: "Your name", group: "talk" },
  { key: "formOfAddress", label: "What should Prism call you?", hint: "For example “Margaret” or “Mr Patel”.", group: "talk" },
  { key: "ageRange", label: "Age range", group: "talk", options: ["", "Under 18", "18–34", "35–54", "55–69", "70 or over"] },
  { key: "language", label: "Language you prefer to read", group: "talk", options: ["", ...LANGUAGES] },
  { key: "otherLanguages", label: "Other languages you understand", group: "talk" },
  { key: "readingNeeds", label: "Reading or accessibility needs", hint: "For example “I use a magnifier” or “Short sentences please”.", group: "talk" },
  { key: "country", label: "Country", group: "where" },
  { key: "city", label: "Town or city", group: "where" },
  { key: "background", label: "About you", hint: "Anything that helps Prism explain things for you, e.g. “Retired nurse, not confident with computers”.", group: "goals", type: "textarea" },
  { key: "goals", label: "What are you trying to do online at the moment?", hint: "e.g. “Apply for a bus pass and sort out my pension”.", group: "goals", type: "textarea" },
  { key: "addressLine1", label: "Address line 1", group: "forms" },
  { key: "addressLine2", label: "Address line 2", group: "forms" },
  { key: "postcode", label: "Postcode or ZIP code", group: "forms" },
  { key: "phone", label: "Phone number", group: "forms", type: "tel" },
  { key: "email", label: "Email address", group: "forms", type: "email" },
  { key: "dateOfBirth", label: "Date of birth", group: "forms", type: "date" },
];

const BASIC: (keyof PersonDetails)[] = ["name", "formOfAddress", "city"];

function DetailsForm(props: { value: PersonDetails; onChange: (v: PersonDetails) => void; idPrefix: string; groups: string[]; only?: (keyof PersonDetails)[]; skip?: (keyof PersonDetails)[] }) {
  return (
    <div class="grid2">
      {FIELDS.filter((f) => props.groups.includes(f.group) && (!props.only || props.only.includes(f.key)) && !props.skip?.includes(f.key)).map((f) => {
        const id = `${props.idPrefix}-${f.key}`;
        const set = (v: string) => props.onChange({ ...props.value, [f.key]: v });
        return (
          <label class="pz-field" style={f.type === "textarea" ? "grid-column:1 / -1" : ""} for={id}>
            <span>{f.label}</span>
            {f.hint && <span class="pz-hint">{f.hint}</span>}
            {f.options
              ? <select id={id} class="pz-input" value={props.value[f.key]} onChange={(e) => set((e.target as HTMLSelectElement).value)}>{f.options.map((o) => <option value={o}>{o || "Prefer not to say"}</option>)}</select>
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
  const [draft, setDraft] = useState<Profile>(profile);
  const [status, setStatus] = useState("");
  const [newFact, setNewFact] = useState("");
  useEffect(() => setDraft(profile), [profile]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const save = async (next = draft) => {
    await saveProfile(next);
    const saved = await getProfile();
    onSaved(saved);
    setStatus("Saved.");
    setTimeout(() => setStatus(""), 3000);
  };
  const addPerson = () => setDraft({ ...draft, people: [...draft.people, { ...EMPTY_PROFILE, id: crypto.randomUUID(), relationship: "" } as Person] });
  return (
    <section id="about" class="section" aria-labelledby="about-h">
      <h2 id="about-h">About you</h2>
      <p>Optional. It helps Prism talk to you the way you like. Never put passwords or card numbers here.</p>
      <div class="group"><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["talk", "where"]} only={BASIC} /></div>
      <div class="group">
        <h3>Anything else Prism should know</h3>
        {draft.extraFacts.length === 0 && <p class="pz-muted" style="margin:0">Nothing yet. Add a fact below, or import from ChatGPT or Claude.</p>}
        <ul class="facts">
          {draft.extraFacts.map((f) => (
            <li class="fact">
              <span><span>{f.text}</span><br /><span class="fact__meta">{({ typed: "Typed by you", pasted: "Pasted", "imported-chatgpt": "Imported from ChatGPT", "imported-claude": "Imported from Claude", chat: "From a chat" } as Record<string, string>)[f.source]} · {f.addedAt ? new Date(f.addedAt).toLocaleDateString() : ""}</span></span>
              <button class="pz-btn pz-btn--small" type="button" aria-label={`Delete: ${f.text}`} onClick={() => setDraft({ ...draft, extraFacts: draft.extraFacts.filter((x) => x.id !== f.id) })}>Delete</button>
            </li>
          ))}
        </ul>
        <div class="row">
          <label class="pz-sr" for="new-fact">New fact</label>
          <input id="new-fact" class="pz-input" style="flex:1;min-width:240px" placeholder="e.g. I receive Pension Credit" value={newFact} onInput={(e) => setNewFact((e.target as HTMLInputElement).value)} />
          <MicButton onText={(t) => setNewFact(t)} />
          <button class="pz-btn" type="button" disabled={!newFact.trim()} onClick={() => { setDraft({ ...draft, extraFacts: [...draft.extraFacts, { id: crypto.randomUUID(), text: newFact.trim(), source: "typed", addedAt: Date.now() }] }); setNewFact(""); }}>Add</button>
        </div>
      </div>
      <details class="more-about" open={location.hash === "#about"}>
      <summary>More about you</summary>
      <div class="group"><h3>How Prism should talk to you</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["talk"]} skip={BASIC} /></div>
      <div class="group"><h3>Where you live</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["where"]} skip={BASIC} /></div>
      <div class="group"><h3>Your background and goals</h3><DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["goals"]} /></div>
      <div class="group">
        <h3>For filling in forms</h3>
        <p class="pz-hint" style="margin:0">Only used to suggest answers when you choose <strong>Fill out</strong>. Prism always shows suggestions first and never sends a form.</p>
        <DetailsForm value={draft} onChange={(v) => setDraft({ ...draft, ...v })} idPrefix="me" groups={["forms"]} />
      </div>
      <div class="group">
        <h3>People you help</h3>
        <p class="pz-hint" style="margin:0">If you fill in forms for someone else, add them here. In a chat you can say “I'm helping Joan” — Prism will use their details just for that chat and won't change yours.</p>
        {draft.people.map((p, i) => (
          <div class="group">
            <div class="row" style="justify-content:space-between">
              <strong>{p.name || `Person ${i + 1}`}</strong>
              <button class="pz-btn pz-btn--small" type="button" onClick={() => setDraft({ ...draft, people: draft.people.filter((x) => x.id !== p.id) })}>Remove</button>
            </div>
            <label class="pz-field"><span>How do you know them?</span><input class="pz-input" value={p.relationship} placeholder="e.g. My mum" onInput={(e) => setDraft({ ...draft, people: draft.people.map((x) => x.id === p.id ? { ...x, relationship: (e.target as HTMLInputElement).value } : x) })} /></label>
            <DetailsForm value={p} idPrefix={`person-${i}`} groups={["talk", "where", "forms"]}
              onChange={(v) => setDraft({ ...draft, people: draft.people.map((x) => x.id === p.id ? { ...x, ...v } : x) })} />
          </div>
        ))}
        <div class="row"><button class="pz-btn" type="button" onClick={addPerson}><Icon name="person" /> Add a person</button></div>
      </div>
      </details>
      {dirty && (
        <div class="save-bar">
          <button class="pz-btn pz-btn--primary" type="button" onClick={() => save()} data-testid="save-profile">Save “About you”</button>
          <button class="pz-btn pz-btn--quiet" type="button" onClick={() => setDraft(profile)}>Undo changes</button>
        </div>
      )}
      <span role="status" class="pz-muted">{status}</span>
    </section>
  );
}

// ---------- Talking instead of typing ----------

function DictationSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
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
      <h2 id="talk-h">Talking instead of typing</h2>
      <p>Press <strong>Talk</strong> next to any box and say what you want to write. Prism writes it down for you.</p>
      <div class="group">
        <Switch checked={settings.dictation} onChange={turn} label="Let me talk instead of typing" id="dictation" />
        {problem && <Notice tone="error">{problem}</Notice>}
        {settings.dictation && (
          <div class="talk-try">
            <span>Try it:</span>
            <MicButton onText={setHeard} onError={setProblem} testId="settings-talk" />
            {heard && <span class="talk-try__heard" data-testid="settings-heard">“{heard}”</span>}
          </div>
        )}
        <p class="pz-hint" style="margin:0">Your voice is sent to Google's Gemini AI to be written down, then thrown away.</p>
      </div>
    </section>
  );
}

// ---------- Language ----------

function LanguageSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <section id="language" class="section" aria-labelledby="lang-h">
      <h2 id="lang-h">Your language</h2>
      <div class="group">
        <label class="pz-field" for="translate-to"><span>Prism explains and translates into</span>
          <select id="translate-to" class="pz-input" style="max-width:320px" value={settings.translateTo} onChange={(e) => update({ translateTo: (e.target as HTMLSelectElement).value })}>
            {LANGUAGES.map((l) => <option>{l}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

// ---------- Reading & accessibility ----------

function ReadingSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const check = (key: keyof Settings, label: string, hint: string) => (
    <label class="pz-choice"><input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => update({ [key]: (e.target as HTMLInputElement).checked } as Partial<Settings>)} />
      <span><strong>{label}</strong><br /><span class="pz-hint">{hint}</span></span></label>
  );
  return (
    <section id="reading" class="section" aria-labelledby="read-h">
      <h2 id="read-h">Reading</h2>
      <div class="group">
        <h3>Explanations</h3>
        <div class="radio-list" role="radiogroup" aria-label="Explanation detail">
          {([["simple", "Simply", "Very short sentences, no jargon."], ["normal", "Normally", "Clear and plain."], ["detailed", "In detail", "More background, still plain language."]] as const).map(([v, label, hint]) => (
            <label class="pz-choice"><input type="radio" name="explain" checked={settings.explainLevel === v} onChange={() => update({ explainLevel: v })} />
              <span><strong>{label}</strong><br /><span class="pz-hint">{hint}</span></span></label>
          ))}
        </div>
      </div>
      <div class="group">
        <h3>Display</h3>
        <div class="radio-list">
          {check("extraLegible", "Extra-legible font", "Uses Atkinson Hyperlegible, designed for people with low vision, in every style.")}
          {check("strongContrast", "Stronger contrast", "Black text, darker borders, no soft shadows.")}
          {check("underlineLinks", "Underline links", "Makes links easier to spot.")}
          {check("bigTargets", "Bigger buttons and boxes", "Makes things on tidied pages easier to click.")}
          <label class="pz-choice"><input type="checkbox" checked={settings.reduceMotion === "on"} onChange={(e) => update({ reduceMotion: (e.target as HTMLInputElement).checked ? "on" : "system" })} />
            <span><strong>Reduce motion</strong><br /><span class="pz-hint">Turns off animations. Prism already follows your computer's setting.</span></span></label>
        </div>
      </div>
    </section>
  );
}

// ---------- Privacy ----------

function PrivacySection({ onCleared }: { onCleared: () => void }) {
  const [view, setView] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
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
      <h2 id="priv-h">Privacy & your data</h2>
      <div class="group">
        <h3>What stays on this computer</h3>
        <p style="margin:0">Your settings, “About you”, the people you help, and saved page layouts are stored only in this browser. Chats are forgotten when you close the tab. Prism never saves what you type into websites, and never saves pictures of pages.</p>
        <h3>What is sent to the AI</h3>
        <p style="margin:0">When you ask for help, Prism sends only what that request needs to Google's Gemini AI (Vertex AI), through Prism's service:</p>
        <ul style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li><strong>Tidy:</strong> a short outline of the page's headings, buttons and labels — not anything you've typed.</li>
          <li><strong>Define, Translate, Fill out:</strong> the text and fields in the area you selected, a picture of that area when needed, and the parts of “About you” that are relevant.</li>
          <li><strong>Chat:</strong> your messages, an outline of the page, and a picture of the screen only if you tick “Include the whole screen”.</li>
        </ul>
        <p class="pz-hint" style="margin:0">Google states it does not use this data to train its models. Requests may be kept briefly to run the service and to detect abuse. Passwords and payment details are never read into AI requests.</p>
      </div>
      <div class="group">
        <h3>Your data</h3>
        <div class="row">
          <button class="pz-btn" type="button" onClick={async () => setView(view ? null : JSON.stringify(await chrome.storage.local.get(["settings", "profile"]), null, 2))}>{view ? "Hide" : "See"} what Prism stores about you</button>
          <button class="pz-btn" type="button" onClick={exportData}>Download a copy</button>
          {!confirming
            ? <button class="pz-btn pz-btn--danger" type="button" onClick={() => setConfirming(true)}>Delete everything</button>
            : <span class="row"><strong>Delete all Prism settings, About you, people and saved layouts?</strong>
                <button class="pz-btn pz-btn--danger" type="button" onClick={async () => { await chrome.storage.local.clear(); await saveSettings({ installId: crypto.randomUUID(), onboarded: true }); setConfirming(false); setMessage("Everything was deleted."); onCleared(); }}>Yes, delete everything</button>
                <button class="pz-btn" type="button" onClick={() => setConfirming(false)}>Cancel</button></span>}
        </div>
        {message && <Notice tone="ok">{message}</Notice>}
        {view && <pre style="margin:0;max-height:320px;overflow:auto;background:var(--pz-bg);padding:14px;border-radius:14px;font-size:13px;border:1px solid var(--pz-line)">{view}</pre>}
      </div>
    </section>
  );
}

// ---------- Service ----------

function ServiceSection({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [health, setHealth] = useState<{ ok: boolean; mode?: string; model?: string; base: string } | null>(null);
  const test = async () => { setHealth(null); setHealth(await chrome.runtime.sendMessage({ type: "health" })); };
  useEffect(() => { test(); }, [settings.helperMode, settings.localUrl]);
  return (
    <section id="service" class="section" aria-labelledby="svc-h">
      <h2 id="svc-h">Prism service</h2>
      <p>Prism's explanations, translations and chat use Google's Gemini AI through a small Prism service.</p>
      <div class="group">
        <div class="radio-list" role="radiogroup" aria-label="Prism service">
          <label class="pz-choice"><input type="radio" name="svc" disabled={!__PRISM_HOSTED_URL__} checked={settings.helperMode === "hosted"} onChange={() => update({ helperMode: "hosted" })} />
            <span><strong>Prism's online service</strong> (recommended)<br /><span class="pz-hint">{__PRISM_HOSTED_URL__ ? "Works straight away. Nothing to install." : "Not available in this build."}</span></span></label>
          <label class="pz-choice"><input type="radio" name="svc" checked={settings.helperMode === "local"} onChange={() => update({ helperMode: "local" })} />
            <span><strong>A helper on this computer</strong> (for developers)<br /><span class="pz-hint">Uses your own Google Cloud sign-in. See the README for setup.</span></span></label>
        </div>
        {settings.helperMode === "local" && (
          <label class="pz-field" for="local-url"><span>Helper address</span>
            <input id="local-url" class="pz-input" style="max-width:360px" value={settings.localUrl} onChange={(e) => update({ localUrl: (e.target as HTMLInputElement).value })} /></label>
        )}
        <div class="row">
          <button class="pz-btn pz-btn--small" type="button" onClick={test}>Check connection</button>
          {health === null ? <span class="pz-muted">Checking…</span> : health.ok
            ? <span style="color:var(--pz-ok);font-weight:700">Connected{health.model ? ` · AI model: ${health.model}` : ""}</span>
            : <span style="color:var(--pz-danger);font-weight:700">Not connected to {health.base}</span>}
        </div>
      </div>
      <p class="pz-hint">Prism {__PRISM_VERSION__}</p>
    </section>
  );
}

render(<Settings />, document.getElementById("app")!);
