/* Monthly Insights are fixed editorial snapshots, independent of the live feed. */
(function () {
  'use strict';
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function monthKey(panel) {
    var explicit = panel.getAttribute('data-insights-month');
    if (explicit !== null) return /^\d{4}-(0[1-9]|1[0-2])$/.test(explicit) ? explicit : null;
    var heading = panel.querySelector('h1,h2,h3,h4,h5,h6');
    var match = heading && heading.textContent.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
    if (!match) return null;
    var index = months.findIndex(function (name) {
      return name.slice(0, 3).toLowerCase() === match[1].slice(0, 3).toLowerCase();
    });
    return match[2] + '-' + String(index + 1).padStart(2, '0');
  }

  function setupToolbar(wrap, slot, entries) {
    const sourceHeaders = entries.map(entry => entry.panel.querySelector('.index-header-wrap'));
    if (sourceHeaders.some(header => !header || !header.querySelector('.index-heading'))) return null;
    const toolbar = sourceHeaders[0].cloneNode(false);
    toolbar.removeAttribute('id');
    toolbar.removeAttribute('data-w-id');
    toolbar.classList.add('insights_toolbar_wrap');
    const title = sourceHeaders[0].querySelector('.index-heading').cloneNode(true);
    title.removeAttribute('id');
    title.classList.add('insights_toolbar_title');
    toolbar.appendChild(title);
    wrap.insertBefore(toolbar, slot);
    toolbar.appendChild(slot);
    slot.classList.add('insights_toolbar_slot');
    entries.forEach((entry, index) => {
      entry.title = sourceHeaders[index].querySelector('.index-heading').textContent;
      sourceHeaders[index].classList.add('insights_month_header');
    });
    const tabs = wrap.closest('.index-tabs');
    const tabWrap = wrap.closest('.index-tabs-wrap');
    const content = wrap.closest('.index-tabs-content');
    const pane = wrap.closest('.w-tab-pane');
    const menu = tabs && tabs.querySelector('.index-tabs-menu');
    const mobileTabs = tabWrap && tabWrap.querySelector('.dd_tabs');
    // Site navigation is outside the Insights component; only its occupied height is read.
    const nav = document.querySelector('.nav_component');
    const surface = getComputedStyle(document.body).backgroundColor;
    wrap.style.setProperty('--insights-surface', surface);
    if (menu) menu.classList.add('insights_sticky_tabs');
    if (mobileTabs) mobileTabs.classList.add('insights_sticky_mobile');
    if (content) content.classList.add('insights_sticky_content');
    let frame = 0;
    function measure() {
      frame = 0;
      const active = !pane || pane.classList.contains('w--tab-active');
      if (content) content.classList.toggle('is-active', active);
      let navHeight = 0;
      if (nav && ['sticky', 'fixed'].includes(getComputedStyle(nav).position)) {
        const bounds = nav.getBoundingClientRect();
        if (bounds.top <= 1) navHeight = Math.max(0, bounds.bottom);
      }
      const mobile = mobileTabs && getComputedStyle(mobileTabs).display !== 'none';
      if (content) {
        content.classList.toggle('insights_mobile_content', Boolean(mobile));
        // The legacy mobile script writes a negative inline margin only at page load.
        // Remove it when returning to desktop so Webflow's authored spacing applies.
        if (!mobile && parseFloat(content.style.marginTop) < 0) content.style.removeProperty('margin-top');
      }
      const tabHeight = mobile ? mobileTabs.getBoundingClientRect().height :
        (menu ? menu.getBoundingClientRect().height : 0);
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const rem = value => value / rootSize + 'rem';
      wrap.style.setProperty('--insights-toolbar-top', rem(navHeight + tabHeight));
      if (menu) {
        menu.style.setProperty('--insights-tabs-top', rem(navHeight + (mobile ? tabHeight : 0)));
      }
      if (mobileTabs) mobileTabs.style.setProperty('--insights-nav-top', rem(navHeight));
      // The site's mobile menu is visually collapsed but still occupies layout height.
      // Recalculate its existing compensation on resize as well as first load.
      if (content && menu) {
        content.style.setProperty('--insights-content-offset', mobile ?
          rem(-menu.getBoundingClientRect().height + 24) : '0rem');
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(schedule);
      [menu, mobileTabs, nav, toolbar].filter(Boolean).forEach(element => observer.observe(element));
    }
    if (pane && window.MutationObserver) {
      new MutationObserver(schedule).observe(pane, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    measure();
    return function (entry) { title.textContent = entry.title; };
  }

  function init() {
    document.querySelectorAll('.insights-tab-wrap').forEach(function (wrap) {
      if (wrap.dataset.insightsReady) return;
      var slot = wrap.querySelector('.insights-tab-dropdown');
      // Explicit monthly sections may sit inside one shared layout wrapper.
      var selector = '[data-insights-month], .monthly-insights, .tab-pane-wrapper';
      var candidates = wrap.querySelectorAll(selector);
      var panels = Array.from(candidates).filter(function (panel) {
        return panel.closest('.insights-tab-wrap') === wrap && !panel.querySelector(selector);
      });
      if (!slot || !panels.length) return;
      var seen = new Set();
      var entries = panels.map(function (panel) {
        return { panel: panel, key: monthKey(panel) };
      });
      // Leave authored content untouched if a month cannot be identified uniquely.
      if (entries.some(function (entry) {
        if (!entry.key || seen.has(entry.key)) return true;
        seen.add(entry.key);
        return false;
      })) {
        console.warn('Z47 Insights: add a unique data-insights-month="YYYY-MM" to each monthly wrapper.');
        return;
      }
      entries.sort(function (a, b) { return b.key.localeCompare(a.key); });
      var select = document.createElement('select');
      select.className = 'z47-insights-month-select';
      select.setAttribute('aria-label', 'Insights month');
      entries.forEach(function (entry, index) {
        var option = document.createElement('option');
        option.value = entry.key;
        option.textContent = months[Number(entry.key.slice(5)) - 1] + ' ' + entry.key.slice(0, 4) + (index === 0 ? ' - Latest' : '');
        select.appendChild(option);
      });
      const updateToolbar = setupToolbar(wrap, slot, entries);
      if (updateToolbar) select.classList.add('insights_toolbar_select');
      var currentKey;
      var transitions = [];
      var revision = 0;
      var container = panels[0].parentElement;
      var resizeContainer = container !== wrap && !container.contains(slot) &&
        panels.every(function (panel) { return panel.parentElement === container; });
      var restoreOverflow;
      function cancelTransitions() {
        transitions.forEach(function (animation) { animation.cancel(); });
        transitions = [];
        if (restoreOverflow) { restoreOverflow(); restoreOverflow = null; }
      }
      function activate(key) {
        entries.forEach(function (entry) {
          var active = entry.key === key;
          entry.panel.classList.toggle('hide', !active);
          entry.panel.hidden = !active;
          entry.panel.setAttribute('aria-hidden', String(!active));
        });
        currentKey = key;
        if (updateToolbar) updateToolbar(entries.find(function (entry) { return entry.key === key; }));
      }
      async function show(key, animate) {
        var request = ++revision;
        cancelTransitions();
        if (key === currentKey) return;
        var selected = entries.find(function (entry) { return entry.key === key; });
        var previous = entries.find(function (entry) { return entry.key === currentKey; });
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!selected) return;
        if (!animate || !previous || !selected.panel.animate || reduced) {
          activate(key);
          return;
        }
        try {
          var oldHeight = resizeContainer ? container.getBoundingClientRect().height : 0;
          var outgoing = previous.panel.animate([
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-6px)' }
          ], { duration: 160, easing: 'ease-in', fill: 'forwards' });
          transitions.push(outgoing);
          await outgoing.finished;
          if (request !== revision) return;
          activate(key);
          var incoming = selected.panel.animate([
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
          transitions.push(incoming);
          var finished = [incoming.finished];
          if (resizeContainer) {
            var newHeight = container.getBoundingClientRect().height;
            var overflow = container.style.getPropertyValue('overflow');
            var priority = container.style.getPropertyPriority('overflow');
            restoreOverflow = function () {
              if (overflow) container.style.setProperty('overflow', overflow, priority);
              else container.style.removeProperty('overflow');
            };
            container.style.overflow = 'hidden';
            var resize = container.animate([
              { height: oldHeight + 'px' }, { height: newHeight + 'px' }
            ], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            transitions.push(resize);
            finished.push(resize.finished);
          }
          await Promise.all(finished);
          if (request === revision) cancelTransitions();
        } catch (error) {
          // A newer selection cancels the old sequence; it must never restore stale content.
          if (request === revision) {
            cancelTransitions();
            activate(key);
          }
        }
      }
      select.addEventListener('change', function () { show(select.value, true); });
      select.value = entries[0].key;
      show(select.value);
      slot.appendChild(select);
      wrap.dataset.insightsReady = 'true';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
