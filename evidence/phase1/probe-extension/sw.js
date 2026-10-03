chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'ping') reply({ pong: 'ok' });
  if (msg.type === 'capture') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then(url => reply({ ok: true, bytes: url.length }))
      .catch(e => reply({ ok: false, error: String(e) }));
    return true;
  }
});
