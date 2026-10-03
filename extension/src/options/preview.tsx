/** A tiny live sample of a Style, drawn from its real tokens. */
import type { StyleTokens } from "../shared/styles";

export function MiniPreview({ t }: { t: StyleTokens }) {
  return (
    <div class="mini" aria-hidden="true" style={`background:${t.bg};color:${t.text};font-family:${t.fontBody}`}>
      <div class="mini__h" style={`font-family:${t.fontHeading};font-weight:${t.headingWeight};box-shadow:${t.headingAccent === "none" ? "none" : "inset 0 -0.3em 0 #A7F0CF"}`}>Council tax help</div>
      <div class="mini__p" style={`color:${t.muted}`}>You may pay less if you live alone or have a low income.</div>
      <div style={`background:${t.noticeBg};border:${t.noticeBorder};border-left:${t.noticeLeft};padding:6px 8px;font-size:12px;border-radius:${t.radiusControl};box-shadow:${t.noticeShadow}`}>Apply within 1 month</div>
      <div class="mini__row">
        <span class="mini__field" style={`background:${t.field};border:${t.controlWidth} solid ${t.control};border-radius:${t.radiusControl};box-shadow:${t.fieldShadow}`} />
        <span class="mini__btn" style={`background:${t.primary};color:${t.onPrimary};border:${t.controlWidth} solid ${t.primaryBorder};border-radius:${t.radiusControl};box-shadow:${t.primaryShadow}`}>Apply now</span>
      </div>
    </div>
  );
}
