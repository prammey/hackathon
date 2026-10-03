// Fixture behaviour: "controlled" fields (like React) only update their state from real input events,
// inline validation, an error summary, and a continue step that stores answers in sessionStorage.
(function () {
  const state = {};
  const form = document.getElementById("step1");
  window.__fixture = { state, submits: 0, continues: 0 };

  form.addEventListener("input", (e) => { state[e.target.name] = e.target.type === "checkbox" ? collectChecks(e.target.name) : e.target.value; });
  form.addEventListener("change", (e) => {
    if (e.target.type === "radio") state[e.target.name] = e.target.value;
    if (e.target.type === "checkbox") state[e.target.name] = collectChecks(e.target.name);
    if (e.target.multiple) state[e.target.name] = [...e.target.selectedOptions].map((o) => o.value);
    if (e.target.tagName === "SELECT" && !e.target.multiple) state[e.target.name] = e.target.value;
  });

  function collectChecks(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((c) => c.value);
  }

  function setError(id, message) {
    const input = document.getElementById(id);
    const err = document.getElementById(`${id}-error`);
    if (message) { input.setAttribute("aria-invalid", "true"); if (err) err.textContent = message; }
    else { input.removeAttribute("aria-invalid"); if (err) err.textContent = ""; }
    return message ? { id, message } : null;
  }

  function validate() {
    const errors = [
      setError("full-name", state.fullName ? "" : "Enter your full name"),
      setError("dob", state.dob ? "" : "Enter your date of birth"),
      setError("postcode", /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}$/.test(state.postcode || "") ? "" : "Enter a real postcode, like AB1 2CD"),
    ].filter(Boolean);
    const summary = document.getElementById("error-summary");
    const list = document.getElementById("error-list");
    list.innerHTML = errors.map((e) => `<li><a href="#${e.id}">${e.message}</a></li>`).join("");
    summary.style.display = errors.length ? "block" : "none";
    return errors;
  }

  for (const id of ["full-name", "postcode"]) document.getElementById(id).addEventListener("blur", () => {
    if (id === "postcode" && state.postcode) validate();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    window.__fixture.submits++;
    const errors = validate();
    if (errors.length) { document.getElementById("error-summary").focus(); return; }
    window.__fixture.continues++;
    sessionStorage.setItem("step1", JSON.stringify(state));
    location.href = "step2.html";
  });
})();
