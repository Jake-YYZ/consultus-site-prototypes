/* Loop videos (muted, looping, no sound): each clip loads and plays only while it is on or near the screen, so opening a page
   no longer downloads every clip up front. Markup: <video muted loop playsinline preload="none" aria-hidden="true">, no autoplay.
   Visitors who ask for reduced motion get the first frame and no playback. */
(function () {
  var vids = [].slice.call(document.querySelectorAll('video[preload="none"]'));
  if (!vids.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if (reduce) { vids.forEach(function (v) { v.preload = 'metadata'; v.load(); }); return; }
  if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
  var visible = new Set();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { visible.add(v); play(v); }
      else { visible.delete(v); if (!v.paused) v.pause(); }
    });
  }, { rootMargin: '300px' });
  vids.forEach(function (v) { io.observe(v); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) visible.forEach(play); });
})();
