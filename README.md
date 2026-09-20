# farahtanis.com

One-page site for Farah Tanis's private consultations. Static; no build step.
Published by GitHub Pages from `main`, root, at https://farahtanis.com.

- `index.html` — the consultation page (the site's home)
- `about.html` — About Farah; it carries a copy of the CSS from `index.html` — after changing that CSS, run `python3 project/tools/refresh-site-css.py`
- `images/`, `fonts/` — its assets
- `CNAME`, `robots.txt`, `sitemap.xml`
- `project/` — drafts, style guide, exports and tools. Ignored by git and never
  published; see `project/README.md`.

**Everything committed here goes public.** GitHub Pages serves the repository
root, so drafts and working files stay in `project/`.

## Design

The page follows Restore Forward (restoreny.org), the non-profit this work
belongs to: cream `#FFFBF0`, slate `#59637E`, blue-gray `#7C859E`, navy
`#0C1A2E` for solid buttons and peach `#FFC58E` for the booking badge alone.
Cormorant Garamond Light for display, Avenir for text (Apple devices) falling
back to Nunito Sans, Wix Madefor Display for small caps labels. Sizes are drawn
on a 1280px canvas and scale with the window. The full rules are in
`project/style/STYLE-GUIDE.md`.

## Fonts

Served from `fonts/` as latin WOFF2 subsets, so no visitor's address reaches
Google. Avenir comes from the visitor's own Apple device when it is there.

## Booking

Two Calendly event types, opened in an overlay by `openCal()` with a plain-link
fallback if the widget is blocked:

- 30 minutes, $45 — https://calendly.com/farah-tanis/30min
- One hour, $80 — https://calendly.com/farah-tanis/60min

Every link carries `background_color`, `text_color` and `primary_color`, which
open the popup in the page's palette. Keep them if the slugs change.

**Calendly does not redirect a renamed slug.** Rename either event and both
links keep looking fine while leading nowhere. Change them here at the same time.

Payment is collected by Calendly and goes to Restore Forward. That needs a paid
Calendly plan with Stripe connected — until then the events book without charging.

## Copy

Verbatim from Farah, not written here. The service description and disclaimer come
from her own draft; the closing letter is hers from wildgala.com. The disclaimer is
deliberate wording — she is a licensed therapist, so the jurisdiction sentence
matters. Don't paraphrase it.

## Deploy

Commit and push to `main`; GitHub Pages picks it up within a minute or two.
