/* LCF search helpers — shared by every availability-search widget.
 *
 * lcfQuote: real all-in price quotes.  lcfSyncGuests: guest picker options.
 *
 * Price quotes:
 *
 * The calendar endpoint only returns nightly rates, so "sum of nights" is NOT
 * what a guest pays: Hospitable adds a cleaning fee, a service fee and lodging
 * taxes (often 1.5-2.3x the nightly subtotal). For a card showing specific
 * dates we:
 *   1. render an honest fallback immediately ("$X for N nights · before
 *      cleaning fee & taxes"), then
 *   2. ask Hospitable's public quote endpoint (the same one the booking widget
 *      uses) for the real all-in total and swap it in when it arrives.
 * If the quote fails, is rate-limited or times out, the fallback stays.
 */
(function () {
  if (window.lcfQuote) return;
  var API = 'https://api.hospitable.com/bookings/api/properties/';
  // Hospitable's public booking API allows 60 requests/minute per visitor IP,
  // shared by the calendar, quote AND the booking widget on the property page.
  // A search already spends up to ~26 calendar calls, so quotes are capped well
  // below the limit to leave headroom for the widget a guest clicks through to.
  var MAX_ACTIVE = 3;      // concurrent quote requests
  var PER_MINUTE = 10;     // max quote requests in any rolling 60s
  var TIMEOUT_MS = 10000;
  var cache = {};          // key -> Promise<{total:number}|null>
  var queue = [], active = 0, sent = [], pausedUntil = 0;

  function allowed() {
    var now = Date.now();
    if (now < pausedUntil) return false;
    while (sent.length && now - sent[0] > 60000) sent.shift();
    if (sent.length >= PER_MINUTE) return false;
    sent.push(now);
    return true;
  }

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function nightsLabel(n) { return n + ' night' + (n === 1 ? '' : 's'); }

  function pump() {
    while (active < MAX_ACTIVE && queue.length) {
      var job = queue.shift();
      active++;
      job().then(release, release);
    }
  }
  function release() { active--; pump(); }

  function request(hid, ci, co, adults) {
    return new Promise(function (resolve) {
      if (!window.fetch || !allowed()) { resolve(null); return; }
      queue.push(function () {
        var ctrl = window.AbortController ? new AbortController() : null;
        var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
        return fetch(API + encodeURIComponent(hid) + '/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkin: ci, checkout: co, num_guests: { adults: adults, children: 0, infants: 0, pets: 0 } }),
          signal: ctrl ? ctrl.signal : undefined
        }).then(function (r) {
          if (r.status === 429) pausedUntil = Date.now() + 60000;  // back off fully
          return r.ok ? r.json() : null;
        })
          .then(function (j) {
            var cents = j && j.data && j.data.total && Number(j.data.total.amount);
            resolve(cents > 0 ? { total: cents / 100 } : null);
          })
          .catch(function () { resolve(null); })
          .then(function () { clearTimeout(t); });
      });
      pump();
    });
  }

  function get(hid, ci, co, adults) {
    adults = Math.max(1, parseInt(adults, 10) || 2);
    var key = [hid, ci, co, adults].join('|');
    if (!cache[key]) {
      cache[key] = request(hid, ci, co, adults).then(function (q) {
        if (!q) delete cache[key];   // failed/skipped: allow a retry on the next search
        return q;
      });
    }
    return cache[key];
  }

  // Honest label for a nightly-rate subtotal (never called "total").
  function fallback(avail, short) {
    if (short) return 'before cleaning fee &amp; taxes';
    return money(avail.totalPrice) + ' for ' + nightsLabel(avail.nights) + ' &middot; before cleaning fee &amp; taxes';
  }

  // Fill `el` with the fallback now and the real all-in total when it arrives.
  // avail = {totalPrice, nights, ci, co}
  function fill(el, hid, avail, adults, short) {
    if (!el || !hid || !avail || !avail.ci || !avail.co) return;
    el.innerHTML = fallback(avail, short);
    get(hid, avail.ci, avail.co, adults).then(function (q) {
      if (!q) return;
      el.innerHTML = short
        ? money(q.total) + ' total incl. fees &amp; taxes'
        : '<strong style="font-weight:600;">' + money(q.total) + ' total</strong> for ' + nightsLabel(avail.nights) + ' &middot; incl. fees &amp; taxes';
      el.setAttribute('data-quoted', '1');
    });
  }

  window.lcfQuote = { get: get, fill: fill, fallback: fallback };

  // Rebuild a guest <select> so it offers 1..max where max is the largest
  // `sleeps` among the flats that widget searches (from properties.json), so we
  // never offer group sizes no flat can take (or hide ones that one can).
  window.lcfSyncGuests = function (sel, props) {
    if (!sel || !props || !props.length) return;
    var max = props.reduce(function (m, p) { return Math.max(m, +p.sleeps || 0); }, 0);
    if (!max) return;
    var cur = Math.min(parseInt(sel.value, 10) || 2, max);
    sel.innerHTML = '';
    for (var i = 1; i <= max; i++) {
      var o = document.createElement('option');
      o.value = String(i); o.textContent = i + (i === 1 ? ' guest' : ' guests');
      if (i === cur) o.selected = true;
      sel.appendChild(o);
    }
  };
})();
