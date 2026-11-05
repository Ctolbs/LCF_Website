# Lake City Flats — Website

Direct-booking site for [Lake City Flats](https://lakecityflats.com) — short-term rentals in Salt Lake City and Detroit.

## Stack

- **Frontend**: static HTML/CSS/vanilla JS — no framework
- **Hosting**: GitHub Pages (`CNAME` → lakecityflats.com), deployed by `.github/workflows/static.yml` on every push to `main`
- **Booking**: Hospitable direct-booking widget (loader script) on each property page; search widgets use Hospitable's public booking API (calendar + quote)
- **Data**: `properties.json` (listings), `reviews.json` (live review numbers, refreshed nightly), `reviews-manual.json` (VRBO counts, hand-maintained)
- **Analytics**: GA4 + Meta Pixel

Hospitable is the source of truth for listing facts (beds, max guests, pets, check-in time, fees). Keep `properties.json` in line with it.

## Project structure

```
index.html                 Homepage (hero search + booking-section search)
slc/index.html             Salt Lake City landing page
slc/{granary,downtown,9line,sugarhood}/   Neighborhood pages
detroit/index.html         Detroit landing page
bookdirect/  reviews/  about/  terms/  404.html
property/index.html        Property page TEMPLATE (do not link to it directly)
property/<slug>/index.html Generated per-property pages (by scripts/build.js)
css/style.css              Global styles + design tokens
css/property.css           Property page styles
js/lcf-search.js           Shared search helpers: real price quotes, guest picker
properties.json            All listings (26: SLC 24, Detroit 2)
reviews.json               Generated nightly — don't hand-edit
scripts/build.js           Pre-renders property pages; syncs JSON-LD + review totals
scripts/update-reviews.py  Nightly review pull from Hospitable (needs HOSPITABLE_PAT)
```

## Build & deploy

```bash
node scripts/build.js      # generates property/<slug>/ pages
```

`build.js` also rewrites, **in place**, the landing pages' aggregateRating JSON-LD, review-total copy and static property-card links. The card injection is not idempotent, so don't commit landing pages after running it locally (commit only `property/<slug>/`). The build aborts on template/markup drift — fix the cause rather than bypassing the guards.

`update-reviews.yml` runs nightly at 09:00 UTC: it refreshes `reviews.json` (and the rating/count fields in `properties.json`), commits, and triggers a deploy. It fails without committing if any property can't be matched.

Local preview: `python3 -m http.server` from the repo root (the search widgets load `/js/lcf-search.js` by absolute path).

## Contact

801-657-1028 · contact@lakecityflats.com · [@lakecityflats](https://instagram.com/lakecityflats)
