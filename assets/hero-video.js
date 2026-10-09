/* Hero videos that play once and stop on the finished frame (the service pages). Markup: <video autoplay muted playsinline poster="...">,
   no loop; the poster is that finished frame. Safari drops the picture of an ended video once it has been scrolled off screen, so the
   box comes back blank. Once such a video has ended and is off screen, hand the box to the poster: same picture, and no one sees the swap. */
(function () {
  var vids = [].slice.call(document.querySelectorAll('video[autoplay][poster]:not([loop])'));
  if (!vids.length) return;
  function release(v) {
    if (!v.getAttribute('src')) return;
    v.removeAttribute('src');
    v.load();
  }
  vids.forEach(function (v) {
    var offscreen = false;
    function check() { if (v.ended && offscreen) release(v); }
    v.addEventListener('ended', check);
    if (!('IntersectionObserver' in window)) { v.addEventListener('ended', function () { release(v); }); return; }
    new IntersectionObserver(function (entries) {
      offscreen = !entries[entries.length - 1].isIntersecting;
      check();
    }).observe(v);
  });
})();
