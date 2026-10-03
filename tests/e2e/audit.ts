import type { Page } from "@playwright/test";

/** Independent audit (not Prism's own code): all elements with their own visible text. */
export async function auditAllForTests(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bgOf = (el: Element | null): { r: number; g: number; b: number } | null => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage.includes("url(")) return null;
        const c = parse(cs.backgroundColor);
        if (c.a > 0.5) return c;
      }
      const h = parse(getComputedStyle(document.documentElement).backgroundColor);
      return h.a > 0.5 ? h : { r: 255, g: 255, b: 255 };
    };
    const fails: string[] = [];
    let checked = 0;
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("prism-root,prism-fold,svg")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || cs.visibility === "hidden" || el.closest("[data-prism-collapsed]:not([data-prism-open])")) continue;
      if ([...document.querySelectorAll("*")].length && getComputedStyle(el).display === "none") continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const fg = parse(cs.color);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      checked++;
      const size = parseFloat(cs.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio < need) fails.push(`${el.tagName}.${el.className} "${(el as HTMLElement).innerText.slice(0, 40)}" ${ratio.toFixed(2)}`);
    }
    return { checked, fails };
  });
}

