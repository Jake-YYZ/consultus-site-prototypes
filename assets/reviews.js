/*
 * Consultus Digital, reviews.js
 * Behaviour for the client reviews component (.crv, see /assets/css/reviews.css):
 *   - the featured carousel: previous / next buttons, arrow keys on the focused carousel, a "1 / 5" counter. No autoplay.
 *   - the review wall: shows the first cards and a "Show more reviews" button; long reviews are cut with a "Read more" button.
 * Without this script every review is fully visible (the markup is complete, the script only hides and reveals).
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WALL_FIRST = 9;

  function initCarousel(root) {
    var viewport = root.querySelector('.crv-viewport');
    var slides = root.querySelectorAll('.crv-viewport .crv-slide');
    var prev = root.querySelector('.crv-prev');
    var next = root.querySelector('.crv-next');
    var count = root.querySelector('.crv-count');
    if (!viewport || slides.length < 2) return;
    var raf = 0;

    function index() {
      var w = viewport.clientWidth || 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(viewport.scrollLeft / w)));
    }
    function paint() {
      var i = index();
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      viewport.scrollTo({ left: i * viewport.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    viewport.addEventListener('scroll', function () {
      if (raf) return;
      raf = window.requestAnimationFrame(function () { raf = 0; paint(); });
    }, { passive: true });
    if (prev) prev.addEventListener('click', function () { go(index() - 1); });
    if (next) next.addEventListener('click', function () { go(index() + 1); });
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index() - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index() + 1); }
    });
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        var i = index();
        viewport.scrollTo({ left: i * viewport.clientWidth, behavior: 'auto' });
        paint();
      }, 120);
    });
    paint();
  }

  function initWall(root) {
    var list = root.querySelector('.crv-wall-list');
    if (!list) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('.crv-card'));

    if (cards.length > WALL_FIRST) {
      cards.slice(WALL_FIRST).forEach(function (c) { c.hidden = true; });
      var wrap = document.createElement('div');
      wrap.className = 'crv-more-wrap';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crv-more';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'Show ' + (cards.length - WALL_FIRST) + ' more reviews';
      btn.addEventListener('click', function () {
        cards.forEach(function (c) { c.hidden = false; });
        btn.setAttribute('aria-expanded', 'true');
        wrap.parentNode.removeChild(wrap);
        measure();
      });
      wrap.appendChild(btn);
      list.parentNode.insertBefore(wrap, list.nextSibling);
    }

    // long reviews: cut to a few lines, with a "Read more" button that appears only where the text is really cut
    function measure() {
      cards.forEach(function (card) {
        if (card.hidden) return;
        var text = card.querySelector('.crv-text');
        if (!text) return;
        var btn = card.querySelector('.crv-readmore');
        if (card.classList.contains('is-open')) return;
        text.classList.add('is-clamped');
        var cut = text.scrollHeight > text.clientHeight + 2;
        if (cut && !btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'crv-readmore';
          btn.setAttribute('aria-expanded', 'false');
          btn.textContent = 'Read more';
          btn.addEventListener('click', function () {
            var open = card.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.textContent = open ? 'Show less' : 'Read more';
            if (!open) measure();
          });
          text.parentNode.insertBefore(btn, text.nextSibling);
        } else if (!cut && btn) {
          btn.parentNode.removeChild(btn);
          text.classList.remove('is-clamped');
        }
      });
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    var t = 0;
    window.addEventListener('resize', function () { window.clearTimeout(t); t = window.setTimeout(measure, 150); });
  }

  function init() {
    var roots = document.querySelectorAll('.crv');
    Array.prototype.forEach.call(roots, function (root) {
      root.classList.add('crv-js');
      if (root.querySelector('.crv-viewport')) initCarousel(root);
      if (root.querySelector('.crv-wall-list')) initWall(root);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
