/** Welcome page shown once after installing. Nothing here is required. */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getSettings, saveSettings } from "../shared/storage";
import { STYLE_ORDER, STYLES } from "../shared/styles";
import type { Settings } from "../shared/types";
import { Brand, Icon, isMac } from "../ui/components";
import { MiniPreview } from "../options/preview";

function Welcome() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { getSettings().then((s) => { setSettings(s); saveSettings({ onboarded: true }); }); }, []);
  if (!settings) return null;
  const key = isMac() ? "Option ⌥" : "Alt";
  const demo = __PRISM_HOSTED_URL__ ? `${__PRISM_HOSTED_URL__}/demo/cluttered-info/` : "";
  return (
    <main class="page" style="max-width:960px">
      <section class="welcome-hero" aria-labelledby="w-h">
        <Brand size={44} />
        <h1 id="w-h">Websites, made <em>calm</em> and clear.</h1>
        <p>Prism tidies cluttered websites so they're easier to read, explains anything you point at in plain words, and helps you fill in forms — always asking before anything important happens.</p>
        <p><strong>You don't need to set anything up.</strong> Everything below is optional.</p>
        {demo && (
          <div class="row">
            <a class="pz-btn pz-btn--primary" href={demo} target="_blank" rel="noopener" data-testid="try-demo"><Icon name="sparkle" /> Try it on a practice page</a>
            <span class="pz-hint">A made-up council page, safe to experiment on.</span>
          </div>
        )}
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
            <span>Press <strong>Show original page</strong> to see the website exactly as it was. Nothing on the website is deleted.</span></div>
        </div>
      </section>

      <section class="section" aria-labelledby="style-h">
        <h2 id="style-h">Pick a style (you can change it later)</h2>
        <div class="style-cards" role="radiogroup" aria-label="Style">
          {STYLE_ORDER.map((id) => (
            <button type="button" class="style-card" role="radio" aria-checked={settings.styleId === id} aria-pressed={settings.styleId === id}
              onClick={async () => setSettings(await saveSettings({ styleId: id }))}>
              <MiniPreview t={STYLES[id]} />
              <span class="style-card__name">{STYLES[id].name}{settings.styleId === id && <span class="pz-label" style="color:var(--pz-violet)"><Icon name="check" /> Chosen</span>}</span>
              <span class="style-card__tag">{STYLES[id].tagline}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="section" aria-labelledby="you-h">
        <h2 id="you-h">Want more personal help?</h2>
        <p>Tell Prism a little about yourself — like your name, language and what you're trying to do — and it can explain things your way and suggest answers for forms. It's optional and stays on this computer.</p>
        <div class="row">
          <a class="pz-btn" href="options.html#about"><Icon name="person" /> Tell Prism about you</a>
          <a class="pz-btn pz-btn--quiet" href="options.html#import">Import from ChatGPT or Claude</a>
        </div>
      </section>

      <section class="section" aria-labelledby="priv-h">
        <h2 id="priv-h">Your privacy</h2>
        <p>Prism can see the websites you choose to tidy or ask about, so it can help with them. When you ask for help, only what's needed is sent to Google's Gemini AI. Prism never sends passwords or card details, and never sends a form without asking you. <a href="options.html#privacy">Read more</a>.</p>
        <p class="pz-hint">To limit which websites Prism can use, right-click the Prism button and choose “This can read and change site data”.</p>
      </section>
    </main>
  );
}

render(<Welcome />, document.getElementById("app")!);
