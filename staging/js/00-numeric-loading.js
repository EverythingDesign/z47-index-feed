/* Head companion: an unavailable feed must never reveal Designer placeholders. */
(function () {
  "use strict";
  var selector = '[data-z47^="card-"], [data-z47^="ret-z47-"], [data-z47^="ret-nifty-"], ' +
    '[data-z47="hero-z47-pct"], [data-z47="hero-nifty-pct"], ' +
    '[data-z47="chart-z47-pct"], [data-z47="chart-nifty-pct"]';
  function failPending() {
    document.querySelectorAll(selector).forEach(function (el) {
      if (el.hasAttribute("data-z47-value-state")) return;
      el.textContent = "—";
      el.setAttribute("data-z47-value-state", "unavailable");
      el.setAttribute("aria-label", "Data unavailable");
    });
  }
  var timer;
  window.addEventListener("z47:performance-state", function (event) {
    if (event.detail === "ready" || event.detail === "error") {
      clearTimeout(timer);
      failPending();
    }
  });
  function start() { timer = setTimeout(failPending, 20000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
