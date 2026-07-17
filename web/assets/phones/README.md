# Phone images for the web app

Drop real phone images here and the result cards will use them instead of
the drawn SVG. If an image is missing, that card automatically falls back to
the SVG (via `<img onerror>`), so the site works before and after you add them.

**Note:** unlike the notebook's photos (which are gitignored), these need to
be **committed** for Vercel to serve them on the deployed site.

Accepted: `.png` (the code looks for `.png`).

## Filenames

| Model | File |
|-------|------|
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
| (optional) hero phone | `hero.png` |

Tip: images with a transparent or white background sit best on the white
cards. After adding files, just refresh the page (Ctrl+Shift+R).
