#!/usr/bin/env python3
"""Download Río's real logos and photos, then sample the brand purple.

  python3 tools/fetch_assets.py

Needs network access to riorocksyourparty.com. Standard library only.
Writes:
  assets/logo/rio-purple.png, assets/logo/rio-white.png
  assets/photos/<file>            every full-size image linked on /media/
  assets/photos/photos.json       file list with the page's alt text
  assets/brand.css                --rio-purple sampled from the purple logo
Then edit assets/photos/photos.json "use" to pick which photo goes where and
run it again with --slots-only to recopy without downloading.
"""
import html, json, os, re, struct, sys, urllib.request, zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UA = {"User-Agent": "Mozilla/5.0 (asset fetch for riorocksyourparty.com rebuild)"}
LOGOS = {
    "rio-purple.png": "https://riorocksyourparty.com/wp-content/uploads/2023/09/Rio_Logo@0.5xpurple.png",
    "rio-white.png": "https://riorocksyourparty.com/wp-content/uploads/2023/12/Rio_Logo@0.5xwhite.png",
}
MEDIA = "https://riorocksyourparty.com/media/"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def save(url, path):
    data = get(url)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data)
    print(f"  {len(data)//1024:>6} KB  {os.path.relpath(path, ROOT)}")


def full_size(u):
    # WordPress thumbnails: name-300x200.jpg -> name.jpg ; name-scaled.jpg kept
    return re.sub(r"-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)$)", "", u, flags=re.I)


def media_images(page):
    found = {}
    for m in re.finditer(r"<img\b[^>]*>", page, re.I):
        tag = m.group(0)
        src = re.search(r'(?:data-orig-file|data-large-file|data-src|src)="([^"]+)"', tag)
        alt = re.search(r'alt="([^"]*)"', tag)
        if src and "/wp-content/uploads/" in src.group(1):
            u = full_size(html.unescape(src.group(1)).split("?")[0])
            found.setdefault(u, html.unescape(alt.group(1)).strip() if alt else "")
    for m in re.finditer(r'href="([^"]+/wp-content/uploads/[^"]+\.(?:jpe?g|png|webp))"', page, re.I):
        found.setdefault(full_size(html.unescape(m.group(1))), "")
    return {u: a for u, a in found.items() if "logo" not in u.lower()}


def png_pixels(path):
    """Minimal PNG reader (8-bit RGBA/RGB, non-interlaced) for colour sampling."""
    data = open(path, "rb").read()
    pos, chunks, ihdr = 8, b"", None
    while pos < len(data):
        n, t = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if t == b"IHDR": ihdr = struct.unpack(">IIBBBBB", body)
        if t == b"IDAT": chunks += body
        pos += 12 + n
    w, h, depth, ctype = ihdr[0], ihdr[1], ihdr[2], ihdr[3]
    bpp = {6: 4, 2: 3}.get(ctype)
    if depth != 8 or not bpp:
        raise SystemExit("unexpected PNG format; sample the purple by hand")
    raw, stride, prev, out = zlib.decompress(chunks), w * bpp, bytearray(w * bpp), []
    i = 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride]); i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b, c = prev[x], prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out.append(bytes(line)); prev = line
    return w, h, bpp, out


def sample_purple(path):
    w, h, bpp, rows = png_pixels(path)
    tally = {}
    for r in rows:
        for x in range(0, w * bpp, bpp):
            if bpp == 4 and r[x + 3] < 250: continue
            k = (r[x], r[x + 1], r[x + 2])
            if max(k) - min(k) < 24: continue  # skip black, white and greys
            tally[k] = tally.get(k, 0) + 1
    rgb = max(tally, key=tally.get)
    return "#%02X%02X%02X" % rgb


def main():
    if "--slots-only" in sys.argv:
        return copy_slots()
    print("Logos")
    for f, u in LOGOS.items():
        save(u, os.path.join(ROOT, "assets", "logo", f))
    purple = sample_purple(os.path.join(ROOT, "assets", "logo", "rio-purple.png"))
    open(os.path.join(ROOT, "assets", "brand.css"), "w").write(
        f"/* sampled from Rio_Logo@0.5xpurple.png by tools/fetch_assets.py */\n:root {{ --rio-purple: {purple}; }}\n")
    print(f"Brand purple sampled: {purple}")

    print("Photos from /media/")
    page = get(MEDIA).decode("utf-8", "replace")
    imgs = media_images(page)
    listing = []
    for u, alt in imgs.items():
        fn = os.path.basename(u)
        try:
            save(u, os.path.join(ROOT, "assets", "photos", fn))
            listing.append({"file": fn, "alt": alt, "source": u})
        except Exception as e:  # full-size may not exist for every thumb
            print(f"  skipped {u}: {e}")
    mpath = os.path.join(ROOT, "assets", "photos", "photos.json")
    old = json.load(open(mpath)) if os.path.exists(mpath) else {}
    use = old.get("use") or {}
    files = [p["file"] for p in listing]
    slots = ["weddings", "corporate", "private", "club", "cultural", "about"]
    for i, s in enumerate(slots):
        if not use.get(s) and files:
            use[s] = files[i % len(files)]
    json.dump({"use": use, "photos": listing}, open(mpath, "w"), indent=2)
    copy_slots()
    print(f"{len(listing)} photos. Edit assets/photos/photos.json 'use' to choose which photo goes on each card.")


def copy_slots():
    """The page loads fixed names; copy the chosen photo into each slot."""
    import shutil
    use = json.load(open(os.path.join(ROOT, "assets", "photos", "photos.json")))["use"]
    names = {"weddings": "event-weddings", "corporate": "event-corporate", "private": "event-private",
             "club": "event-club", "cultural": "event-cultural", "about": "about-promo"}
    for slot, fn in use.items():
        src = os.path.join(ROOT, "assets", "photos", fn)
        if slot in names and os.path.exists(src):
            shutil.copyfile(src, os.path.join(ROOT, "assets", "photos", names[slot] + ".jpg"))
            print(f"  {slot:<10} <- {fn}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"Could not fetch assets: {e}")
