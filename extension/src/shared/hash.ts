/** FNV-1a 32-bit hash, base36. Deterministic and fast; not for security. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const QUERY_KEYS_WITH_VALUES = new Set(["page", "p", "tab", "step", "section", "view", "lang", "hl"]);

/** Page identity for caching: numeric/uuid path segments and most query values are dropped. */
export function pageKeyFor(href: string): string {
  const url = new URL(href);
  const path = url.pathname
    .split("/")
    .map((seg) =>
      /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^[0-9a-f]{16,}$/i.test(seg) ? ":id" : seg,
    )
    .join("/");
  const keys = [...url.searchParams.keys()].sort();
  const query = keys
    .map((k) => (QUERY_KEYS_WITH_VALUES.has(k.toLowerCase()) ? `${k}=${url.searchParams.get(k)}` : k))
    .join("&");
  return `${url.origin}${path}${query ? `?${query}` : ""}`;
}
