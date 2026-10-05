/* Division pages: the hero loop plays at once; every [data-lazy] video loads and plays only
   near the viewport and pauses when it leaves, so the page does not pull every loop on first paint. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function kickHero() { document.querySelectorAll('#indt .ix-fan video').forEach(play); }
  document.addEventListener('DOMContentLoaded', kickHero);
  window.addEventListener('load', kickHero);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kickHero(); });
  window.addEventListener('scroll', kickHero, { once: true });

  function initLazy() {
    var lazy = [].slice.call(document.querySelectorAll('#indt video[data-lazy]'));
    if (!('IntersectionObserver' in window)) {
      lazy.forEach(function (v) { v.preload = 'auto'; if (!reduce) play(v); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (v.preload !== 'auto') v.preload = 'auto'; if (!reduce) play(v); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '300px 0px' });
    lazy.forEach(function (v) { io.observe(v); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLazy);
  else initLazy();
})();
