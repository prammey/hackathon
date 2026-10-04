"""Joins BEFORE and AFTER screenshots side by side for review: <slug>-<style>-pair.png (top) and -pair-2.png (below)."""
import sys, json, os
from PIL import Image, ImageDraw

out = sys.argv[1]
styles = (os.environ.get("STYLES") or "soft,clear,calm,bold").split(",")
for rec in json.load(open(os.path.join(out, "results.json"))):
  s = rec["slug"]
  for st in styles:
    for suffix in ("", "-2"):
      a, b = f"{out}/{s}-before{suffix}.png", f"{out}/{s}-{st}{suffix}.png"
      if not (os.path.exists(a) and os.path.exists(b)): continue
      A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
      w = 760; h = int(w * A.height / A.width)
      img = Image.new("RGB", (w * 2 + 12, h + 28), "white")
      img.paste(A.resize((w, h)), (0, 28)); img.paste(B.resize((w, h)), (w + 12, 28))
      d = ImageDraw.Draw(img); d.text((6, 8), f"{s}  BEFORE", fill="black"); d.text((w + 18, 8), f"AFTER: Prism {st}", fill="black")
      img.save(f"{out}/{s}-{st}-pair{suffix}.png")
print("ok")
