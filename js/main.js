(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: solid background once scrolled ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile overflow menu ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  var closeBtn = menu.querySelector('.menu-close');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) { closeBtn.focus(); } else { toggle.focus({ preventScroll: true }); }
  }
  menu.setAttribute('aria-hidden', 'true');
  toggle.addEventListener('click', function () { setMenu(true); });
  closeBtn.addEventListener('click', function () { setMenu(false); });
  menu.querySelectorAll('[data-menu-link]').forEach(function (a) {
    a.addEventListener('click', function () {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
    if (e.matches && menu.classList.contains('is-open')) setMenu(false);
  });

  /* ---------- Hero: auto-rotating titles (word-by-word blur + spring) ---------- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var titles = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-title]'));
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.phone-carousel__slide'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('.dots button'));
    var HOLD = 5000, OUT_MS = 420, IN_MS = 950, SPRING = 'cubic-bezier(.3,1.5,.6,1)';
    var current = 0, timer = null, busy = false;
    var bar = hero.querySelector('.hero-timer');
    if (bar) bar.style.setProperty('--hold', HOLD + 'ms');

    // wrap every word in a span so it can animate on its own
    var wordSets = titles.map(function (t) {
      var out = [];
      Array.prototype.slice.call(t.childNodes).forEach(function (n) {
        if (n.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        n.textContent.split(/\s+/).filter(Boolean).forEach(function (word, i, all) {
          var w = document.createElement('span');
          w.className = 'w'; w.textContent = word; out.push(w);
          frag.appendChild(w);
          if (i < all.length - 1) frag.appendChild(document.createTextNode(' '));
        });
        t.replaceChild(frag, n);
      });
      return out;
    });

    var gen = 0; // bumped whenever a transition is cancelled, so stale timeouts do nothing

    function clear(words) {
      words.forEach(function (w) { w.getAnimations().forEach(function (a) { a.cancel(); }); });
    }
    // Resting state lives in CSS (.is-shown), so a title can never be left invisible by an interrupted animation.
    function wordsIn(i, g) {
      var words = wordSets[i], title = titles[i], last = null;
      clear(words);
      title.classList.remove('is-shown');
      words.forEach(function (w, n) {
        var delay = 60 + n * 85;
        var a1 = w.animate([{ opacity: 0 }, { opacity: 1 }],
          { duration: 600, delay: delay, easing: 'ease-out', fill: 'both' });
        w.animate([{ filter: 'blur(16px)' }, { filter: 'blur(0px)' }],
          { duration: 750, delay: delay, easing: 'ease-out', fill: 'both' });
        var a3 = w.animate([{ transform: 'translateY(.5em) scale(.94)' }, { transform: 'translateY(0) scale(1)' }],
          { duration: IN_MS, delay: delay, easing: SPRING, fill: 'both' });
        last = a3;
      });
      if (last) last.finished.then(function () {
        if (g !== gen) return;
        title.classList.add('is-shown');
        clear(words);
      }).catch(function () {});
    }
    function wordsOut(i) {
      var words = wordSets[i];
      words.forEach(function (w, n) {
        var delay = n * 50;
        w.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: OUT_MS, delay: delay, easing: 'ease-in', fill: 'both' });
        w.animate([{ filter: 'blur(0px)' }, { filter: 'blur(12px)' }],
          { duration: OUT_MS, delay: delay, easing: 'ease-in', fill: 'both' });
        w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-.3em) scale(.97)' }],
          { duration: OUT_MS, delay: delay, easing: 'ease-in', fill: 'both' });
      });
      titles[i].classList.remove('is-shown');
    }
    // Make sure each phone image is fully loaded and decoded before it is faded in (avoids blank boxes on mobile)
    var decodes = slides.map(function (img) {
      img.loading = 'eager';
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    function decoded(i) { return decodes[i]; }
    function setPhone(i) {
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); if (n === i) s.loading = 'eager'; });
      dots.forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
    }
    function setTitle(i) {
      titles.forEach(function (t, n) {
        t.classList.toggle('is-active', n === i);
        t.setAttribute('aria-hidden', String(n !== i));
      });
    }

    function go(i) {
      i = (i + titles.length) % titles.length;
      if (i === current || busy) return;
      if (reduceMotion || !hero.animate) { setTitle(i); setPhone(i); titles[i].classList.add('is-shown'); current = i; return; }
      busy = true;
      var g = ++gen, prev = current;
      wordsOut(prev);
      var outTime = OUT_MS + (wordSets[prev].length - 1) * 50;
      var ready = new Promise(function (r) { setTimeout(r, 120); }).then(function () { return decoded(i); });
      ready.then(function () { if (g === gen) setPhone(i); });
      setTimeout(function () {
        if (g !== gen) return;
        setTitle(i); current = i;
        clear(wordSets[prev]);
        wordsIn(i, g);
        setTimeout(function () { if (g !== gen) return; busy = false; start(); }, 350);
      }, outTime);
    }
    // Each cycle: bar fills over HOLD ms, then the next title transitions in.
    function start() {
      if (reduceMotion) return;
      stop();
      if (bar) { void bar.offsetWidth; bar.classList.add('is-running'); }
      timer = setTimeout(function () { go(current + 1); }, HOLD);
    }
    function stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (bar) bar.classList.remove('is-running');
    }

    // Snap to a clean, fully visible state (used when the tab/page comes back).
    function resync() {
      gen++; busy = false; stop();
      wordSets.forEach(clear);
      setTitle(current); setPhone(current);
      titles.forEach(function (t, n) { t.classList.toggle('is-shown', n === current); });
      start();
    }

    // first title animates in on load
    function intro() {
      if (reduceMotion || !hero.animate) { titles[0].classList.add('is-shown'); return; }
      wordsIn(0, gen);
    }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { intro(); start(); });

    // mobile dots (hidden on desktop)
    dots.forEach(function (d, n) { d.addEventListener('click', function () { if (busy) return; stop(); go(n); if (n === current) start(); }); });

    // Leaving and coming back (tab switch, back/forward cache) must never leave the title blank
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : resync(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) resync(); });
  }

  /* ---------- Background cross-fade (green <-> cream) as you scroll ---------- */
  var bg = document.querySelector('.bg-fixed__green');
  var darkSections = Array.prototype.slice.call(document.querySelectorAll('[data-theme="dark"]'));
  if (bg && darkSections.length) {
    var ticking = false;
    function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function updateBg() {
      ticking = false;
      var vh = window.innerHeight, best = 0;
      darkSections.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        best = Math.max(best, visible / Math.min(r.height, vh));
      });
      bg.style.setProperty('--g', smooth(0.12, 0.7, best).toFixed(3));
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateBg); }
    }, { passive: true });
    window.addEventListener('resize', updateBg);
    updateBg();
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Sign-up form ---------- */
  var form = document.getElementById('signup-form');
  if (form) {
    var card = document.getElementById('signup-card');
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function setError(input, bad) {
      var field = input.closest('.field');
      field.classList.toggle('has-error', bad);
      input.setAttribute('aria-invalid', String(bad));
    }
    function validate() {
      var ok = true, first = null;
      var name = form.elements.name, email = form.elements.email, country = form.elements.country;
      var checks = [
        [name, !name.value.trim()],
        [email, !emailRe.test(email.value.trim())],
        [country, !country.value]
      ];
      checks.forEach(function (c) {
        setError(c[0], c[1]);
        if (c[1]) { ok = false; first = first || c[0]; }
      });
      var device = form.querySelector('input[name="device"]:checked');
      var deviceField = form.querySelector('fieldset.field');
      deviceField.classList.toggle('has-error', !device);
      if (!device) { ok = false; first = first || form.querySelector('input[name="device"]'); }
      if (first) first.focus();
      return ok;
    }

    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field');
      if (f && f.classList.contains('has-error')) {
        f.classList.remove('has-error');
        e.target.removeAttribute('aria-invalid');
      }
    });
    form.addEventListener('change', function (e) {
      var f = e.target.closest('.field');
      if (f) f.classList.remove('has-error');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;

      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        course: form.elements.course.value.trim(),
        country: form.elements.country.value,
        device: form.querySelector('input[name="device"]:checked').value,
        website: form.elements.website.value // honeypot, should be empty
      };
      var submit = form.querySelector('button[type="submit"]');
      var errorBox = document.getElementById('form-error');
      function fail(msg) {
        submit.disabled = false;
        errorBox.textContent = msg || 'Sorry, something went wrong. Please try again.';
        errorBox.hidden = false;
      }
      errorBox.hidden = true;
      submit.disabled = true;

      // Sign-ups are posted to the Google Apps Script web app set in the form's data-endpoint attribute.
      var endpoint = form.getAttribute('data-endpoint');
      var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
      var request;
      if (endpoint) {
        // text/plain keeps this a "simple" request, so the browser doesn't need a CORS preflight
        request = fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data)
        }).then(function (r) { return r.json(); })
          .then(function (res) { if (!res || !res.ok) throw new Error((res && res.error) || 'failed'); });
      } else if (local) {
        console.warn('No data-endpoint set on #signup-form: sign-up was NOT saved (local preview only).');
        request = Promise.resolve();
      } else {
        request = Promise.reject(new Error('Sign-ups aren’t open just yet. Please check back soon.'));
      }

      request.then(function () {
        card.classList.add('is-done');
        card.querySelector('.form-success').focus({ preventScroll: true });
      }).catch(function (err) {
        var known = err && err.message && err.message !== 'failed' && err.message.indexOf('fetch') < 0 && err.message.indexOf('JSON') < 0 && err.message.indexOf('Failed') < 0;
        fail(known ? err.message : null);
      });
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

/* Logo on the home page: smooth-scroll to the very top */
document.querySelectorAll('[data-scroll-top]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname);
  });
});
