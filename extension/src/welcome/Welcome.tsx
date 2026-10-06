/**
 * The welcome page. Inside the extension it's shown once after installing; the same page is also the
 * public website (site/main.tsx), where `web` swaps extension-only actions for links to the install steps.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, saveSettings } from "../shared/storage";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { Settings, StyleId } from "../shared/types";
import { t, tj, k, UI_LANGUAGES } from "../shared/i18n";
import { allowMicrophone, Brand, Icon, isMac, useLanguage } from "../ui/components";
import { MiniPreview } from "../options/preview";

/** Hard-to-use but important real websites that Prism visibly improves (checked October 2026). */
const DEMO_SITES = [
  { name: "Illinois Human Services", what: k("Cash, food and medical help"), kind: k("Benefits"), url: "https://www.dhs.state.il.us/page.aspx?item=29719" },
  { name: "Mississippi Medicaid", what: k("Apply for Medicaid"), kind: k("Healthcare"), url: "https://medicaid.ms.gov/" },
  { name: "craigslist", what: k("Local classifieds, jobs and housing"), kind: k("Classifieds"), url: "https://www.craigslist.org/" },
  { name: "Berkshire Hathaway", what: k("Company reports and letters"), kind: k("Investing"), url: "https://www.berkshirehathaway.com/" },
  { name: "Cook County Court Clerk", what: k("Court services and records"), kind: k("Courts"), url: "https://www.cookcountyclerkofcourt.org/" },
  { name: "California EDD", what: k("Unemployment benefits"), kind: k("Benefits"), url: "https://edd.ca.gov/en/unemployment/" },
  { name: "Indian Health Service", what: k("Federal health program"), kind: k("Healthcare"), url: "https://www.ihs.gov/" },
  { name: "TRICARE", what: k("Military health insurance"), kind: k("Insurance"), url: "https://www.tricare.mil/" },
  { name: "Indiana FSSA", what: k("Medicaid, SNAP and family help"), kind: k("Benefits"), url: "https://www.in.gov/fssa/" },
  { name: "Social Security POMS", what: k("How benefit claims are decided"), kind: k("Social Security"), url: "https://secure.ssa.gov/poms.nsf/home!readform" },
  { name: "OPM Retirement Center", what: k("Federal retirement"), kind: k("Retirement"), url: "https://www.opm.gov/retirement-center/" },
  { name: "Social Security Actuaries", what: k("Benefit calculators and data"), kind: k("Social Security"), url: "https://www.ssa.gov/oact/" },
];

type Choices = { styleId: StyleId; dictation: boolean; languageChosen?: boolean; textScale?: Settings["textScale"] };

/** First thing a new person sees: their language, in their language. */
function LanguagePicker({ onPick }: { onPick: (english: string) => void }) {
  return (
    <main class="page lang-pick" style="max-width:960px" aria-labelledby="lang-pick-h">
      <Brand size={44} />
      <h1 id="lang-pick-h"><Icon name="globe" /> Choose your language</h1>
      <p class="lang-pick__sub">Elige tu idioma · Choisissez votre langue · 选择您的语言 · अपनी भाषा चुनें · اختر لغتك</p>
      <div class="lang-pick__grid">
        {UI_LANGUAGES.map((l) => (
          <button type="button" class="lang-pick__btn" lang={l.code} dir={l.rtl ? "rtl" : "ltr"} onClick={() => onPick(l.english)} data-lang={l.code}>
            <span class="lang-pick__native">{l.native}</span>
            {l.code !== "en" && <span class="lang-pick__english">{l.english}</span>}
          </button>
        ))}
      </div>
      <p class="pz-hint">You can change this later in Prism's settings.</p>
    </main>
  );
}

export function Welcome(props: { web?: boolean; top?: ComponentChildren; bottom?: ComponentChildren }) {
  useLanguage();
  const { web } = props;
  const [settings, setChoices] = useState<Choices | null>(web ? { styleId: "soft", dictation: false, textScale: 1 } : null);
  const [talkProblem, setTalkProblem] = useState("");
  useEffect(() => { if (!web) getSettings().then((s) => { setChoices(s); saveSettings({ onboarded: true }); }); }, []);
  // Choosing a text size shows it immediately, on the website too.
  useEffect(() => { if (web && settings) document.documentElement.style.zoom = String(settings.textScale ?? 1); }, [settings?.textScale]);
  if (!settings) return null;
  if (!web && !settings.languageChosen) {
    return <LanguagePicker onPick={async (english) => setChoices(await saveSettings({ translateTo: english, languageChosen: true }))} />;
  }
  // On the website there's nothing to save to, so choices only change what's shown.
  const choose = async (patch: Partial<Choices>) => setChoices(web ? { ...settings, ...patch } : await saveSettings(patch));
  const extLink = (href: string) => (web ? "#install" : href);
  const key = isMac() ? "Option ⌥" : "Alt";
  return (
    <main class="page" style="max-width:960px">
      <section class="welcome-hero" aria-labelledby="w-h">
        {props.top ? <div class="hero-top"><Brand size={44} />{props.top}</div> : <Brand size={44} />}
        <h1 id="w-h">{tj("Websites, made {calm} and clear.", { calm: <em>{t("calm")}</em> })}</h1>
        <p>{t("Prism tidies cluttered websites so they're easier to read, explains anything you point at in plain words, and helps you fill in forms — always asking before anything important happens.")}</p>
        {!web && <p>{t("No setup needed.")}</p>}
        <div class="practice" aria-labelledby="try-h">
          <h2 id="try-h" class="practice__title"><Icon name="sparkle" /> {t("Practice websites")}</h2>
          <p class="practice__hint">{tj("Open one, then click the Prism button and turn on {tidy}.", { tidy: <strong>{t("Tidy this page")}</strong> })}</p>
          <ul class="demo-sites" data-testid="demo-sites">
            {DEMO_SITES.map((site) => (
              <li><a class="demo-site" href={site.url} target="_blank" rel="noopener" title={`${t(site.kind)}: ${t(site.what)}`}>{site.name}</a></li>
            ))}
          </ul>
        </div>
      </section>

      <section class="section" aria-labelledby="how-h">
        <h2 id="how-h">{t("How to use Prism")}</h2>
        <div class="steps-big steps-big--four">
          <div class="step-card"><span class="step-num">1</span><b>{t("Get walked through a task")}</b>
            <span>{tj("Click the Prism button {icon} at the top right of Chrome, say or type what you want to do, and press {guide}. Prism lights up one thing at a time; you do the clicking.", {
              icon: <img src="icons/icon-32.png" alt="" width="20" height="20" style="vertical-align:middle" />,
              guide: <strong>{t("Guide me")}</strong>,
            })}</span>
            <span>{t("Can't see the Prism button? Click the puzzle-piece icon at the top right of Chrome, then the pin next to Prism.")}</span>
            <span class="pz-hint">{t("Works from a new, empty tab too.")}</span></div>
          <div class="step-card"><span class="step-num">2</span><b>{t("Tidy a page")}</b>
            <span>{tj("Click the Prism button {icon} at the top right of Chrome, then turn on {tidy}.", {
              icon: <img src="icons/icon-32.png" alt="" width="20" height="20" style="vertical-align:middle" />,
              tidy: <strong>{t("Tidy this page")}</strong>,
            })}</span>
</div>
          <div class="step-card"><span class="step-num">3</span><b>{t("Point at anything")}</b>
            <span>{tj("Hold {key} and drag a box around something confusing. Choose {define}, {translate}, {fill} or {chat}.", {
              key: <strong>{key}</strong>,
              define: <strong>{t("Define")}</strong>,
              translate: <strong>{t("Translate")}</strong>,
              fill: <strong>{t("Fill out")}</strong>,
              chat: <strong>{t("Chat")}</strong>,
            })}</span>
            <span class="pz-hint">{t("No steady hand needed: choose Point at something in the Prism button, then just click a paragraph or question.")}</span></div>
          <div class="step-card"><span class="step-num">4</span><b>{t("Go back any time")}</b>
            <span>{tj("{refresh} {icon} the page, or switch off {tidy}, to see the website exactly as it was.", {
              refresh: <strong>{t("Refresh")}</strong>,
              icon: <span class="kbd-icon" role="img" aria-label={t("refresh button")}><Icon name="restore" /></span>,
              tidy: <strong>{t("Tidy this page")}</strong>,
            })}</span>
            <span class="pz-hint">{t("Nothing on the website is deleted.")}</span></div>
        </div>
      </section>

      <section class="section" aria-labelledby="style-h">
        <h2 id="style-h">{t("Pick a style and text size (you can change them later)")}</h2>
        <div class="style-cards" role="radiogroup" aria-label={t("Style")}>
          {STYLE_ORDER.map((id) => (
            <button type="button" class="style-card" role="radio" aria-checked={settings.styleId === id} aria-pressed={settings.styleId === id}
              onClick={() => choose({ styleId: id })}>
              <MiniPreview t={STYLES[id]} />
              <span class="style-card__name">{STYLES[id].name}{settings.styleId === id && <span class="pz-label" style="color:var(--pz-violet)"><Icon name="check" /> {t("Chosen")}</span>}</span>
              <span class="style-card__tag">{t(STYLES[id].tagline)}</span>
            </button>
          ))}
        </div>
        <div class="text-size" role="radiogroup" aria-label={t("Text size")}>
          <span class="text-size__label">{t("Text size")}</span>
          {([1, 1.15, 1.3, 1.5] as const).map((v) => (
            <button type="button" class="text-size__btn" role="radio" aria-checked={(settings.textScale ?? 1) === v} onClick={() => choose({ textScale: v })}
              style={`font-size:${Math.round(16 * v)}px`}>{v === 1 ? t("Normal") : v === 1.15 ? t("Large") : v === 1.3 ? t("Larger") : t("Largest")}</button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="next-h">
        <h2 id="next-h">{t("Never lose your place")}</h2>
        <div class="feature">
          <div class="feature__demo" aria-hidden="true">
            <div class="demo-page">
              <span class="demo-line" /><span class="demo-line demo-line--short" />
              <span class="demo-cta">{t("Start your application →")}</span>
              <span class="demo-line" />
            </div>
            <div class="demo-dock"><span class="demo-dock__label">{t("NEXT STEP")}</span><span>{t("Start your application")}</span><span class="demo-dock__btn">{t("Show me")}</span></div>
          </div>
          <div class="feature__text">
            <p>{tj("{lead} On every tidied page, the most important next step gets a gently breathing outline so your eyes go straight to it.", { lead: <strong>{t("Prism always shows you what to do next.")}</strong> })}</p>
            <p>{tj("The {nextStep} bar in the bottom-left corner names it too — press {showMe} and Prism takes you right there.", { nextStep: <strong>{t("Next step")}</strong>, showMe: <strong>{t("Show me")}</strong> })}</p>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="talk-h">
        <h2 id="talk-h">{t("Talk instead of typing")}</h2>
        <p>{tj("Press {talk} next to any box — on websites, in Chat, anywhere Prism helps — and say what you want to write.", { talk: <strong>{t("Talk")}</strong> })}</p>
        <div class="row">
          {settings.dictation
            ? <span class="pz-label" style="color:var(--pz-violet)" data-testid="talk-on"><Icon name="check" /> {t("Talking is turned on")}</span>
            : web
              ? <a class="pz-btn pz-btn--primary" href="#install"><Icon name="mic" /> {t("Turn on talking")}</a>
              : <button class="pz-btn pz-btn--primary" type="button" data-testid="talk-allow" onClick={async () => {
                  const error = await allowMicrophone();
                  if (error) setTalkProblem(error);
                  else choose({ dictation: true });
                }}><Icon name="mic" /> {t("Turn on talking")}</button>}
        </div>
        {talkProblem && <p class="pz-hint" role="alert">{talkProblem}</p>}
      </section>

      <section class="section" aria-labelledby="you-h">
        <h2 id="you-h">{t("Want more personal help?")}</h2>
        <p>{t("Tell Prism a little about yourself — like your name, language and what you're trying to do — and it can explain things your way and suggest answers for forms. It's optional and stays on this computer.")}</p>
        <div class="row">
          <a class="pz-btn" href={extLink("options.html#about")}><Icon name="person" /> {t("Tell Prism about you")}</a>
          <a class="pz-btn pz-btn--quiet" href={extLink("options.html#import")}>{t("Import from ChatGPT or Claude")}</a>
        </div>
      </section>

      <section class="section" aria-labelledby="priv-h">
        <h2 id="priv-h">{t("Your privacy")}</h2>
        <p>{tj("Prism can see the websites you choose to tidy or ask about, so it can help with them. When you ask for help, only what's needed is sent to Google's Gemini AI. Prism never sends passwords or card details, and never sends a form without asking you. {readMore}.", { readMore: <a href={web ? "privacy.html" : "options.html#privacy"}>{t("Read more")}</a> })}</p>
        <p class="pz-hint">{t("To limit which websites Prism can use, right-click the Prism button and choose “This can read and change site data”.")}</p>
      </section>
      {props.bottom}
    </main>
  );
}
