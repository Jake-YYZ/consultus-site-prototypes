/* Sends website forms to Zoho CRM as new Leads.
   Any <form data-zoho-form> is handled here. The form carries Zoho's own hidden
   keys (xnQsjsdp, xmIwtLD, actionType), so one form = one Zoho Web Form.
   This script adds the ad-tracking fields, posts to Zoho, and shows the thank-you. */
(function () {
  var ENDPOINT = 'https://crm.zoho.com/crm/WebToLeadForm';
  var KEY = 'csAttribution';

  function readStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeStore(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  // Remember ad / campaign info from the landing URL so it survives page changes.
  (function capture() {
    var p = new URLSearchParams(location.search);
    var names = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var found = false, store = readStore();
    names.forEach(function (n) {
      if (p.get(n)) { store[n] = p.get(n); found = true; }
    });
    if (found) writeStore(store);
  })();

  // Zoho field name for each tracked value
  var MAP = {
    zc_gad: 'gclid',
    LEADCF16: 'gclid',
    LEADCF28: 'utm_source',
    LEADCF26: 'utm_medium',
    LEADCF27: 'utm_campaign',
    LEADCF29: 'utm_term',
    LEADCF31: 'utm_content'
  };

  function setField(form, name, value) {
    var el = form.elements[name];
    if (el && value) el.value = value;
  }

  function fillTracking(form) {
    var store = readStore();
    Object.keys(MAP).forEach(function (zoho) { setField(form, zoho, store[MAP[zoho]]); });
    setField(form, 'LEADCF23', location.href.split('#')[0]);
    // Lead Source: ads with a Google click ID are Google Ads, everything else is the contact form
    setField(form, 'Lead Source', store.gclid ? 'Google Ads' : 'Contact Us Form');
  }

  function initForm(form) {
    var status = form.querySelector('[data-zoho-status]');
    var btn = form.querySelector('button[type="submit"]');
    var done = form.parentNode.querySelector('[data-zoho-done]');
    var loadedAt = Date.now();

    function showDone() {
      form.hidden = true;
      if (done) {
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (done.focus) done.focus({ preventScroll: true });
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      // Spam traps: bots fill the hidden field, and they submit within milliseconds of loading the page.
      var trap = form.elements['aG9uZXlwb3Q'];
      if (trap && trap.value) { showDone(); return; }   // look successful, send nothing, count nothing
      if (Date.now() - loadedAt < 2000) { if (status) status.textContent = 'One moment, then press send again.'; return; }
      fillTracking(form);
      var data = new URLSearchParams(new FormData(form));
      var label = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
      if (status) status.textContent = '';

      // Zoho does not allow reading the reply from another site, so we send and trust a clean network round trip.
      fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: data })
        .then(function () {
          if (window.dataLayer) window.dataLayer.push({ event: 'zoho_form_submit', form_id: form.id || 'zoho-form' });
          showDone();
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = label; }
          if (status) status.textContent = 'Something went wrong sending that. Please try again or call 416-460-1810.';
        });
    });
  }

  function boot() {
    var forms = document.querySelectorAll('form[data-zoho-form]');
    for (var i = 0; i < forms.length; i++) initForm(forms[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
