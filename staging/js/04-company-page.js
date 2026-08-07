(function () {
  "use strict";
  var INDEX_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  var COMPANY_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/data/companies/";
  var UP = "ai-color-parrotgreen", DOWN = "ai-color-red";
  var POS_COLOR = "#249200", NEG_COLOR = "#D31F03";

  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function root() { return document.querySelector("[data-z47-company]") || document; }
  function co(k) { return $all('[data-z47-co="' + k + '"]', root()); }
  function setText(els, text) {
    els.forEach(function (el) { el.textContent = text; });
  }
  function fmtNum(n, d) {
    return Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d == null ? 0 : d
    });
  }
  function fmtPct(n, d) {
    d = d == null ? 2 : d;
    return (n >= 0 ? "+" : "") + Number(n).toFixed(d) + "%";
  }
  function money(price, ccy) {
    if (price == null || !isFinite(price)) return "—";
    return (ccy === "USD" ? "$" : "₹") + fmtNum(price, 2);
  }
  function slugFromPath() {
    var parts = (location.pathname || "").split("/").filter(Boolean);
    var i = parts.indexOf("companies");
    if (i >= 0 && parts[i + 1]) return parts[i + 1].toLowerCase();
    return "";
  }
  function resolveKey() {
    var r = document.querySelector("[data-z47-company]");
    var slug = (r && r.getAttribute("data-z47-slug")) || slugFromPath();
    var ticker = (r && r.getAttribute("data-z47-ticker")) || "";
    return { slug: (slug || "").toLowerCase(), ticker: (ticker || "").toUpperCase() };
  }
  function findConstituent(d, key) {
    var list = d.constituents || [];
    var i, c;
    if (key.slug) {
      for (i = 0; i < list.length; i++) {
        c = list[i];
        if ((c.slug || "").toLowerCase() === key.slug) return c;
        if ((c.ticker || "").toLowerCase() === key.slug) return c;
      }
    }
    if (key.ticker) {
      for (i = 0; i < list.length; i++) {
        c = list[i];
        if ((c.ticker || "").toUpperCase() === key.ticker) return c;
      }
    }
    return null;
  }
  function paintDaily(els, n) {
    els.forEach(function (el) {
      el.classList.remove(UP, DOWN);
      if (n == null || !isFinite(n)) {
        el.textContent = "—";
        el.style.color = "#9a9a9a";
        return;
      }
      el.textContent = fmtPct(n);
      el.classList.add(n >= 0 ? UP : DOWN);
      el.style.color = n >= 0 ? POS_COLOR : NEG_COLOR;
    });
  }
  function setMetricByLabel(labelRe, text) {
    $all(".screener-hero-mk", root()).forEach(function (row) {
      var key = row.querySelector(".screener-hero-key");
      var val = row.querySelector(".screener-hero-value") || row.querySelector("[data-z47-co]");
      if (!key || !val) return;
      if (labelRe.test((key.textContent || "").trim())) val.textContent = text;
    });
  }
  function setLink(coKey, href, label) {
    co(coKey).forEach(function (a) {
      if (href) {
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
      var tag = a.querySelector(".ai-tag-2, .uppercase, span, div");
      if (tag) tag.textContent = label;
      else {
        var kids = a.childNodes;
        var i;
        for (i = kids.length - 1; i >= 0; i--) {
          if (kids[i].nodeType === 3 && kids[i].textContent.trim()) {
            kids[i].textContent = label;
            return;
          }
        }
        a.appendChild(document.createTextNode(label));
      }
    });
  }
  function paintIndex(c, meta) {
    if (!c) return;
    setText(co("name"), c.name || "—");
    setText(co("price"), money(c.price, c.ccy));
    paintDaily(co("daily_pct"), c.daily_pct);
    if (meta && meta.generated_at_ist) setText(co("as_of"), meta.generated_at_ist);
    if (c.mcap_cr != null && isFinite(c.mcap_cr)) {
      setMetricByLabel(/^Market\s*Cap$/i, "₹" + fmtNum(c.mcap_cr, 0) + " Cr.");
      setText(co("mcap_cr"), "₹" + fmtNum(c.mcap_cr, 0) + " Cr.");
    }
    setMetricByLabel(/^Current\s*Price$/i, money(c.price, c.ccy));
    setText(co("current_price"), money(c.price, c.ccy));
  }
  function paintHero(h, ccy) {
    if (!h) return;
    if (h.about) setText(co("about"), h.about);
    if (h.pe != null && isFinite(h.pe)) {
      var peTxt = fmtNum(h.pe, 1);
      setMetricByLabel(/^(Stock\s*)?P\/?E$/i, peTxt);
      setText(co("pe"), peTxt);
    }
    if (h.roce != null && isFinite(h.roce)) {
      var roceTxt = fmtNum(h.roce, 1) + "%";
      setMetricByLabel(/^ROCE$/i, roceTxt);
      setText(co("roce"), roceTxt);
    }
    if (h.roe != null && isFinite(h.roe)) {
      var roeTxt = fmtNum(h.roe, 1) + "%";
      setMetricByLabel(/^ROE$/i, roeTxt);
      setText(co("roe"), roeTxt);
    }
    if (h.high != null && h.low != null && isFinite(h.high) && isFinite(h.low)) {
      var hl = "₹" + fmtNum(h.high, 0) + " / " + fmtNum(h.low, 0);
      setMetricByLabel(/^High\s*\/?\s*Low$/i, hl);
      setText(co("high_low"), hl);
    }
    if (h.mcap_cr != null && isFinite(h.mcap_cr)) {
      setMetricByLabel(/^Market\s*Cap$/i, "₹" + fmtNum(h.mcap_cr, 0) + " Cr.");
    }
    if (h.website) {
      setLink("link-web", h.website, (h.website_label || h.website).toUpperCase());
    }
    if (h.bse_code) {
      setLink("link-bse", h.bse_url || "#", "BSE : " + h.bse_code);
    }
    if (h.nse_symbol) {
      setLink("link-nse", h.nse_url || "#", "NSE : " + h.nse_symbol);
    }
    if (h.name) setText(co("name"), h.name);
  }
  function start() {
    var key = resolveKey();
    if (!key.slug && !key.ticker) return;
    var slug = key.slug || key.ticker.toLowerCase();
    var indexP = fetch(INDEX_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; });
    var heroP = fetch(COMPANY_URL + encodeURIComponent(slug) + ".json")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return null; });
    Promise.all([indexP, heroP]).then(function (pair) {
      var d = pair[0], h = pair[1];
      var c = d ? findConstituent(d, key) : null;
      if (c) paintIndex(c, d.meta || {});
      if (h) paintHero(h, c && c.ccy);
      var r = document.querySelector("[data-z47-company]");
      if (r) {
        var t = (h && h.ticker) || (c && c.ticker);
        var s = (h && h.slug) || (c && c.slug) || slug;
        if (t) r.setAttribute("data-z47-ticker", t);
        if (s) r.setAttribute("data-z47-slug", s);
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
