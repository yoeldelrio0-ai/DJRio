# DJ Río · riorocksyourparty.com

Cinematic scroll site for DJ Río (Yoel Del Rio), Wilmington NC wedding and Latin DJ.
Static HTML, CSS and JS. No build step.

## Run it

Double-click **`Launch DJ Rio.command`** (macOS / Linux) or **`Launch DJ Rio.bat`** (Windows).
It serves the folder on **http://localhost:5287** and opens your browser. Needs Python 3.

```bash
python3 serve.py
```

Test without sound: http://localhost:5287/?mute=1 · Force Spanish: `?lang=es` · Preselect a genre: `?genre=salsa`

## Before going live: three things to set

1. **Real logo and photos.** Run this on a machine that can reach riorocksyourparty.com:

   ```bash
   python3 tools/fetch_assets.py
   ```

   It downloads both logos and every full-size photo from `/media/`, re-samples the brand purple from the
   purple logo into `assets/brand.css`, and copies one photo onto each event card and the About section.
   Pick which photo goes where in `assets/photos/photos.json` (`"use"`), then run
   `python3 tools/fetch_assets.py --slots-only`. Check the alt text in `i18n.js` (`events.*Alt`, `about.alt`)
   matches the photo you chose. Until then, the cards show a labelled empty frame, never a stand-in image.

2. **Booking endpoint.** In `app.js`, set `FORM_ENDPOINT` to a URL that accepts a JSON POST
   (Formspree, Basin, Netlify function, etc.). While it is empty, the confirmation says plainly that
   nothing was sent and offers a pre-filled email to info@riorocksyourparty.com.

3. **YouTube video.** In `app.js`, set `YOUTUBE_ID` to the id of "Urban Tropics | Río Latin in the City".
   While empty, the card links to youtube.com/@cheapd3lirio/videos.

## How it works

| Chapter | Film | Scroll does |
|---|---|---|
| The Drop (hero) | `assets/frames/drop` | logo and headline over the quiet cone, BPM meter jumps on the hit, 0 to 8 colours counter, optional 808 |
| The Sound | `assets/frames/frozen` | 360° orbit readout; genre chips recolour every film and the accent with the same filter maths |
| The Set | `assets/frames/set` | layers counter, one line per layer |

Each film is about 200 WebP frames at 1920px plus 120 at 1080px for phones (`tools/slice.py` trims
Kling's held opening frames, finds the hit, and writes `manifest.json`). Lenis smooths the scroll;
frames load coarse to fine, so scrubbing works before every frame has arrived.

Accent: `--rio-purple` (from the logo) is the only UI colour. `app.js` derives a lighter tone of the same hue
for text and focus rings, and passes all of them through the active genre's `hue-rotate` / `saturate` matrix.

## Files

- `index.html`, `styles.css`, `app.js`, `i18n.js` (English and Puerto Rican Spanish)
- `assets/plates/` four Higgsfield stills (gpt_image_2_5, 4k, max). `films/` the three Kling 3.0 masters
- `tools/slice.py` film to frames, `tools/fetch_assets.py` real assets, `tools/verify.mjs` Playwright check
