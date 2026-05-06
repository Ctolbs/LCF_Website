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

const SITE_BASE = 'https://ctolbs.github.io/LCF_Website';

data.properties.forEach(prop => {
  const cityFull = prop.city === 'slc' ? 'Salt Lake City' : 'Detroit';
  const stateCode = prop.city === 'slc' ? 'UT' : 'MI';
  const pageTitle = `${prop.name} — Lake City Flats`;
  const pageDesc = `${prop.meta} in ${cityFull}. Book direct with Lake City Flats and save ~15% vs. Airbnb. No service fees.`;
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
      "ratingValue": prop.rating,
      "reviewCount": parseInt(prop.review_count) || 10,
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
    "telephone": "+18016571028",
    "email": "contact@lakecityflats.com"
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
<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`;

  // Replace the generic <title> + description + placeholder OG block from the template
  let html = template
    .replace(
      /<title>Lake City Flats — Loading\.\.\.<\/title>\n<meta name="description"[^\n]*>\n<!-- OG tags updated dynamically by JS after property loads -->\n[\s\S]*?<meta name="twitter:image" content="">/,
      staticHead.trim()
    )
    // Adjust relative asset paths one extra level up (property/{id}/ vs property/)
    .replace(/href="\.\.\/([^"]*)"/g, 'href="../../$1"')
    .replace(/fetch\('\.\.\/properties\.json'\)/g, "fetch('../../properties.json')")
    // Similar property links: ?id=SLUG resolves wrong from a subdirectory → use sibling path
    .replace('href="?id=${s.id}"', 'href="../${s.id}/"')
    // Hardcode property ID so page loads correctly without a ?id= query param
    .replace(
      /const id = new URLSearchParams\(location\.search\)\.get\('id'\);/,
      `const id = '${prop.id}';`
    );

  const outDir = path.join(ROOT, 'property', prop.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log(`Built: property/${prop.id}/index.html`);
});

console.log(`\nDone — ${data.properties.length} property pages generated.`);
