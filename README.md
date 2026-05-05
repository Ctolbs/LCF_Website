# Lake City Flats — Website

Custom direct booking site for [Lake City Flats](https://lakecityflats.com) — curated short-term rentals in Salt Lake City and Detroit.

## Stack

- **Frontend**: Vanilla HTML/CSS/JS — no framework dependencies
- **Booking engine**: [Hospitable](https://hospitable.com) (formerly Smartbnb) — embedded widget per property page
- **Fonts**: Cormorant Garamond + Instrument Sans (Google Fonts)
- **Hosting**: TBD (Webflow / Netlify / Vercel recommended)
- **Analytics**: GA4 + GTM + Google Search Console
- **Pricing**: PriceLabs → Hospitable → Airbnb/VRBO sync

## Project structure

```
LCF_Website/
├── index.html              # Homepage
├── css/
│   ├── style.css           # Global styles, design tokens
│   ├── homepage.css        # Homepage-specific styles
│   └── property.css        # Property detail page styles
├── js/
│   ├── main.js             # Nav, scroll reveal, easter egg
│   └── filters.js          # Property/neighborhood filters
├── property/
│   └── index.html          # Property detail page template
└── README.md
```

## Cities

| City | Properties | Neighborhoods |
|------|-----------|---------------|
| Salt Lake City | 23 | Granary (6), Downtown (10), Sugarhood (3), ModernWest (1), 9line (2), Avenues (1) |
| Detroit | 3 | Brush Park (3) |

## Path 2 — Hospitable integration

Each property page embeds a unique Hospitable booking widget:

```html
<!-- Booking widget — paste unique script from Hospitable dashboard -->
<div id="hospitable-widget" style="min-height:900px;min-width:320px;">
  <script src="https://app.hospitable.com/widget/PROPERTY_ID/embed.js"></script>
</div>
```

The homepage also embeds a search widget that passes dates to property pages via URL params.

## GVR — Google Vacation Rentals

Each property page includes `VacationRental` JSON-LD structured data in `<head>`.  
See `property/index.html` for the schema template.

Steps to go live with GVR:
1. Apply via [GVR interest form](https://docs.google.com/forms/d/e/1FAIpQLSdLLRCVqRRFiHMRGfzKpFd-n1yV43rZRmCOm3rE2bJAT9IRUQ/viewform)
2. Connect Google Hotel Center account
3. Submit property sitemap to Google Search Console
4. Validate schema with [Rich Results Test](https://search.google.com/test/rich-results)

## Analytics setup

- GA4 property connected via GTM
- Custom events: `widget_open`, `dates_selected`, `booking_complete`
- Hospitable webhooks → GA4 Measurement Protocol for booking attribution
- Search Console: property sitemap submitted

## Direct booking conversion

- "Save ~15% vs Airbnb" callout on all property pages
- Homepage search widget pre-populates dates in property widget via URL params
- Easter egg: type `lcf` anywhere → 10% discount code `LCF10`
- Post-stay Hospitable automation: thank guest + direct booking offer

## Development

No build step needed. Open `index.html` in a browser or serve with:

```bash
npx serve .
```

## Contact

- 📞 801-657-1028
- 📧 contact@lakecityflats.com
- 📸 [@lakecityflats](https://instagram.com/lakecityflats)
