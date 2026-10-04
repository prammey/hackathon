/** Visible-tab capture, cropped to the selected region at the device pixel scale. */
import { t } from "../shared/i18n";
import type { Rect, Result } from "../shared/types";

let lastCapture = 0;

export async function captureRegion(
  windowId: number, rect: Rect | null, viewportWidth: number, maxEdge = 1600,
): Promise<Result<{ image: string; mime: "image/jpeg"; width: number; height: number }>> {
  // Chrome allows at most 2 captures per second.
  const wait = 550 - (Date.now() - lastCapture);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCapture = Date.now();
  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  } catch (err) {
    return {
      ok: false,
      error: { code: "capture_blocked", message: t("Prism can't take a picture of this page. The browser may be protecting it.") },
    };
  }
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  // Captured pixels per CSS pixel: covers devicePixelRatio and page zoom together.
  const scale = bitmap.width / Math.max(1, viewportWidth);
  const src = rect
    ? {
        x: Math.max(0, Math.round(rect.x * scale)),
        y: Math.max(0, Math.round(rect.y * scale)),
        w: Math.round(rect.width * scale),
        h: Math.round(rect.height * scale),
      }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  src.w = Math.max(1, Math.min(src.w, bitmap.width - src.x));
  src.h = Math.max(1, Math.min(src.h, bitmap.height - src.y));
  const shrink = Math.min(1, maxEdge / Math.max(src.w, src.h));
  const outW = Math.max(1, Math.round(src.w * shrink));
  const outH = Math.max(1, Math.round(src.h * shrink));
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: { code: "unknown", message: t("Prism couldn't process the picture.") } };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(bitmap, src.x, src.y, src.w, src.h, 0, 0, outW, outH);
  bitmap.close();
  const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { ok: true, value: { image: btoa(binary), mime: "image/jpeg", width: outW, height: outH } };
}
