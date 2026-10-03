/** The public Prism website: the welcome page plus an Install button and install steps. */
import { render } from "preact";
import { useState } from "preact/hooks";
import { Icon } from "../ui/components";
import { Welcome } from "../welcome/Welcome";

function InstallSteps() {
  const [copied, setCopied] = useState(false);
  return (
    <section id="install" class="section" aria-labelledby="install-h">
      <h2 id="install-h">Install Prism</h2>
      <p>Less than a minute in Google Chrome. Free, and no account needed.</p>
      <ol class="steps-big install-steps">
        <li class="step-card"><span class="step-num">1</span><b>Download Prism</b>
          <a class="pz-btn pz-btn--primary" href="Prism.zip" download data-testid="download"><Icon name="download" /> Download</a>
          <span class="pz-hint">Double-click the file to unzip it. You'll get a folder called <strong>Prism</strong>.</span></li>
        <li class="step-card"><span class="step-num">2</span><b>Open Chrome's extensions page</b>
          <span class="copy-url"><code>chrome://extensions</code>
            <button class="pz-btn pz-btn--small" type="button" onClick={async () => { await navigator.clipboard.writeText("chrome://extensions"); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></span>
          <span class="pz-hint">Paste it into the address bar and press Enter.</span></li>
        <li class="step-card"><span class="step-num">3</span><b>Turn on Developer mode</b>
          <span>Switch it on in the <strong>top-right corner</strong> of that page.</span></li>
        <li class="step-card"><span class="step-num">4</span><b>Add Prism to Chrome</b>
          <span>Click <strong>Load unpacked</strong> and choose the <strong>prism-extension</strong> folder inside it.</span>
          <span class="pz-hint">Then click the jigsaw-piece icon and pin Prism.</span></li>
      </ol>
    </section>
  );
}

render(
  <Welcome web top={<a class="pz-btn pz-btn--primary install-top" href="#install" data-testid="install-top"><Icon name="download" /> Install Prism</a>} bottom={<InstallSteps />} />,
  document.getElementById("app")!,
);
