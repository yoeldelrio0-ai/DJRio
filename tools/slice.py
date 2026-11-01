#!/usr/bin/env python3
"""Slice a film into scroll-scrub frame sets.

  python3 tools/slice.py <film.mp4> <name> [--loop]

1. Decodes every frame at thumbnail size and measures frame-to-frame change.
2. Trims the frames Kling holds at the start (near-identical to frame 0).
3. Finds the "hit": the first frame whose change jumps well above the quiet
   level that precedes it (used by The Drop for the BPM meter and the 808).
4. Writes ~200 frames at 1920px and 120 frames at 1080px as WebP into
   assets/frames/<name>/{d,m}/ plus a manifest.json beside them.
"""
import json, os, subprocess, sys, tempfile, shutil
from PIL import Image, ImageChops, ImageStat

src, name = sys.argv[1], sys.argv[2]
loop = "--loop" in sys.argv
root = os.path.join(os.path.dirname(__file__), "..", "assets", "frames", name)
tmp = tempfile.mkdtemp()

# full decode at 1920 wide, PNG, so we can pick any frame later
subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", "scale=1920:-2:flags=lanczos",
                os.path.join(tmp, "f%04d.png")], check=True)
files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
thumbs = [Image.open(os.path.join(tmp, f)).convert("L").resize((192, 108)) for f in files]

def diff(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]

steps = [0.0] + [diff(thumbs[i - 1], thumbs[i]) for i in range(1, len(thumbs))]

# held frames: leading frames that barely differ from frame 0
start = 0
while start + 1 < len(thumbs) and diff(thumbs[0], thumbs[start + 1]) < 0.6:
    start += 1
# held frames at the very end too (Kling often parks on the end image)
end = len(thumbs) - 1
while end - 1 > start and diff(thumbs[-1], thumbs[end - 1]) < 0.35:
    end -= 1
if loop:
    end = len(thumbs) - 1  # keep the full orbit so it closes the loop

kept = list(range(start, end + 1))
quiet = sorted(steps[start + 1:start + 1 + max(6, len(kept) // 8)])
base = quiet[len(quiet) // 2] if quiet else 0.5
hit = 0
for i in kept[1:]:
    if steps[i] > max(base * 3.0, base + 2.0):
        hit = i
        break
hit_p = (hit - start) / max(1, (end - start)) if hit else 0.0

def export(count, width, sub, quality):
    out = os.path.join(root, sub)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    n = len(kept)
    for k in range(count):
        idx = kept[round(k * (n - 1) / (count - 1))]
        im = Image.open(os.path.join(tmp, files[idx])).convert("RGB")
        if width != 1920:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(os.path.join(out, f"{k + 1:04d}.webp"), "WEBP", quality=quality, method=5)
    return count

d = export(200, 1920, "d", 72)
m = export(120, 1080, "m", 70)
manifest = {"name": name, "desktop": {"count": d, "width": 1920}, "mobile": {"count": m, "width": 1080},
            "sourceFrames": len(files), "trimmedStart": start, "trimmedEnd": len(files) - 1 - end,
            "hit": round(hit_p, 4), "aspect": [16, 9]}
json.dump(manifest, open(os.path.join(root, "manifest.json"), "w"), indent=2)
print(json.dumps(manifest))
shutil.rmtree(tmp)
