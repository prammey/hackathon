// A tiny client-rendered app: pushState routing, a live clock, and a feed that keeps growing.
(function () {
  const root = document.getElementById("root");
  window.__fixture = { renders: 0, feedItems: 0 };
  const base = location.pathname.slice(0, location.pathname.indexOf("/dynamic-app/") + "/dynamic-app/".length);
  const routes = { [base]: home, [`${base}report`]: report, [`${base}help`]: help };

  function shell(inner) {
    const path = location.pathname;
    const link = (href, label) => `<a href="${href}" data-link class="${path === href ? "active" : ""}">${label}</a>`;
    return `<div id="app-bar">${link(base, "My collections")}${link(`${base}report`, "Report a missed bin")}${link(`${base}help`, "Help")}<span id="clock"></span></div><main id="view">${inner}</main>`;
  }

  function home() {
    return `<h1 style="color:#e5e7eb;font-size:18px">Your bin collections</h1>
      <div class="card"><h3>Black bin (general waste)</h3><p>Next collection: Tuesday 7 October</p><span class="pill">On schedule</span></div>
      <div class="card"><h3>Blue bin (recycling)</h3><p>Next collection: Tuesday 14 October</p><span class="pill">On schedule</span></div>
      <div class="card"><h3>Brown bin (garden waste)</h3><p>Subscription needed. <a href="${base}report" data-link style="color:#93c5fd">Subscribe or report a problem</a></p></div>
      <h2 style="color:#d1d5db;font-size:14px">Live service updates</h2>
      <div id="feed" aria-live="off"></div>`;
  }

  function report() {
    return `<h1 style="color:#e5e7eb;font-size:18px">Report a missed bin</h1>
      <form id="report-form" class="card" onsubmit="event.preventDefault();document.getElementById('report-status').textContent='Thanks — report MB-' + Math.floor(Math.random()*9000+1000) + ' received.'">
        <label for="addr">Your address</label><br><input id="addr" name="addr" style="width:60%"><br>
        <label for="bin">Which bin was missed?</label><br>
        <select id="bin" name="bin"><option value="">Choose</option><option>Black bin</option><option>Blue bin</option><option>Brown bin</option></select><br><br>
        <button type="submit">Send report</button>
        <p id="report-status" role="status"></p>
      </form>`;
  }

  function help() {
    return `<h1 style="color:#e5e7eb;font-size:18px">Help</h1><div class="card"><p>Put bins out by 7am on collection day. Lids must be closed.</p></div>`;
  }

  function render() {
    window.__fixture.renders++;
    const page = routes[location.pathname] ?? home;
    root.innerHTML = shell(page());
    tick();
  }

  function tick() {
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = new Date().toLocaleTimeString();
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]");
    if (!a) return;
    e.preventDefault();
    history.pushState({}, "", a.getAttribute("href"));
    render();
  });
  addEventListener("popstate", render);

  setInterval(tick, 1000);
  setInterval(() => {
    const feed = document.getElementById("feed");
    if (!feed) return;
    window.__fixture.feedItems++;
    const item = document.createElement("div");
    item.className = "feed-item";
    item.textContent = `${new Date().toLocaleTimeString()} — Round ${(window.__fixture.feedItems % 12) + 1} collections completed in Ashbridge North.`;
    feed.prepend(item);
    if (feed.children.length > 20) feed.lastElementChild.remove();
  }, 1500);

  render();
})();
