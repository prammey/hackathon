"""WCAG 2.x contrast check for the Prism design tokens in specs/03-design-system.md.

Text pairs need 4.5:1; UI boundaries (control borders, focus rings) need 3:1 against their background.
Run: python3 scripts/contrast_check.py
"""
import sys

# (label, foreground, background, minimum ratio)
PAIRS = {
  "Prism brand": [
    ("ink on paper", "#1B1F3B", "#FFFFFF", 4.5),
    ("ink-muted on paper", "#4A4F6A", "#FFFFFF", 4.5),
    ("ink-muted on mist", "#4A4F6A", "#F3F4FA", 4.5),
    ("white on violet button", "#FFFFFF", "#4B3FD1", 4.5),
    ("violet outline on white", "#4B3FD1", "#FFFFFF", 3.0),
    ("ok text", "#11704F", "#FFFFFF", 4.5),
    ("warn text", "#8A4B00", "#FFFFFF", 4.5),
    ("danger text", "#B3261E", "#FFFFFF", 4.5),
  ],
  "Bold (neo-brutalist)": [
    ("text on bg", "#0F0F0F", "#FFF8E7", 4.5),
    ("muted on bg", "#333333", "#FFF8E7", 4.5),
    ("white on primary", "#FFFFFF", "#1F2EDB", 4.5),
    ("link on bg", "#1F2EDB", "#FFF8E7", 4.5),
    ("text on yellow block", "#0F0F0F", "#FFD43B", 4.5),
    ("text on mint block", "#0F0F0F", "#A7F0CF", 4.5),
    ("text on pink block", "#0F0F0F", "#FFC2D6", 4.5),
    ("danger on bg", "#B00020", "#FFF8E7", 4.5),
    ("success on bg", "#0B6B3A", "#FFF8E7", 4.5),
  ],
  "Calm (minimalist)": [
    ("text on bg", "#1C1C1E", "#FAFAF7", 4.5),
    ("muted on bg", "#56585E", "#FAFAF7", 4.5),
    ("muted on white", "#56585E", "#FFFFFF", 4.5),
    ("white on primary", "#FFFFFF", "#1E5E5A", 4.5),
    ("link on bg", "#1E5E5A", "#FAFAF7", 4.5),
    ("control border on white", "#8A8D93", "#FFFFFF", 3.0),
    ("danger on white", "#A8261B", "#FFFFFF", 4.5),
    ("success on white", "#1E6B3D", "#FFFFFF", 4.5),
  ],
  "Soft (neumorphism)": [
    ("text on bg", "#1D2433", "#E6EBF2", 4.5),
    ("muted on bg", "#465068", "#E6EBF2", 4.5),
    ("white on primary", "#FFFFFF", "#3550C8", 4.5),
    ("link on bg", "#2B44B0", "#E6EBF2", 4.5),
    ("control border on bg", "#6F7A90", "#E6EBF2", 3.0),
    ("focus ring on bg", "#1D2433", "#E6EBF2", 3.0),
    ("danger on bg", "#A3221A", "#E6EBF2", 4.5),
    ("success on bg", "#14663F", "#E6EBF2", 4.5),
  ],
  "Clear (flat)": [
    ("text on bg", "#17202A", "#FFFFFF", 4.5),
    ("muted on bg", "#4B5563", "#FFFFFF", 4.5),
    ("muted on surface", "#4B5563", "#F3F5F8", 4.5),
    ("white on primary", "#FFFFFF", "#0A5BD3", 4.5),
    ("link on bg", "#0A55C4", "#FFFFFF", 4.5),
    ("control border on bg", "#7C8794", "#FFFFFF", 3.0),
    ("danger on bg", "#C01F1F", "#FFFFFF", 4.5),
    ("success on bg", "#0E7A4E", "#FFFFFF", 4.5),
    ("warn on bg", "#8F5200", "#FFFFFF", 4.5),
    ("disabled text on surface", "#5B6270", "#F3F5F8", 4.5),
  ],
}


def luminance(hex_color):
  channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
  linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(fg, bg):
  lighter, darker = sorted((luminance(fg), luminance(bg)), reverse=True)
  return (lighter + 0.05) / (darker + 0.05)


failures = 0
for group, pairs in PAIRS.items():
  print(f"\n{group}")
  for label, fg, bg, minimum in pairs:
    value = ratio(fg, bg)
    ok = value >= minimum
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'}  {value:5.2f}:1 (needs {minimum}:1)  {label}  {fg} on {bg}")

print(f"\n{failures} failing pair(s)")
sys.exit(1 if failures else 0)
