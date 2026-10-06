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
