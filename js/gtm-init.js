/* Google Tag Manager setup + Consent Mode v2 + small cookie toast.
   Loads before gtm.js, so consent defaults to "denied" until the visitor accepts. */
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

(function () {
  'use strict';
  var KEY = 'honors-consent';
  var base = document.currentScript ? document.currentScript.src : '';

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function apply(v, isUpdate) {
    var s = v === 'granted' ? 'granted' : 'denied';
    var c = { ad_storage: s, ad_user_data: s, ad_personalization: s, analytics_storage: s };
    if (!isUpdate) c.wait_for_update = 500;
    gtag('consent', isUpdate ? 'update' : 'default', c);
  }

  // 1. Defaults must be set before the GTM container loads.
  apply(read() === 'granted' ? 'granted' : 'denied', false);
  gtag('js', new Date());

  // 2. Small, non-blocking toast (bottom-left).
  var toast;
  function close() { if (toast) { toast.remove(); toast = null; } }
  function choose(v) {
    write(v);
    apply(v, true);
    close();
  }
  function open() {
    if (toast) return;
    var terms = base ? new URL('../terms.html#cookies', base).href : 'terms.html#cookies';
    toast = document.createElement('div');
    toast.className = 'consent-toast';
    toast.setAttribute('role', 'region');
    toast.setAttribute('aria-label', 'Cookie preferences');
    toast.innerHTML =
      '<p>We use cookies to measure visits and our ads. <a href="' + terms + '">Learn more</a></p>' +
      '<div class="consent-toast__actions">' +
      '<button type="button" class="consent-toast__btn" data-consent="denied">Decline</button>' +
      '<button type="button" class="consent-toast__btn consent-toast__btn--accept" data-consent="granted">Accept</button>' +
      '</div>';
    toast.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (b) choose(b.getAttribute('data-consent'));
    });
    document.body.appendChild(toast);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!read()) open();
    // "Cookie settings" link in the footer lets people change their mind.
    var nav = document.querySelector('.site-footer nav');
    if (nav) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'footer-link-btn'; b.textContent = 'Cookie settings';
      b.addEventListener('click', open);
      nav.appendChild(b);
    }
  });
})();
