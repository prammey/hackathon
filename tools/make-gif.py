"""Builds a looping GIF from PNG frames: python3 tools/make-gif.py out.gif width frame1.png:ms frame2.png:ms ..."""
import sys
from PIL import Image

out, width = sys.argv[1], int(sys.argv[2])
frames, durations = [], []
for arg in sys.argv[3:]:
  path, ms = arg.rsplit(":", 1)
  im = Image.open(path).convert("RGB")
  h = int(width * im.height / im.width)
  frames.append(im.resize((width, h), Image.LANCZOS).quantize(colors=128, method=Image.Quantize.MEDIANCUT))
  durations.append(int(ms))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)
print(out)
