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
      var panels = Array.from(wrap.querySelectorAll('.tab-pane-wrapper')).filter(function (panel) {
        return panel.closest('.insights-tab-wrap') === wrap;
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
      entries.forEach(function (entry) {
        var option = document.createElement('option');
        option.value = entry.key;
        option.textContent = months[Number(entry.key.slice(5)) - 1] + ' ' + entry.key.slice(0, 4);
        select.appendChild(option);
      });
      function show(key) {
        entries.forEach(function (entry) {
          var active = entry.key === key;
          entry.panel.classList.toggle('hide', !active);
          entry.panel.hidden = !active;
          entry.panel.setAttribute('aria-hidden', String(!active));
        });
      }
      select.addEventListener('change', function () { show(select.value); });
      select.value = entries[0].key;
      show(select.value);
      slot.appendChild(select);
      wrap.dataset.insightsReady = 'true';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
