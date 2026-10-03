// Measures contrast from actual screen pixels (works for :visited links, which scripts can't inspect).
import type { BrowserContext, Locator } from "@playwright/test";

export async function pixelContrast(context: BrowserContext, target: Locator): Promise<{ ratio: number; bg: string; fg: string }> {
  // Sample only the inside of the element (skip borders/shadows, which aren't text).
  const box = (await target.boundingBox())!;
  const inset = await target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return Math.max(4, parseFloat(cs.borderTopWidth) + 3, parseFloat(cs.borderLeftWidth) + 3);
  });
  const png = await target.page().screenshot({ animations: "disabled", clip: { x: box.x + inset, y: box.y + inset, width: Math.max(4, box.width - inset * 2), height: Math.max(4, box.height - inset * 2) } });
  const scratch = await context.newPage();
  try {
    await scratch.setContent("<canvas id=c></canvas>");
    return await scratch.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.getElementById("c") as HTMLCanvasElement;
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const counts = new Map<number, number>();
      for (let i = 0; i < data.length; i += 4) {
        const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const total = data.length / 4;
      const toRgb = (k: number) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4];
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const bg = toRgb(sorted[0][0]);
      let best = 1, fg = bg;
      for (const [k, n] of sorted) {
        if (n / total < 0.004) break;
        const rgb = toRgb(k);
        const l1 = lum(rgb), l2 = lum(bg);
        const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (r > best) { best = r; fg = rgb; }
      }
      return { ratio: Math.round(best * 100) / 100, bg: `rgb(${bg})`, fg: `rgb(${fg})` };
    }, png.toString("base64"));
  } finally {
    await scratch.close();
  }
}
