document.documentElement.dataset.prismProbe = 'loaded';
let held = false, start = null;
const log = (m) => { (window.__probeLog ||= []).push(m); document.documentElement.dataset.probeLog = JSON.stringify(window.__probeLog); };
addEventListener('keydown', e => { if (e.key === 'Alt') { held = true; log('alt-down'); } }, true);
addEventListener('keyup', e => { if (e.key === 'Alt') { held = false; log('alt-up'); } }, true);
addEventListener('mousedown', e => { if (held) { start = [e.clientX, e.clientY]; e.preventDefault(); e.stopPropagation(); log('drag-start'); } }, true);
addEventListener('click', e => { if (start) { e.preventDefault(); e.stopImmediatePropagation(); log('click-suppressed'); } }, true);
addEventListener('mouseup', async e => {
  if (!start) return;
  log(`rect ${start[0]},${start[1]} -> ${e.clientX},${e.clientY}`);
  const r = await chrome.runtime.sendMessage({ type: 'capture' });
  log('capture ' + JSON.stringify(r));
  setTimeout(() => { start = null; }, 0);
}, true);
