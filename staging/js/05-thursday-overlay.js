/**
 * Thursday staging overlay — hero cleanup + Insights Read More (dedupe) + mcap headers.
 */
(function () {
  "use strict";

  var STAGING_HINT =
    location.pathname.indexOf("staging") !== -1 ||
    location.search.indexOf("z47_staging=1") !== -1 ||
    document.documentElement.hasAttribute("data-z47-staging");

  var NEWS_LINKS = {
    zepto: "https://www.thehindubusinessline.com/markets/zepto-earmarks-2298-crore-anchor-book-targets-3-billion-valuation-for-ipo/article71277102.ece",
    moneyview: "https://www.moneycontrol.com/news/business/ipo/moneyview-gets-sebi-nod-to-raise-funds-via-ipo-12987661.html",
    razorpay: "https://www.moneycontrol.com/news/business/startup/razorpay-files-confidential-drhp-with-sebi-for-ipo-sources-12950001.html"
  };

  function hideHeroStatusStrip() {
    var keys = [
      "status-prices", "status-fx", "status-takeaway",
      "card-fx-value", "card-fx-change", "card-fx-time"
    ];
    keys.forEach(function (k) {
      document.querySelectorAll('[data-z47="' + k + '"]').forEach(function (el) {
        var row = el.closest(".z47-status, .hero-status, .status-strip, [data-z47-status-row]") || el.parentElement;
        if (row) row.style.display = "none";
        else el.style.display = "none";
      });
    });
  }

  function stripInjectedPeriodTabs() {
    document.querySelectorAll('[data-z47="period-tabs"]').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /** Keep ONE Read More per IPO card — prefer existing rich-text links; remove extras. */
  function wireReadMore() {
    var section = document.querySelector(".kissht-ipo, .kishtt-ipo, [class*='ipo']");
    var root = section || document;

    // Remove JS/WHTML-injected duplicates first
    root.querySelectorAll("a[data-z47-readmore]").forEach(function (a) {
      a.parentNode && a.parentNode.removeChild(a);
    });

    ["Zepto", "Moneyview", "Razorpay"].forEach(function (name) {
      var key = name.toLowerCase();
      var url = NEWS_LINKS[key];
      if (!url) return;

      // Find a text node / element that mentions the company inside IPO area
      var host = null;
      root.querySelectorAll("div, p, li, span, strong, em, a").forEach(function (el) {
        if (host) return;
        var t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t.indexOf(name) === -1) return;
        if (t.length > 500) return;
        host = el.closest(".w-richtext, [class*='pointer'], [class*='ipo'], div") || el.parentElement || el;
      });
      if (!host) return;

      // Prefer an existing "Read More" anchor inside the card
      var links = Array.prototype.slice.call(host.querySelectorAll("a")).filter(function (a) {
        return /read\s*more/i.test((a.textContent || "").trim());
      });
      // Also search siblings one level up
      if (!links.length && host.parentElement) {
        links = Array.prototype.slice.call(host.parentElement.querySelectorAll("a")).filter(function (a) {
          return /read\s*more/i.test((a.textContent || "").trim());
        });
      }

      if (links.length) {
        // Keep first, point it at the URL; remove the rest
        links.forEach(function (a, i) {
          if (i === 0) {
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener";
            a.setAttribute("data-z47-readmore", "1");
          } else {
            a.parentNode && a.parentNode.removeChild(a);
          }
        });
        return;
      }

      // No existing link — add exactly one
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("data-z47-readmore", "1");
      a.textContent = "Read More";
      a.style.cssText = "display:inline-block;margin-top:8px;font-weight:600;text-decoration:underline;";
      host.appendChild(a);
    });
  }

  function markMcapHeaders() {
    // Split single dual header into ₹ Cr + $ Mn when possible
    document.querySelectorAll("div, span, th, p").forEach(function (el) {
      if (el.children && el.children.length > 0) return;
      var t = (el.textContent || "").trim();
      if (!t) return;
      var low = t.toLowerCase();
      if (low === "mkt cap (₹ mn)" || low === "mkt cap (rs mn)" || low === "mkt cap (₹ cr / $ mn)" ||
          low === "mkt cap (rs cr / $ mn)" || /^mkt cap/i.test(t) && /cr\s*\/\s*\$/i.test(t)) {
        el.textContent = "Mkt Cap (\u20B9 Cr)";
        // Insert sibling header for USD if parent is a header cell row
        var cell = el.closest(".summary-th, th, [class*='header']") || el.parentElement;
        if (cell && cell.parentNode && !cell.parentNode.querySelector("[data-z47-mcap-usd-header]")) {
          var usd = cell.cloneNode(true);
          usd.setAttribute("data-z47-mcap-usd-header", "1");
          var textEl = usd.querySelector("div, span") || usd;
          // find deepest text-ish
          var leaf = usd;
          while (leaf.children && leaf.children.length === 1) leaf = leaf.children[0];
          if (leaf.childNodes.length && leaf.childNodes[0].nodeType === 3) leaf.childNodes[0].textContent = "Mkt Cap ($ Mn)";
          else {
            var inner = usd.querySelector("div, span");
            if (inner && !inner.children.length) inner.textContent = "Mkt Cap ($ Mn)";
            else leaf.textContent = "Mkt Cap ($ Mn)";
          }
          cell.parentNode.insertBefore(usd, cell.nextSibling);
        }
      } else if (low === "mkt cap (₹ cr)" || low.indexOf("mkt cap") === 0 && low.indexOf("cr") !== -1 && low.indexOf("$") === -1) {
        // already cr-only; still ensure usd sibling once
        el.textContent = "Mkt Cap (\u20B9 Cr)";
      }
    });
  }

  function start() {
    stripInjectedPeriodTabs();
    if (!STAGING_HINT && !document.querySelector("[data-z47-force-thursday]")) {
      wireReadMore();
      return;
    }
    hideHeroStatusStrip();
    wireReadMore();
    markMcapHeaders();
    document.documentElement.setAttribute("data-z47-staging-ready", "1");
    console.info("[z47-staging] Thursday overlay active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
