#!/usr/bin/env node
// Pre-renders a property/{id}/index.html for every entry in properties.json.
// Each file is a copy of property/index.html with OG tags and JSON-LD
// statically pre-filled in <head>, so crawlers see real metadata without JS.
// The booking widget and gallery JS still run normally in the browser.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'properties.json'), 'utf8'));
const template = fs.readFileSync(path.join(ROOT, 'property', 'index.html'), 'utf8');
// Live per-property review numbers (regenerated nightly); fall back to properties.json.
let reviews = {};
try { reviews = (JSON.parse(fs.readFileSync(path.join(ROOT, 'reviews.json'), 'utf8')).properties) || {}; } catch (e) {}

const SITE_BASE = 'https://lakecityflats.com';

data.properties.forEach(prop => {
  const cityFull = prop.city === 'slc' ? 'Salt Lake City' : 'Detroit';
  const stateCode = prop.city === 'slc' ? 'UT' : 'MI';
  const cityUrl = prop.city === 'slc' ? `${SITE_BASE}/slc/` : `${SITE_BASE}/detroit/`;
  const hoodName = ({ granary: 'the Granary District', downtown: 'Downtown', sugarhood: 'Sugar House', '9line': 'the 9Line', 'brush-park': 'Brush Park' })[prop.hood] || cityFull;
  const pageTitle = `${prop.name} — Lake City Flats`;
  const pageDesc = `${prop.meta} in ${hoodName}, ${cityFull}. Book direct with Lake City Flats — no service fees, always cheaper than Airbnb.`;
  const pageUrl = `${SITE_BASE}/property/${prop.id}/`;
  const pageImg = prop.photos[0] || prop.image;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": prop.name,
    "description": prop.description,
    "url": pageUrl,
    "image": prop.photos,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": cityFull,
      "addressRegion": stateCode,
      "addressCountry": "US"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": String((reviews[prop.id] && reviews[prop.id].rating) != null ? reviews[prop.id].rating : prop.rating),
      "reviewCount": (reviews[prop.id] && reviews[prop.id].count != null) ? reviews[prop.id].count : (parseInt(prop.review_count) || 10),
      "bestRating": "5"
    },
    "amenityFeature": prop.amenities.map(a => ({
      "@type": "LocationFeatureSpecification",
      "name": a,
      "value": true
    })),
    "numberOfRooms": prop.beds,
    "occupancy": { "@type": "QuantitativeValue", "maxValue": prop.sleeps },
    "petsAllowed": false,
    "geo": { "@type": "GeoCoordinates", "latitude": prop.lat, "longitude": prop.lng },
    "checkinTime": "15:00",
    "checkoutTime": "11:00",
    "priceRange": "$$",
    "telephone": "+18016571028",
    "email": "contact@lakecityflats.com"
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_BASE}/` },
      { "@type": "ListItem", "position": 2, "name": cityFull, "item": cityUrl },
      { "@type": "ListItem", "position": 3, "name": prop.name, "item": pageUrl }
    ]
  };

  const qa = [
    [`Can I book ${prop.name} directly?`,
     `Yes. Book ${prop.name} directly at lakecityflats.com and skip the platform service fee — booking direct is always cheaper than Airbnb or Vrbo, with no service fees.`],
    [`How many guests does ${prop.name} sleep?`,
     `${prop.name} sleeps up to ${prop.sleeps} guests (${prop.beds} bedroom${prop.beds == 1 ? '' : 's'}, ${prop.baths} bath${prop.baths == 1 ? '' : 's'}).`],
    [`Where is ${prop.name} located?`,
     `${prop.name} is in ${hoodName}, ${cityFull}, ${stateCode} — self check-in, professionally managed by Lake City Flats.`]
  ];
  const park = (prop.amenities || []).find(a => /garage|parking/i.test(a));
  if (park) qa.push([`Does ${prop.name} have parking?`, `Yes — ${prop.name} includes ${park.toLowerCase()}.`]);
  const work = (prop.amenities || []).find(a => /cowork|workspace|desk/i.test(a));
  if (work) qa.push([`Is ${prop.name} good for remote work?`, `Yes — ${prop.name} offers ${work.toLowerCase()}, plus fast WiFi throughout.`]);
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": qa.map(([q, a]) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } }))
  };

  const staticHead = `
<title>${pageTitle}</title>
<meta name="description" content="${pageDesc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lake City Flats">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${pageDesc}">
<meta property="og:image" content="${pageImg}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${pageDesc}">
<meta name="twitter:image" content="${pageImg}">
<link rel="canonical" href="${pageUrl}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}<\/script>
<script type="application/ld+json">${JSON.stringify(faq)}<\/script>`;

  // Replace the generic <title> + description + placeholder OG block from the template
  let html = template
    .replace(
      /<title>Lake City Flats — Loading\.\.\.<\/title>\n<meta name="description"[^\n]*>\n<!-- OG tags updated dynamically by JS after property loads -->\n[\s\S]*?<meta name="twitter:image" content="">/,
      staticHead.trim()
    )
    // Adjust relative asset paths one extra level up (property/{id}/ vs property/)
    .replace(/href="\.\.\/([^"]*)"/g, 'href="../../$1"')
    .replace(/fetch\('\.\.\/properties\.json'\)/g, "fetch('../../properties.json')")
    .replace(/fetch\('\.\.\/reviews\.json'\)/g, "fetch('../../reviews.json')")
    // Similar property links: ?id=SLUG resolves wrong from a subdirectory → use sibling path
    .replace('href="?id=${s.id}"', 'href="../${s.id}/"')
    // Hardcode property ID so page loads correctly without a ?id= query param
    .replace(
      /const id = new URLSearchParams\(location\.search\)\.get\('id'\);/,
      `const id = '${prop.id}';`
    );

  // Fail loudly if the head-swap didn't take (template markup drifted) instead
  // of silently shipping pages with the "Loading..." placeholder title/empty OG.
  if (html.includes('Lake City Flats — Loading...')) {
    console.error(`ERROR: static <head> not injected for "${prop.id}" — the template's head markup likely drifted from build.js's replace() pattern. Aborting before shipping broken metadata.`);
    process.exit(1);
  }

  const outDir = path.join(ROOT, 'property', prop.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log(`Built: property/${prop.id}/index.html`);
});

console.log(`\nDone — ${data.properties.length} property pages generated.`);
