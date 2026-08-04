/**
 * Thursday staging overlay — hero cleanup + Insights Read More.
 * Paste into staging page custom code (footer) AFTER the other Z47 scripts.
 * Does NOT run on the live /z47-forty-seven page unless you add it there.
 */
(function () {
  "use strict";

  var STAGING_HINT =
    location.pathname.indexOf("staging") !== -1 ||
    location.search.indexOf("z47_staging=1") !== -1 ||
    document.documentElement.hasAttribute("data-z47-staging");

  // News Read More targets (Pointer 8) — replace with Girish finals if different
  var NEWS_LINKS = {
    zepto: "https://www.thehindubusinessline.com/markets/zepto-earmarks-2298-crore-anchor-book-targets-3-billion-valuation-for-ipo/article71277102.ece",
    moneyview: "https://www.moneycontrol.com/news/business/ipo/moneyview-gets-sebi-nod-to-raise-funds-via-ipo-12987661.html",
    razorpay: "https://www.moneycontrol.com/news/business/startup/razorpay-files-confidential-drhp-with-sebi-for-ipo-sources-12950001.html"
  };

  function hideHeroStatusStrip() {
    // Pointer 1: remove Index Today / Prices / USD clutter from hero
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
    // Broader text match fallback for "Index:" / "Today" / "Prices:" / "FX:" labels
    document.querySelectorAll("div, span, p").forEach(function (el) {
      if (el.children && el.children.length > 3) return;
      var t = (el.textContent || "").trim();
      if (/^(Index:|Today|Prices:|FX:|Takeaway:)$/i.test(t)) {
        var block = el.closest("div") || el;
        if (block && block.innerText && block.innerText.length < 120) {
          block.style.display = "none";
        }
      }
    });
  }

  function wireReadMore() {
    // Prefer explicit data attributes if present in Webflow
    document.querySelectorAll("[data-z47-news]").forEach(function (el) {
      var key = (el.getAttribute("data-z47-news") || "").toLowerCase();
      var url = NEWS_LINKS[key];
      if (!url) return;
      ensureReadMore(el, url);
    });
    // Fallback: find IPO Watch cards by company name text
    ["Zepto", "Moneyview", "Razorpay"].forEach(function (name) {
      var key = name.toLowerCase();
      var url = NEWS_LINKS[key];
      document.querySelectorAll("h1,h2,h3,h4,p,div,strong,em").forEach(function (el) {
        if ((el.textContent || "").replace(/\s+/g, " ").trim().indexOf(name) === -1) return;
        if (el.querySelector && el.querySelector("a[data-z47-readmore]")) return;
        var card = el.closest("div") || el.parentElement;
        if (!card || card.getAttribute("data-z47-news-wired")) return;
        // only wire reasonably small cards
        if ((card.innerText || "").length > 800) return;
        card.setAttribute("data-z47-news-wired", "1");
        ensureReadMore(card, url);
      });
    });
  }

  function ensureReadMore(container, url) {
    var existing = container.querySelector("a[data-z47-readmore]");
    if (existing) {
      existing.href = url;
      existing.target = "_blank";
      existing.rel = "noopener";
      return;
    }
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("data-z47-readmore", "1");
    a.textContent = "Read More";
    a.style.cssText = "display:inline-block;margin-top:8px;font-weight:600;text-decoration:underline;";
    container.appendChild(a);
  }

  function markMcapHeader() {
    // Prefer dual label if a header cell mentions mkt cap
    document.querySelectorAll("[data-z47-cell], th, .table-header, div").forEach(function (el) {
      var t = (el.textContent || "").trim().toLowerCase();
      if (t === "mkt cap (₹ mn)" || t === "mkt cap (rs mn)" || t.indexOf("mkt cap") === 0) {
        if (el.getAttribute("data-z47-cell") === "mcap" || /mkt cap/i.test(t)) {
          el.textContent = "Mkt Cap (₹ Cr / $ Mn)";
        }
      }
    });
  }

  function start() {
    if (!STAGING_HINT && !document.querySelector("[data-z47-force-thursday]")) {
      // Still safe helpers that only enhance when hooks exist
      wireReadMore();
      return;
    }
    hideHeroStatusStrip();
    wireReadMore();
    markMcapHeader();
    document.documentElement.setAttribute("data-z47-staging-ready", "1");
    console.info("[z47-staging] Thursday overlay active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
