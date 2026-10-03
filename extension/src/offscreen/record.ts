/**
 * Offscreen recorder for dictation. Runs on Prism's own origin, where the person allowed the microphone
 * once, so talking works on every website without a new permission prompt.
 */
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let limit = 0;

async function start(): Promise<{ ok: boolean; error?: string }> {
  if (recorder) return { ok: true };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    return { ok: false, error: (err as Error).name === "NotAllowedError" ? "not-allowed" : "no-microphone" };
  }
  chunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.start(250);
  // Never record longer than a minute, even if nobody presses stop.
  limit = self.setTimeout(() => recorder?.stop(), 60_000);
  return { ok: true };
}

async function stop(): Promise<{ ok: boolean; audio?: string; mime?: string; error?: string }> {
  const rec = recorder;
  if (!rec) return { ok: false, error: "not-recording" };
  clearTimeout(limit);
  if (rec.state !== "inactive") {
    await new Promise<void>((resolve) => { rec.onstop = () => resolve(); rec.stop(); });
  }
  recorder = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  const blob = new Blob(chunks, { type: "audio/webm" });
  chunks = [];
  if (blob.size < 1200) return { ok: false, error: "too-short" };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { ok: true, audio: btoa(binary), mime: "audio/webm" };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== "offscreen") return false;
  (msg.type === "rec:start" ? start() : stop()).then(reply);
  return true;
});
