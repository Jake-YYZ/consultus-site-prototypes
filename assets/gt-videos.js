/* Growth Therapy campaign videos: a .gtv-card[data-wistia] opens that Wistia video in a lightbox (styles: .yt-lightbox in site.css) */
(function () {
  var cards = document.querySelectorAll('.gtv-card[data-wistia]');
  if (!cards.length) return;
  var lb, wrap, closeBtn, lastFocus;

  function build() {
    lb = document.createElement('div');
    lb.className = 'yt-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Video player');
    lb.innerHTML = '<div class="yt-modal"><button type="button" class="yt-close" aria-label="Close video">&times;</button><div class="yt-iframe-wrap"></div></div>';
    document.body.appendChild(lb);
    wrap = lb.querySelector('.yt-iframe-wrap');
    closeBtn = lb.querySelector('.yt-close');
    closeBtn.addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  }

  function open(card) {
    if (!lb) build();
    lastFocus = card;
    var title = card.getAttribute('data-title') || 'Video';
    wrap.innerHTML = '<iframe src="https://fast.wistia.net/embed/iframe/' + encodeURIComponent(card.getAttribute('data-wistia')) +
      '?autoPlay=true&playerColor=1A40C7" title="' + title.replace(/"/g, '&quot;') + '" allow="autoplay; fullscreen; picture-in-picture"></iframe>';
    lb.style.display = 'flex';
    requestAnimationFrame(function () { lb.classList.add('open'); });
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }

  function close() {
    lb.classList.remove('open');
    wrap.innerHTML = '';
    setTimeout(function () { lb.style.display = ''; }, 260);
    document.removeEventListener('keydown', onKey);
    if (lastFocus) lastFocus.focus();
  }

  Array.prototype.forEach.call(cards, function (card) {
    card.addEventListener('click', function () { open(card); });
  });
})();
