/**
 * The welcome page. Inside the extension it's shown once after installing; the same page is also the
 * public website (site/main.tsx), where `web` swaps extension-only actions for links to the install steps.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, saveSettings } from "../shared/storage";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { StyleId } from "../shared/types";
import { allowMicrophone, Brand, Icon, isMac } from "../ui/components";
import { MiniPreview } from "../options/preview";

/** Hard-to-use but important real websites that Prism visibly improves (checked October 2026). */
const DEMO_SITES = [
  { name: "Illinois Human Services", what: "Cash, food and medical help", kind: "Benefits", url: "https://www.dhs.state.il.us/page.aspx?item=29719" },
  { name: "Mississippi Medicaid", what: "Apply for Medicaid", kind: "Healthcare", url: "https://medicaid.ms.gov/" },
  { name: "craigslist", what: "Local classifieds, jobs and housing", kind: "Classifieds", url: "https://www.craigslist.org/" },
  { name: "Berkshire Hathaway", what: "Company reports and letters", kind: "Investing", url: "https://www.berkshirehathaway.com/" },
  { name: "Cook County Court Clerk", what: "Court services and records", kind: "Courts", url: "https://www.cookcountyclerkofcourt.org/" },
  { name: "California EDD", what: "Unemployment benefits", kind: "Benefits", url: "https://edd.ca.gov/en/unemployment/" },
  { name: "Indian Health Service", what: "Federal health program", kind: "Healthcare", url: "https://www.ihs.gov/" },
  { name: "TRICARE", what: "Military health insurance", kind: "Insurance", url: "https://www.tricare.mil/" },
  { name: "Indiana FSSA", what: "Medicaid, SNAP and family help", kind: "Benefits", url: "https://www.in.gov/fssa/" },
  { name: "Social Security POMS", what: "How benefit claims are decided", kind: "Social Security", url: "https://secure.ssa.gov/poms.nsf/home!readform" },
  { name: "OPM Retirement Center", what: "Federal retirement", kind: "Retirement", url: "https://www.opm.gov/retirement-center/" },
  { name: "Social Security Actuaries", what: "Benefit calculators and data", kind: "Social Security", url: "https://www.ssa.gov/oact/" },
];

type Choices = { styleId: StyleId; dictation: boolean };

export function Welcome(props: { web?: boolean; top?: ComponentChildren; bottom?: ComponentChildren }) {
  const { web } = props;
  const [settings, setChoices] = useState<Choices | null>(web ? { styleId: "soft", dictation: false } : null);
  const [talkProblem, setTalkProblem] = useState("");
  useEffect(() => { if (!web) getSettings().then((s) => { setChoices(s); saveSettings({ onboarded: true }); }); }, []);
  if (!settings) return null;
  // On the website there's nothing to save to, so choices only change what's shown.
  const choose = async (patch: Partial<Choices>) => setChoices(web ? { ...settings, ...patch } : await saveSettings(patch));
  const extLink = (href: string) => (web ? "#install" : href);
  const key = isMac() ? "Option ⌥" : "Alt";
  return (
    <main class="page" style="max-width:960px">
      <section class="welcome-hero" aria-labelledby="w-h">
        {props.top ? <div class="hero-top"><Brand size={44} />{props.top}</div> : <Brand size={44} />}
        <h1 id="w-h">Websites, made <em>calm</em> and clear.</h1>
        <p>Prism tidies cluttered websites so they're easier to read, explains anything you point at in plain words, and helps you fill in forms — always asking before anything important happens.</p>
        <p>No setup needed.</p>
        <div class="practice" aria-labelledby="try-h">
          <h2 id="try-h" class="practice__title"><Icon name="sparkle" /> Practice websites</h2>
          <p class="practice__hint">Open one, then click the Prism button and turn on <strong>Tidy this page</strong>.</p>
          <ul class="demo-sites" data-testid="demo-sites">
            {DEMO_SITES.map((site) => (
              <li><a class="demo-site" href={site.url} target="_blank" rel="noopener" title={`${site.kind}: ${site.what}`}>{site.name}</a></li>
            ))}
          </ul>
        </div>
      </section>

      <section class="section" aria-labelledby="how-h">
        <h2 id="how-h">How to use Prism</h2>
        <div class="steps-big">
          <div class="step-card"><span class="step-num">1</span><b>Tidy a page</b>
            <span>Click the Prism button <img src="icons/icon-32.png" alt="" width="20" height="20" style="vertical-align:middle" /> in your browser's toolbar, then turn on <strong>Tidy this page</strong>.</span>
            <span class="pz-hint">Can't see it? Click the jigsaw-piece icon and pin Prism.</span></div>
          <div class="step-card"><span class="step-num">2</span><b>Point at anything</b>
            <span>Hold <strong>{key}</strong> and drag a box around something confusing. Choose <strong>Define</strong>, <strong>Translate</strong>, <strong>Fill out</strong> or <strong>Chat</strong>.</span>
            <span class="pz-hint">Or use the Prism button → Point at something.</span></div>
          <div class="step-card"><span class="step-num">3</span><b>Go back any time</b>
            <span><strong>Refresh</strong> <span class="kbd-icon" role="img" aria-label="refresh button"><Icon name="restore" /></span> the page, or switch off <strong>Tidy this page</strong>, to see the website exactly as it was.</span>
            <span class="pz-hint">Nothing on the website is deleted.</span></div>
        </div>
      </section>

      <section class="section" aria-labelledby="style-h">
        <h2 id="style-h">Pick a style (you can change it later)</h2>
        <div class="style-cards" role="radiogroup" aria-label="Style">
          {STYLE_ORDER.map((id) => (
            <button type="button" class="style-card" role="radio" aria-checked={settings.styleId === id} aria-pressed={settings.styleId === id}
              onClick={() => choose({ styleId: id })}>
              <MiniPreview t={STYLES[id]} />
              <span class="style-card__name">{STYLES[id].name}{settings.styleId === id && <span class="pz-label" style="color:var(--pz-violet)"><Icon name="check" /> Chosen</span>}</span>
              <span class="style-card__tag">{STYLES[id].tagline}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="next-h">
        <h2 id="next-h">Never lose your place</h2>
        <div class="feature">
          <div class="feature__demo" aria-hidden="true">
            <div class="demo-page">
              <span class="demo-line" /><span class="demo-line demo-line--short" />
              <span class="demo-cta">Start your application →</span>
              <span class="demo-line" />
            </div>
            <div class="demo-dock"><span class="demo-dock__label">NEXT STEP</span><span>Start your application</span><span class="demo-dock__btn">Show me</span></div>
          </div>
          <div class="feature__text">
            <p><strong>Prism always shows you what to do next.</strong> On every tidied page, the most important next step gets a gently breathing outline so your eyes go straight to it.</p>
            <p>The <strong>Next step</strong> bar in the bottom-left corner names it too — press <strong>Show me</strong> and Prism takes you right there.</p>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="talk-h">
        <h2 id="talk-h">Talk instead of typing</h2>
        <p>Press <strong>Talk</strong> next to any box — on websites, in Chat, anywhere Prism helps — and say what you want to write.</p>
        <div class="row">
          {settings.dictation
            ? <span class="pz-label" style="color:var(--pz-violet)" data-testid="talk-on"><Icon name="check" /> Talking is turned on</span>
            : web
              ? <a class="pz-btn pz-btn--primary" href="#install"><Icon name="mic" /> Turn on talking</a>
              : <button class="pz-btn pz-btn--primary" type="button" data-testid="talk-allow" onClick={async () => {
                  const error = await allowMicrophone();
                  if (error) setTalkProblem(error);
                  else choose({ dictation: true });
                }}><Icon name="mic" /> Turn on talking</button>}
        </div>
        {talkProblem && <p class="pz-hint" role="alert">{talkProblem}</p>}
      </section>

      <section class="section" aria-labelledby="you-h">
        <h2 id="you-h">Want more personal help?</h2>
        <p>Tell Prism a little about yourself — like your name, language and what you're trying to do — and it can explain things your way and suggest answers for forms. It's optional and stays on this computer.</p>
        <div class="row">
          <a class="pz-btn" href={extLink("options.html#about")}><Icon name="person" /> Tell Prism about you</a>
          <a class="pz-btn pz-btn--quiet" href={extLink("options.html#import")}>Import from ChatGPT or Claude</a>
        </div>
      </section>

      <section class="section" aria-labelledby="priv-h">
        <h2 id="priv-h">Your privacy</h2>
        <p>Prism can see the websites you choose to tidy or ask about, so it can help with them. When you ask for help, only what's needed is sent to Google's Gemini AI. Prism never sends passwords or card details, and never sends a form without asking you. <a href={extLink("options.html#privacy")}>Read more</a>.</p>
        <p class="pz-hint">To limit which websites Prism can use, right-click the Prism button and choose “This can read and change site data”.</p>
      </section>
      {props.bottom}
    </main>
  );
}
