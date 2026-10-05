/** The public Prism website: the welcome page plus an Install button and install steps. */
import { render } from "preact";
import { useState } from "preact/hooks";
import { t, tj } from "../shared/i18n";
import { Icon, useLanguage } from "../ui/components";
import { Welcome } from "../welcome/Welcome";

function InstallSteps() {
  useLanguage();
  const [copied, setCopied] = useState(false);
  return (
    <section id="install" class="section" aria-labelledby="install-h">
      <h2 id="install-h">{t("Install Prism")}</h2>
      <p>{t("Less than a minute in Google Chrome. Free, and no account needed.")}</p>
      <ol class="steps-big install-steps">
        <li class="step-card"><span class="step-num">1</span><b>{t("Download Prism")}</b>
          <a class="pz-btn pz-btn--primary" href="Prism.zip" download data-testid="download"><Icon name="download" /> {t("Download")}</a>
          <span class="pz-hint">{tj("Double-click the file to unzip it. You'll get a folder called {folder}.", { folder: <strong>Prism</strong> })}</span></li>
        <li class="step-card"><span class="step-num">2</span><b>{t("Open Chrome's extensions page")}</b>
          <span class="copy-url"><code>chrome://extensions</code>
            <button class="pz-btn pz-btn--small" type="button" onClick={async () => { await navigator.clipboard.writeText("chrome://extensions"); setCopied(true); }}>{copied ? t("Copied") : t("Copy")}</button></span>
          <span class="pz-hint">{t("Paste it into the address bar and press Enter.")}</span></li>
        <li class="step-card"><span class="step-num">3</span><b>{t("Turn on Developer mode")}</b>
          <span>{tj("Switch it on in the {corner} of that page.", { corner: <strong>{t("top-right corner")}</strong> })}</span></li>
        <li class="step-card"><span class="step-num">4</span><b>{t("Add Prism to Chrome")}</b>
          <span>{tj("Click {loadUnpacked} and choose the {folder} folder inside it.", { loadUnpacked: <strong>{t("Load unpacked")}</strong>, folder: <strong>prism-extension</strong> })}</span>
          <span class="pz-hint">{t("Then click the jigsaw-piece icon and pin Prism.")}</span></li>
      </ol>
    </section>
  );
}

/** A quiet square link to the source code, in the corner. */
function GitHubLink() {
  useLanguage();
  const label = t("Prism's code on GitHub");
  return (
    <a class="pz-btn gh-btn" href="https://github.com/prammey/hackathon" rel="noopener" aria-label={label} title={label} data-testid="github">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56l-.02-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14l-.01 3.18c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
      </svg>
    </a>
  );
}

render(
  <Welcome web bottom={<InstallSteps />} top={
    <div class="hero-end">
      <div class="hero-actions">
        <a class="pz-btn pz-btn--primary install-top" href="#install" data-testid="install-top"><Icon name="download" /> {t("Install Prism")}</a>
        <a class="pz-btn install-top" href="how-its-built.html" data-testid="how-built"><Icon name="code" /> {t("How it's built")}</a>
      </div>
      <GitHubLink />
    </div>
  } />,
  document.getElementById("app")!,
);
