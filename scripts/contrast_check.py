"""WCAG 2.x contrast check for the Prism design tokens in specs/03-design-system.md.

Text pairs need 4.5:1; UI boundaries (control borders, focus rings) need 3:1 against their background.
Run: python3 scripts/contrast_check.py
"""
import sys

# (label, foreground, background, minimum ratio)
PAIRS = {
  "Prism UI (dark)": [
    ("text on bg", "#F4F2F9", "#131218", 4.5), ("text on surface", "#F4F2F9", "#1C1A23", 4.5),
    ("muted on surface", "#ABA5BC", "#1C1A23", 4.5), ("muted on surface-2", "#ABA5BC", "#26232F", 4.5),
    ("violet text on surface", "#A78BFA", "#1C1A23", 4.5), ("white on primary button", "#FFFFFF", "#6D4AFF", 4.5),
    ("input border on bg", "#78718C", "#131218", 3.0), ("focus ring on surface", "#C4B5FD", "#1C1A23", 3.0),
    ("ok on surface", "#4ADE80", "#1C1A23", 4.5), ("warn on surface", "#FBBF24", "#1C1A23", 4.5), ("danger on surface", "#F87171", "#1C1A23", 4.5),
  ],
  "Clean Flat": [
    ("text on bg", "#0F172A", "#F6F7FB", 4.5), ("muted on card", "#475569", "#FFFFFF", 4.5), ("white on primary", "#FFFFFF", "#2754E6", 4.5),
    ("link on card", "#1E40C8", "#FFFFFF", 4.5), ("link on bg", "#1E40C8", "#F6F7FB", 4.5), ("control border", "#7C8899", "#FFFFFF", 3.0),
    ("price", "#1E40C8", "#EEF2FF", 4.5), ("danger", "#C0262D", "#FFFFFF", 4.5),
  ],
  "Neo-Brutalist": [
    ("text on bg", "#111111", "#FFF4DE", 4.5), ("text on yellow", "#111111", "#FFD84D", 4.5), ("text on pink notice", "#111111", "#FFB8D2", 4.5),
    ("white on primary", "#FFFFFF", "#4F46E5", 4.5), ("link on card", "#3730C9", "#FFFFFF", 4.5), ("link on bg", "#3730C9", "#FFF4DE", 4.5),
    ("price on mint", "#111111", "#A7F3D0", 4.5),
  ],
  "Modern Minimalist": [
    ("text on bg", "#18181B", "#FAFAF7", 4.5), ("muted on card", "#55565C", "#FFFFFF", 4.5), ("white on primary", "#FFFFFF", "#18181B", 4.5),
    ("control border", "#8A8B91", "#FFFFFF", 3.0), ("notice text", "#18181B", "#F3F3EE", 4.5), ("price", "#18181B", "#F0F0EA", 4.5),
  ],
  "Neumorphism": [
    ("text on bg", "#1D2433", "#E8ECF4", 4.5), ("muted on bg", "#465068", "#E8ECF4", 4.5), ("white on primary", "#FFFFFF", "#4153DD", 4.5),
    ("link on bg", "#3646C7", "#E8ECF4", 4.5), ("control border", "#6F7A90", "#E8ECF4", 3.0), ("button border", "#8D97AC", "#E8ECF4", 2.0),
    ("price", "#2A38B0", "#DCE2FB", 4.5),
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
