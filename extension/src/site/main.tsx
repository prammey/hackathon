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

render(
  <Welcome web top={<a class="pz-btn pz-btn--primary install-top" href="#install" data-testid="install-top"><Icon name="download" /> {t("Install Prism")}</a>} bottom={<InstallSteps />} />,
  document.getElementById("app")!,
);
