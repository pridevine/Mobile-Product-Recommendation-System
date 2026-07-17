# Phone product photos (optional, local only)

Drop real phone back/product photos here to replace the drawn SVG
illustrations on the recommendation cards. **These images are gitignored on
purpose** — they're typically copyrighted (e.g. GSMArena / Samsung press
shots), so we don't commit or redistribute them. Anyone who clones the repo
without these files still gets the SVG fallback automatically.

## How it works

For each phone, `src/theme.py` looks for a file named after the model. If it
finds one, the card shows the photo (wrapped in a light "product tile" so a
white background looks intentional on the dark card). If not, it draws the
SVG phone instead. So you can add photos gradually — any that are missing
just fall back to SVG.

Accepted extensions: `.png` (preferred), `.webp`, `.jpg`, `.jpeg`.

## Expected filenames

| Model | Filename |
|-------|----------|
| Galaxy A06 | `galaxy_a06.png` |
| Galaxy A15 5G | `galaxy_a15_5g.png` |
| Galaxy A16 5G | `galaxy_a16_5g.png` |
| Galaxy M15 5G | `galaxy_m15_5g.png` |
| Galaxy A25 5G | `galaxy_a25_5g.png` |
| Galaxy A35 5G | `galaxy_a35_5g.png` |
| Galaxy A36 5G | `galaxy_a36_5g.png` |
| Galaxy A55 5G | `galaxy_a55_5g.png` |
| Galaxy M55 5G | `galaxy_m55_5g.png` |
| Galaxy S23 FE | `galaxy_s23_fe.png` |
| Galaxy S24 FE | `galaxy_s24_fe.png` |
| Galaxy S24 | `galaxy_s24.png` |
| Galaxy S24+ | `galaxy_s24_plus.png` |
| Galaxy S24 Ultra | `galaxy_s24_ultra.png` |
| Galaxy Z Flip6 | `galaxy_z_flip6.png` |

Tip: photos with the same framing/scale (e.g. all from GSMArena) look best
together. After adding files, restart the notebook kernel (or reload Voilà)
to pick them up.
