# Your Body Has Been Speaking

One-page site for Farah Tanis's private consultations. Static; no build step.

- `index.html` — the whole site
- `images/` — her portrait

## Booking

Two Calendly event types, opened in an overlay by `openCal()` with a plain-link
fallback if the widget is blocked:

- 30 minutes, $45 — https://calendly.com/farah-tanis/30min
- One hour, $80 — https://calendly.com/farah-tanis/60min

**Calendly does not redirect a renamed slug.** Rename either event and both
buttons keep looking fine while leading nowhere. Change them here at the same time.

Payment is collected by Calendly and goes to Restore Forward. That needs a paid
Calendly plan with Stripe connected — until then the events book without charging.

## Copy

Verbatim from Farah, not written here. The service description and disclaimer come
from her own draft; the closing letter is hers from wildgala.com. The disclaimer is
deliberate wording — she is a licensed therapist, so the jurisdiction sentence
matters. Don't paraphrase it.

## Deploy

GitHub Pages from `main`, root. `farahtanis.com` is on Wix and not pointed here yet.
