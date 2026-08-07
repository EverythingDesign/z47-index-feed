(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
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
  function fmtPct(n) {
    return (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";
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
  function paint(c, meta) {
    if (!c) return;
    setText(co("name"), c.name || "—");
    setText(co("price"), money(c.price, c.ccy));
    setText(co("current_price"), money(c.price, c.ccy));
    paintDaily(co("daily_pct"), c.daily_pct);
    if (meta && meta.generated_at_ist) setText(co("as_of"), meta.generated_at_ist);
    if (c.mcap_cr != null && isFinite(c.mcap_cr)) {
      setText(co("mcap_cr"), "₹" + fmtNum(c.mcap_cr, 0) + " Cr.");
    } else if (c.mcap_mn != null && isFinite(c.mcap_mn)) {
      setText(co("mcap_cr"), "₹" + fmtNum(c.mcap_mn / 10, 0) + " Cr.");
    }
    if (c.mcap_usd_mn != null && isFinite(c.mcap_usd_mn)) {
      setText(co("mcap_usd_mn"), "$" + fmtNum(c.mcap_usd_mn, 0) + " mn");
    }
    var r = document.querySelector("[data-z47-company]");
    if (r) {
      if (c.ticker) r.setAttribute("data-z47-ticker", c.ticker);
      if (c.slug) r.setAttribute("data-z47-slug", c.slug);
    }
  }
  function start() {
    var key = resolveKey();
    if (!key.slug && !key.ticker) return;
    fetch(FEED_URL)
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var c = findConstituent(d, key);
        if (!c) return;
        paint(c, d.meta || {});
      })
      .catch(function () { /* keep CMS/static placeholders */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
