/* Mobile menu (phones and tablets, 900px and under).
 *
 * The header's burger button (<button class="nav-toggle"> inside .nav-links) opens a slide-down panel.
 * The panel is built here from the page's OWN header links and Services menu (#services-mega-menu), so the
 * phone menu always matches the desktop header and there is no second list to keep in sync. Styles live in
 * /assets/css/site.css (search "MOBILE MENU"). Every page that has the header loads this script.
 *
 * It also makes the desktop Services menu work from the keyboard (see megaMenu below).
 */
(function () {
  'use strict';

  var nav = document.querySelector('nav.main');
  if (!nav) return;
  var toggle = nav.querySelector('.nav-toggle');

  /* Desktop Services menu. The header's "Services" is an <a> without an href that opens #services-mega-menu with a
     click (toggleMega, defined in each page), so the keyboard could never reach it, a screen reader did not announce
     it, and the menu itself sits at the very end of <body>. Here the trigger and the Acquire / Convert / Scale tabs
     become real buttons, Enter or Space opens the menu and moves focus into it, and Escape closes it again. */
  function megaMenu() {
    var trigger = nav.querySelector('.nav-links > a:not([href])');
    var mega = document.getElementById('services-mega-menu');
    if (!trigger || !mega) return;
    var tabs = Array.prototype.slice.call(mega.querySelectorAll('.mega-div[data-tab]'));

    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-label', (trigger.textContent || '').replace(/[▾▼]/g, '').replace(/\s+/g, ' ').trim() || 'Services');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-controls', mega.id);
    trigger.setAttribute('aria-expanded', 'false');
    tabs.forEach(function (tab) {
      tab.setAttribute('role', 'button');
      tab.setAttribute('tabindex', '0');
    });

    function isOpen() { return mega.classList.contains('open'); }
    function sync() { trigger.setAttribute('aria-expanded', isOpen() ? 'true' : 'false'); }
    /* Whoever opens or closes the menu (the trigger, the page's overlay, a link inside it), aria-expanded follows. */
    if (window.MutationObserver) new MutationObserver(sync).observe(mega, { attributes: true, attributeFilter: ['class'] });

    function onPress(el, run) {
      el.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); run(); }
      });
    }
    onPress(trigger, function () {
      trigger.click();
      if (isOpen()) {
        var first = mega.querySelector('.mega-div.active') || tabs[0];
        if (first) first.focus();
      }
    });
    tabs.forEach(function (tab) { onPress(tab, function () { tab.click(); }); });

    document.addEventListener('keydown', function (event) {
      if ((event.key !== 'Escape' && event.key !== 'Esc') || !isOpen()) return;
      var wasInside = mega.contains(document.activeElement) || document.activeElement === trigger;
      if (typeof window.closeMega === 'function') window.closeMega();
      if (wasInside) trigger.focus();
    });
  }
  megaMenu();

  if (!toggle) return;

  var root = document.documentElement;
  var mq = window.matchMedia('(max-width: 900px)');
  var panel = null;
  var isOpen = false;
  var inerted = [];

  function make(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  /* Visible label of an element, without badges, icons or the dropdown arrow. */
  function label(node) {
    var copy = node.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('.nav-badge, .mega-badge, svg'), function (n) { n.remove(); });
    return copy.textContent.replace(/[\u25BE\u25BC]/g, '').replace(/\s+/g, ' ').trim();
  }

  function cleanPath(path) {
    return path.replace(/index\.html$/, '').replace(/\/+$/, '');
  }

  function isCurrent(link) {
    return link.origin === location.origin && cleanPath(link.pathname) === cleanPath(location.pathname);
  }

  /* The three service groups (Acquire, Convert, Scale) from the desktop Services menu. */
  function readServices() {
    var mega = document.getElementById('services-mega-menu');
    if (!mega) return [];
    var groups = [];
    Array.prototype.forEach.call(mega.querySelectorAll('.mega-div[data-tab]'), function (tab) {
      var grid = mega.querySelector('.mega-grid[data-panel="' + tab.getAttribute('data-tab') + '"]');
      if (!grid) return;
      var items = [];
      Array.prototype.forEach.call(grid.querySelectorAll('a.mega-card[href]'), function (card) {
        var title = card.querySelector('.mega-title') || card;
        var badge = title.querySelector('.mega-badge');
        items.push({
          href: card.getAttribute('href'),
          text: label(title),
          badge: badge ? badge.textContent.trim() : '',
          badgeClass: badge ? badge.className.replace('mega-badge', '').trim() : ''
        });
      });
      var num = tab.querySelector('.mega-div-num');
      var name = tab.querySelector('.mega-div-name');
      if (items.length && name) groups.push({ num: num ? label(num) : '', name: label(name), items: items });
    });
    return groups;
  }

  function buildServices(title) {
    var groups = readServices();
    if (!groups.length) return null;

    var item = make('li', 'mnav-item');
    var button = make('button', 'mnav-link mnav-sub-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'mnav-services');
    var text = make('span');
    text.textContent = title;
    var chevron = make('span', 'mnav-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    button.appendChild(text);
    button.appendChild(chevron);

    var sub = make('div', 'mnav-sub');
    sub.id = 'mnav-services';
    sub.hidden = true;
    var onServicePage = false;

    groups.forEach(function (group) {
      var block = make('div', 'mnav-group');
      var heading = make('p', 'mnav-group-label');
      heading.textContent = (group.num ? group.num + ' / ' : '') + group.name;
      var list = make('ul', 'mnav-group-list');
      group.items.forEach(function (entry) {
        var li = make('li');
        var a = make('a');
        a.setAttribute('href', entry.href);
        a.appendChild(document.createTextNode(entry.text));
        if (entry.badge) {
          var badge = make('span', ('mnav-badge ' + entry.badgeClass).trim());
          badge.textContent = entry.badge;
          a.appendChild(badge);
        }
        if (isCurrent(a)) { a.setAttribute('aria-current', 'page'); onServicePage = true; }
        li.appendChild(a);
        list.appendChild(li);
      });
      block.appendChild(heading);
      block.appendChild(list);
      sub.appendChild(block);
    });

    function setExpanded(open) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      sub.hidden = !open;
    }
    button.addEventListener('click', function () {
      setExpanded(button.getAttribute('aria-expanded') !== 'true');
    });
    if (onServicePage) setExpanded(true);

    item.appendChild(button);
    item.appendChild(sub);
    return item;
  }

  function build() {
    var el = make('nav', 'mobile-nav');
    el.id = 'mobile-nav';
    el.setAttribute('aria-label', 'Mobile menu');
    el.setAttribute('tabindex', '-1');
    el.hidden = true;

    var list = make('ul', 'mnav-list');
    var cta = null;
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-links > a'), function (a) {
      if (a.classList.contains('nav-cta')) { cta = a; return; }
      var href = a.getAttribute('href');
      if (!href) {
        var services = buildServices(label(a) || 'Services');
        if (services) list.appendChild(services);
        return;
      }
      var li = make('li', 'mnav-item');
      var link = make('a', 'mnav-link');
      link.setAttribute('href', href);
      link.textContent = label(a);
      if (isCurrent(link)) link.setAttribute('aria-current', 'page');
      li.appendChild(link);
      list.appendChild(li);
    });
    el.appendChild(list);

    if (cta) {
      var foot = make('div', 'mnav-foot');
      var button = make('a', 'mnav-cta');
      button.setAttribute('href', cta.getAttribute('href'));
      button.textContent = label(cta);
      foot.appendChild(button);
      el.appendChild(foot);
    }

    el.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link) return;
      /* A link to a spot on this same page keeps the page open, so close the menu. */
      if (link.hash && link.origin === location.origin && cleanPath(link.pathname) === cleanPath(location.pathname)) close(false);
    });

    nav.parentNode.insertBefore(el, nav.nextSibling);
    return el;
  }

  /* Everything except the header and the menu is switched off while the menu is open. */
  function setInert(on) {
    if (on) {
      inerted = [];
      Array.prototype.forEach.call(document.body.children, function (child) {
        if (child === panel || child.contains(nav) || child.contains(panel)) return;
        if (/^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(child.tagName)) return;
        if (child.hasAttribute('inert')) return;
        child.setAttribute('inert', '');
        inerted.push(child);
      });
    } else {
      inerted.forEach(function (child) { child.removeAttribute('inert'); });
      inerted = [];
    }
  }

  /* The panel lines up with the header itself. It is sized from the header's measured box, not from the viewport,
     because on a page with content wider than the screen a phone's layout viewport can be wider than the header. */
  function placePanel() {
    if (!panel) return;
    var box = nav.getBoundingClientRect();
    panel.style.setProperty('--mnav-top', Math.round(box.bottom) + 'px');
    panel.style.setProperty('--mnav-left', Math.round(box.left) + 'px');
    panel.style.setProperty('--mnav-w', Math.round(box.width) + 'px');
  }

  function open() {
    if (isOpen || !mq.matches) return;
    if (!panel) panel = build();
    isOpen = true;
    placePanel();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    root.classList.add('mnav-open');
    setInert(true);
    panel.focus({ preventScroll: true });
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    root.classList.remove('mnav-open');
    setInert(false);
    if (returnFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', function () {
    if (isOpen) close(true); else open();
  });

  document.addEventListener('keydown', function (event) {
    if (isOpen && (event.key === 'Escape' || event.key === 'Esc')) {
      event.preventDefault();
      close(true);
    }
  });

  window.addEventListener('resize', function () { if (isOpen) placePanel(); });
  /* Back/forward can restore this page with the menu still open. */
  window.addEventListener('pageshow', function (event) { if (event.persisted) close(false); });

  function onBreakpoint(event) { if (!event.matches) close(false); }
  if (mq.addEventListener) mq.addEventListener('change', onBreakpoint);
  else if (mq.addListener) mq.addListener(onBreakpoint);

  /* Built up front, so the burger's aria-controls points at a real element and the first tap has nothing to wait for. */
  panel = build();
})();
