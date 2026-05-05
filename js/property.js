// Property page JS

// Sticky booking bar — show after scrolling past widget zone
const stickyBar = document.getElementById('sticky-bar');
const widgetZone = document.getElementById('book');

if (stickyBar && widgetZone) {
  const stickyObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      stickyBar.classList.toggle('show', !e.isIntersecting);
    });
  }, { threshold: 0 });
  stickyObs.observe(widgetZone);
}

// GA4 — track widget interactions via postMessage
// Hospitable widget fires events from inside the iframe
window.addEventListener('message', function(event) {
  if (!event.data || !event.data.source) return;
  if (event.data.source !== 'hospitable-widget') return;

  const { type, propertyId, value, checkin, checkout } = event.data;
  const prop = window.lcfProperty || {};

  window.dataLayer = window.dataLayer || [];

  switch(type) {
    case 'widget_open':
      window.dataLayer.push({
        event: 'widget_open',
        property_id: prop.id,
        property_name: prop.name,
        property_city: prop.city
      });
      break;

    case 'dates_selected':
      window.dataLayer.push({
        event: 'dates_selected',
        property_id: prop.id,
        checkin: checkin,
        checkout: checkout
      });
      break;

    case 'booking_initiated':
      window.dataLayer.push({
        event: 'booking_initiated',
        property_id: prop.id,
        property_name: prop.name,
        value: value
      });
      break;

    case 'booking_complete':
      window.dataLayer.push({
        event: 'purchase',
        transaction_id: event.data.reservationId,
        value: value,
        currency: 'USD',
        items: [{
          item_id: prop.id,
          item_name: prop.name,
          item_category: prop.city,
          item_variant: prop.neighborhood
        }]
      });
      break;
  }
});

// Pre-populate dates from URL params (passed from homepage search widget)
// e.g. /property/granary-penthouse?checkin=2026-06-14&checkout=2026-06-18&guests=2
(function() {
  const params = new URLSearchParams(window.location.search);
  const checkin  = params.get('checkin');
  const checkout = params.get('checkout');
  const guests   = params.get('guests');

  if (checkin || checkout) {
    // Post message to Hospitable widget iframe once it loads
    window.addEventListener('load', () => {
      const iframe = document.querySelector('#hospitable-widget-container iframe');
      if (iframe) {
        iframe.addEventListener('load', () => {
          iframe.contentWindow.postMessage({
            source: 'lcf-parent',
            type: 'prefill_dates',
            checkin, checkout, guests: guests ? parseInt(guests) : 1
          }, '*');
        });
      }
    });
  }
})();
