document.getElementById('b').addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ type: 'ping' });
  document.getElementById('out').textContent = 'reply: ' + r.pong;
});
