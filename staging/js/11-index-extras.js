/* Z47 — Index page, Phase 1 extras (3 Nov 2026 review)
   File: staging/js/11-index-extras.js   (load after 01-performance.js)

   Adds, without touching 01-performance.js or the Designer layout:
     1. Chart range: YTD / 1Y / Jan 2024 stay as tabs; 1D, 3D, 1W, 1M, 3M, 6M move into a dropdown
     2. Top Movers: same treatment (1M / 3M / 6M in a dropdown)
     3. Download (PNG / PDF) in place of the LATEST UPDATE badge
     4. End-value labels on the chart lines
     5. Performance tab constituent snapshot: first 7 rows, then Load more
     6. Constituent change log above the Constituents-tab disclaimer, with a "why" tooltip per company
     7. Disclaimer: narrower text column, kept on the right (desktop)

   Reads the feed 01-performance.js already loaded (window.__Z47) and waits for its
   "z47:performance-state" event. If the feed never arrives, the page stays as designed. */
(function () {
  "use strict";
  if (window.__Z47_EXTRAS) return;
  window.__Z47_EXTRAS = true;

  /* ----------------------------- CONFIG ----------------------------------- */
  var Z47_COLOR   = "#EE5A24";   // same as 01-performance.js
  var NIFTY_COLOR = "#3B6FE0";
  var POS_COLOR   = "#249200";
  var NEG_COLOR   = "#D31F03";
  var Z47_LOGO_URL = "https://cdn.prod.website-files.com/678518036ebf6d040622b6b3/6a44aabfc756d243444e2426_zfortyseven.svg";
  var JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var JSPDF_SRI = "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk";
  var PAGE_URL_LABEL = "z47.com/z47-forty-seven";

  // Chart ranges in the dropdown, in menu order. Short ones are counted in NSE sessions.
  var CHART_MENU     = ["1D", "3D", "1W", "1M", "3M", "6M"];
  var MOVERS_MENU    = ["1M", "3M", "6M"];          // Top Movers only has these in the feed
  var SHORT_SESSIONS = { "1D": 1, "3D": 3, "1W": 5 };
  var RANGE_LABELS = {
    "1D": "Last 1 day", "3D": "Last 3 days", "1W": "Last 1 week",
    "1M": "Last 1 month", "3M": "Last 3 months", "6M": "Last 6 months",
    "1Y": "Last 1 year", "YTD": "Year to date", "SINCE": "Since Jan 2024"
  };

  var SNAPSHOT_ROWS = 7;   // Performance tab: rows shown before "Load more"

  // Change log: first effective date shown publicly, and the public "why" per company,
  // by effective date and ticker. Wording from Girish, 12 Nov 2026.
  var CHANGE_LOG_FROM = "2026-06-16";
  var CHANGE_REASONS = {
    "2026-06-16": {
      ANGELONE: "Added to capture the growing scale of digital broking and retail investing.",
      AFFLE: "Added to expand exposure to AI-led advertising and consumer intelligence.",
      AMAGI: "Added to represent global SaaS and cloud-based media infrastructure.",
      FRACTAL: "Added to capture a category-leading enterprise AI and analytics platform.",
      HOMEFIRST: "Reclassified as the index sharpened its focus on new-age fintech platforms.",
      INDIASHLTR: "Refined lending exposure under updated index selection criteria.",
      YATRA: "Rebalanced consumer-tech representation as the eligible universe expanded.",
      NIVABUPA: "Excluded under revised VC-backed criteria, reflecting its strategic and PE-led ownership history."
    },
    "2026-08-20": {
      TURTLEMINT: "Added to capture VC-backed digital insurance distribution.",
      SHIPROCKET: "Added to represent a category-leading ecommerce infrastructure platform.",
      MILKYMIST: "Added to broaden consumer exposure beyond digital platforms into scaled new-age brands.",
      SBICARD: "Excluded under revised VC-backed criteria, given its traditional banking and PE ownership history.",
      MOBIKWIK: "Fintech composition refined to reflect newer entrants and evolving index priorities.",
      UNIECOM: "B2B technology representation reassessed under updated index selection criteria."
    },
    "2026-09-18": {
      RENTOMOJO: "Added to introduce subscription-led consumer rentals and circular-economy exposure.",
      MEDIASSIST: "Refined healthcare-services exposure under the index\u2019s new-age technology focus."
    },
    "2026-10-05": {
      MONEYVIEW: "Added to strengthen exposure to digital lending and financial inclusion.",
      AWFIS: "Rebalanced B2B exposure to accommodate newly eligible technology-led businesses."
    },
    "2026-10-26": {
      ZETWERK: "Added to introduce technology-enabled manufacturing and industrial supply chains.",
      TURTLEMINT: "Fell below the \u20b92,000 Cr market-cap threshold, prompting replacement."
    }
  };
  var CHANGE_NOTE = "Value-neutral: the index level is unchanged on the day of the change.";
  // Names for companies no longer in the index (constituents[] only lists current members).
  var FORMER_NAMES = {
    "SBICARD": "SBI Card", "MOBIKWIK": "MobiKwik", "UNIECOM": "Unicommerce",
    "TURTLEMINT": "Turtlemint", "MEDIASSIST": "Medi Assist", "AWFIS": "Awfis",
    "HOMEFIRST": "Home First Finance", "INDIASHLTR": "India Shelter Finance",
    "YATRA": "Yatra Online", "NIVABUPA": "Niva Bupa", "SMARTWORKS": "Smartworks",
    "360ONE": "360 ONE WAM"
  };

  // The site's double arrow (same SVG as the "Z47 Portfolio" button); rotated down via .button_arrow-wrap.rotate
  var ARROW_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 20 19" fill="none" aria-hidden="true">'
    + '<path d="M19.8772 8.59997H0.122559V6.79997H15.5L10.7363 2.03627L12.0089 0.763672L18.9452 7.69997L19.8772 8.59997Z" fill="currentColor"/>'
    + '<path d="M19.8772 10.4H0.122559V12.2H15.5L10.7363 16.9637L12.0089 18.2363L18.9452 11.3L19.8772 10.4Z" fill="currentColor"/></svg>';
  var CHEVRON_SVG = '<svg class="z47x-menu__chev" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">'
    + '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

  /* ------------------------------ HELPERS --------------------------------- */
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function fin(n) { return typeof n === "number" && isFinite(n); }
  function fmtNum(n, dp) {
    return fin(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "—";
  }
  function fmtPct1(n) { return fin(n) ? (n >= 0 ? "+" : "") + n.toFixed(1) + "%" : "—"; }
  function colorFor(n) { return fin(n) ? (n >= 0 ? POS_COLOR : NEG_COLOR) : ""; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dayLabel(iso, withYear) {
    var o = { day: "numeric", month: "short", timeZone: "UTC" };
    if (withYear) o.year = "numeric";
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", o);
  }
  function monthLabel(iso) {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  function istNow() {
    return new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) + " IST";
  }
  function asOfText(d) {
    return d.meta.market_open
      ? "Intraday, as of " + (d.meta.generated_at_ist || "")
      : "As of close, " + dayLabel(d.meta.data_as_of, true);
  }
  function addStyle(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement("style");
    st.id = id; st.textContent = css;
    (document.head || document.body).appendChild(st);
  }
  function guard(name, fn) {
    try { fn(); } catch (e) { console.error("[z47 extras] " + name + " failed:", e); }
  }
  function chartInstance() {
    var canvas = document.getElementById("z47-chart");
    return canvas && window.Chart && Chart.getChart ? Chart.getChart(canvas) : null;
  }

  // Return over the last n sessions, from the daily closes in history[].
  function sessionReturn(hist, key, n) {
    if (!hist || hist.length <= n) return null;
    var a = hist[hist.length - 1 - n][key], b = hist[hist.length - 1][key];
    return fin(a) && fin(b) && a > 0 ? (b / a - 1) * 100 : null;
  }
  // Return for any chart range: feed returns for the long ones, sessions for the short ones.
  function rangeReturns(d, range) {
    if (SHORT_SESSIONS[range]) {
      return { z47: sessionReturn(d.history, "z47", SHORT_SESSIONS[range]),
               nifty: sessionReturn(d.history, "nifty500", SHORT_SESSIONS[range]) };
    }
    var k = range === "SINCE" ? "since_base" : range;
    return { z47: d.index.returns[k], nifty: d.benchmark.returns[k] };
  }
  var currentRange = "SINCE";   // what the chart shows now; 01-performance's default

  /* ----------------------- 1 + 2. RANGE DROPDOWNS ------------------------- */
  addStyle("z47x-menu-css",
    ".z47x-moved,.z47x-hidden{display:none!important;}"
  + ".z47x-menu{position:relative;display:flex;}"
  + ".z47x-menu > .chart-tabs{width:100%;cursor:pointer;}"
  + ".z47x-menu .chart-tenure-text{display:inline-flex;align-items:center;white-space:nowrap;}"
  + ".z47x-menu__chev{margin-left:6px;flex:0 0 auto;transition:transform .15s ease;}"
  + ".z47x-menu.is-open .z47x-menu__chev{transform:rotate(180deg);}"
  + ".z47x-menu__list{position:absolute;left:0;top:calc(100% + 4px);z-index:30;min-width:100%;background:#fff;"
  + "border:1px solid #cfcfcf;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;flex-direction:column;}"
  + ".z47x-menu__list[hidden]{display:none;}"
  + ".z47x-menu__list button{all:unset;box-sizing:border-box;cursor:pointer;padding:10px 16px;font:inherit;"
  + "font-size:.9rem;letter-spacing:.04em;color:#111;white-space:nowrap;}"
  + ".z47x-menu__list button:hover,.z47x-menu__list button:focus-visible{background:#fdeddd;}"
  + ".z47x-menu__list button[aria-checked=true]{color:" + Z47_COLOR + ";font-weight:600;}");

  // Moves the tabs for `keys` out of `row` into one dropdown tab. pick(key) does the switching.
  function buildMenu(row, attr, keys, idleLabel, pick) {
    var tpl = row.querySelector("[" + attr + "]");
    var first = keys.map(function (k) { return row.querySelector("[" + attr + '="' + k + '"]'); })
                    .filter(Boolean)[0];   // the dropdown takes the place of the first tab it absorbs
    if (!tpl || !first || row.querySelector(".z47x-menu")) return null;
    var wrap = document.createElement("div");
    wrap.className = "z47x-menu";
    var trig = tpl.cloneNode(true);
    ["id", "data-w-id", attr, "data-tenure", "href"].forEach(function (a) { trig.removeAttribute(a); });
    trig.classList.remove("is-active", "w--current");
    trig.setAttribute("role", "button");
    trig.setAttribute("tabindex", "0");
    trig.setAttribute("aria-haspopup", "true");
    trig.setAttribute("aria-expanded", "false");
    var text = trig.querySelector(".chart-tenure-text") || trig;
    var list = document.createElement("div");
    list.className = "z47x-menu__list";
    list.hidden = true;
    list.setAttribute("role", "menu");
    list.innerHTML = keys.map(function (k) {
      return '<button type="button" role="menuitemradio" aria-checked="false" data-key="' + k + '">' + k + "</button>";
    }).join("");

    function setOpen(open) {
      list.hidden = !open;
      wrap.classList.toggle("is-open", open);
      trig.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function show(key) {   // key = selected menu range, or null when a plain tab is active
      text.innerHTML = "<span>" + esc(key || idleLabel) + "</span>" + CHEVRON_SVG;
      trig.classList.toggle("is-active", !!key);
      $all("button", list).forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-key") === key ? "true" : "false"); });
    }
    trig.addEventListener("click", function (e) { e.preventDefault(); setOpen(list.hidden); });
    trig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault(); setOpen(true);
        var b = list.querySelector("button"); if (b) b.focus();
      }
    });
    $all("button", list).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-key");
        pick(k); show(k); setOpen(false); trig.focus();
      });
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !list.hidden) { setOpen(false); trig.focus(); } });

    var active = null;
    keys.forEach(function (k) {
      var a = row.querySelector("[" + attr + '="' + k + '"]');
      if (!a) return;
      if (a.classList.contains("is-active")) active = k;
      a.classList.add("z47x-moved");
    });
    // A plain tab takes over: clear the dropdown's selection.
    $all("[" + attr + "]", row).forEach(function (a) {
      if (!a.classList.contains("z47x-moved")) a.addEventListener("click", function () { show(null); setOpen(false); });
    });
    wrap.appendChild(trig);
    wrap.appendChild(list);
    first.parentNode.insertBefore(wrap, first);
    // Size like the other tabs (auto on desktop, stretched on phones).
    var ref = row.querySelector("[" + attr + "]:not(.z47x-moved)");
    function syncFlex() { if (ref) wrap.style.flex = getComputedStyle(ref).flex; }
    syncFlex();
    window.addEventListener("resize", syncFlex);
    show(active);
    return wrap;
  }

  function setPill(key, n) {
    $all('[data-z47="' + key + '"]').forEach(function (el) {
      el.textContent = fmtPct1(n);
      el.classList.remove("ai-color-parrotgreen", "ai-color-red");
      el.style.color = colorFor(n);
      el.setAttribute("data-z47-value-state", fin(n) ? "ready" : "unavailable");
    });
  }
  function renderShortRange(d, range) {
    var chart = chartInstance();
    if (!chart) return;
    var slice = d.history.slice(-(SHORT_SESSIONS[range] + 1));
    var z0 = slice[0].z47, n0 = slice[0].nifty500;
    chart.data.labels = slice.map(function (p) { return p.date; });
    chart.data.datasets[0].data = slice.map(function (p) { return p.z47 / z0 * 100; });
    chart.data.datasets[1].data = slice.map(function (p) { return p.nifty500 / n0 * 100; });
    chart.data.datasets.forEach(function (ds) { ds.pointRadius = 3; ds.pointHoverRadius = 5; });
    var o = chart.options;
    o.scales.x.ticks.callback = function (v) { return dayLabel(this.getLabelForValue(v), false); };
    o.scales.x.ticks.maxTicksLimit = slice.length;
    o.plugins.tooltip.callbacks.title = function (items) { return dayLabel(items[0].label, true); };
    chart.update();
    var rr = rangeReturns(d, range);
    setPill("chart-z47-pct", rr.z47);
    setPill("chart-nifty-pct", rr.nifty);
  }
  function addChartMenu(d) {
    var row = document.querySelector(".chart-tenure-links:not(.top-movers)");
    if (!row) return;
    // Track every plain-tab switch (01-performance renders those).
    $all("[data-z47-range]", row).forEach(function (a) {
      a.addEventListener("click", function () { currentRange = a.getAttribute("data-z47-range"); });
    });
    var act = row.querySelector("[data-z47-range].is-active");
    if (act) currentRange = act.getAttribute("data-z47-range");
    buildMenu(row, "data-z47-range", CHART_MENU, "1D – 6M", function (k) {
      var tab = row.querySelector('[data-z47-range="' + k + '"]');
      if (tab) { tab.click(); }                    // 1M / 3M / 6M: 01-performance renders it
      else {
        $all("[data-z47-range]").forEach(function (x) { x.classList.remove("is-active"); });
        renderShortRange(d, k);
      }
      currentRange = k;
    });
  }
  function addMoversMenu() {
    var row = document.querySelector(".chart-tenure-links.top-movers");
    if (!row) return;
    buildMenu(row, "data-z47-period", MOVERS_MENU, "1M – 6M", function (k) {
      var tab = row.querySelector('[data-z47-period="' + k + '"]');
      if (tab) tab.click();
    });
  }

  /* ----------------------- 4. END-VALUE LABELS ---------------------------- */
  // Draws each line's last value at its end. Only on the performance chart and its export.
  var endLabels = {
    id: "z47xEndLabels",
    afterDatasetsDraw: function (chart) {
      var cv = chart.canvas;
      var isExport = cv && cv.getAttribute("data-z47x-export") === "1";
      if (!cv || (cv.id !== "z47-chart" && !isExport)) return;
      var area = chart.chartArea, g = chart.ctx;
      var fs = isExport ? 30 : 12, padX = isExport ? 12 : 5, padY = isExport ? 7 : 3, gap = isExport ? 12 : 6;
      var font = "600 " + fs + "px " + getComputedStyle(document.body).fontFamily;
      var h = fs + padY * 2;
      var items = [];
      chart.data.datasets.forEach(function (ds, i) {
        var meta = chart.getDatasetMeta(i);
        var v = ds.data[ds.data.length - 1];
        if (meta.hidden || !meta.data.length || !fin(v)) return;
        var pt = meta.data[meta.data.length - 1];
        items.push({ x: pt.x, y: pt.y, text: v.toFixed(1), color: ds.borderColor });
      });
      if (!items.length) return;
      g.save();
      g.font = font;
      // Higher line's label sits above its end point, lower line's below, so they never cover each other.
      items.sort(function (a, b) { return a.y - b.y; });
      items.forEach(function (it, idx) {
        var w = g.measureText(it.text).width + padX * 2;
        var top = idx === 0 ? it.y - gap - h : it.y + gap;
        top = Math.max(area.top, Math.min(area.bottom - h, top));
        var left = Math.min(it.x, area.right) - w;
        g.fillStyle = it.color;
        g.beginPath();
        if (g.roundRect) g.roundRect(left, top, w, h, 3); else g.rect(left, top, w, h);
        g.fill();
        g.fillStyle = "#fff";
        g.textBaseline = "middle";
        g.fillText(it.text, left + padX, top + h / 2 + 0.5);
      });
      g.restore();
    }
  };
  function registerEndLabels() {
    if (window.Chart && Chart.register && !window.__Z47X_END_LABELS) {
      Chart.register(endLabels);
      window.__Z47X_END_LABELS = true;
      var c = chartInstance();
      if (c) c.update("none");
    }
  }

  /* --------------------------- 3. DOWNLOAD -------------------------------- */
  addStyle("z47x-dl-css",
    ".z47x-dl{position:relative;display:flex;align-items:center;margin-left:auto;}"
  + ".z47x-dl .button_arrow{width:1rem;height:1rem;}"
  + ".z47x-dl__menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:200px;background:#fff;"
  + "border:1px solid #cfcfcf;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;flex-direction:column;}"
  + ".z47x-dl__menu[hidden]{display:none;}"
  + ".z47x-dl__menu button{all:unset;box-sizing:border-box;cursor:pointer;padding:12px 16px;font:inherit;font-size:.95rem;color:#111;}"
  + ".z47x-dl__menu button:hover,.z47x-dl__menu button:focus-visible{background:#fdeddd;}"
  + ".z47x-dl__menu button[disabled]{opacity:.5;cursor:progress;}");

  var logoImg = null;
  function loadLogo() {
    if (logoImg) return logoImg;
    logoImg = new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = Z47_LOGO_URL;
    });
    return logoImg;
  }
  // Fixed-size offscreen chart, so the export looks the same from any device.
  function exportChartCanvas(d, range) {
    var live = chartInstance();
    var dayTicks = !!SHORT_SESSIONS[range] || range === "1M";
    var c = document.createElement("canvas");
    c.width = 2800; c.height = 1160;
    c.setAttribute("data-z47x-export", "1");
    var font = getComputedStyle(document.body).fontFamily;
    var ch = new Chart(c, {
      type: "line",
      data: {
        labels: live.data.labels.slice(),
        datasets: live.data.datasets.map(function (ds) {
          return { label: ds.label, data: ds.data.slice(), borderColor: ds.borderColor, borderWidth: 3,
                   pointRadius: SHORT_SESSIONS[range] ? 6 : 0, pointBackgroundColor: ds.borderColor, tension: 0.15 };
        })
      },
      options: {
        responsive: false, animation: false, devicePixelRatio: 1,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: dayTicks ? 8 : 9,
               font: { family: font, size: 24 }, color: "#555",
               callback: function (v) { var l = this.getLabelForValue(v); return dayTicks ? dayLabel(l, false) : monthLabel(l); } } },
          y: { grid: { color: "rgba(0,0,0,0.07)" }, ticks: { precision: 0, maxTicksLimit: 7, font: { family: font, size: 24 }, color: "#555" } }
        }
      }
    });
    return { canvas: c, chart: ch };
  }
  function composeSnapshot(d, range) {
    return loadLogo().then(function (logo) {
      var W = 3000, H = 1800, P = 100;
      var font = getComputedStyle(document.body).fontFamily;
      var out = document.createElement("canvas");
      out.width = W; out.height = H;
      var g = out.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
      g.textBaseline = "alphabetic";

      // Header: logo + title + range, as-of on the right
      var y = P + 70;
      var x = P;
      if (logo && logo.naturalWidth) {
        var lh = 90, lw = lh * logo.naturalWidth / logo.naturalHeight;
        g.drawImage(logo, x, P, lw, lh);
        x += lw + 36;
      }
      g.fillStyle = "#111"; g.font = "600 64px " + font;
      g.fillText("vs NIFTY 500", x, y);
      var tw = g.measureText("vs NIFTY 500").width;
      g.fillStyle = "#555"; g.font = "400 44px " + font;
      g.fillText("·  " + (RANGE_LABELS[range] || range), x + tw + 28, y);
      g.textAlign = "right"; g.fillStyle = "#111"; g.font = "500 40px " + font;
      g.fillText(asOfText(d), W - P, y);
      g.textAlign = "left";

      // Key numbers
      var rr = rangeReturns(d, range);
      var rows = [
        { color: Z47_COLOR, name: "Z47 fortyseven", value: fmtNum(d.index.value, 2), ret: rr.z47 },
        { color: NIFTY_COLOR, name: "NIFTY 500", value: fmtNum(d.benchmark.value, 2), ret: rr.nifty }
      ];
      var ky = P + 210;
      rows.forEach(function (r, i) {
        var bx = P + i * 1150;
        g.fillStyle = r.color; g.fillRect(bx, ky - 34, 56, 10);
        g.fillStyle = "#111"; g.font = "600 44px " + font;
        g.fillText(r.name, bx + 76, ky - 16);
        g.font = "500 64px " + font;
        g.fillText(r.value, bx + 76, ky + 66);
        var vw = g.measureText(r.value + "  ").width;
        g.fillStyle = colorFor(r.ret); g.font = "600 52px " + font;
        g.fillText(fmtPct1(r.ret), bx + 76 + vw, ky + 66);
      });

      // Chart
      var ex = exportChartCanvas(d, range);
      var cy = ky + 140;
      g.drawImage(ex.canvas, P, cy, W - 2 * P, (W - 2 * P) * ex.canvas.height / ex.canvas.width);
      ex.chart.destroy();

      // Footer: source + download time
      g.fillStyle = "#e5e5e5"; g.fillRect(P, H - 170, W - 2 * P, 2);
      g.fillStyle = "#555"; g.font = "400 34px " + font;
      g.fillText("Source: Z47, " + PAGE_URL_LABEL + "  ·  Downloaded " + istNow(), P, H - 110);
      g.fillText("Rebased to 100 at the start of the period.", P, H - 60);
      g.textAlign = "right";
      g.fillText("For information only; not investment advice.", W - P, H - 60);
      g.textAlign = "left";
      return out;
    });
  }
  function fileStem(range) {
    var t = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(/[: ]/g, "-").slice(0, 16);
    return "Z47-fortyseven_" + range + "_" + t + "_IST";
  }
  function saveBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  var jsPdfLoad = null;
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPdfLoad) return jsPdfLoad;
    jsPdfLoad = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = JSPDF_URL; s.integrity = JSPDF_SRI; s.crossOrigin = "anonymous"; s.async = true;
      s.onload = function () { resolve(window.jspdf.jsPDF); };
      s.onerror = function () { jsPdfLoad = null; reject(new Error("jsPDF failed to load")); };
      document.head.appendChild(s);
    });
    return jsPdfLoad;
  }
  function download(d, kind, btn) {
    var range = currentRange;
    btn.disabled = true;
    return composeSnapshot(d, range).then(function (canvas) {
      if (kind === "png") {
        return new Promise(function (res) { canvas.toBlob(function (b) { saveBlob(b, fileStem(range) + ".png"); res(); }, "image/png"); });
      }
      return loadJsPdf().then(function (JsPDF) {
        var pdf = new JsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 2, canvas.height / 2], compress: true });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(fileStem(range) + ".pdf");
      });
    }).catch(function (e) {
      console.error("[z47 extras] download failed:", e);
    }).then(function () { btn.disabled = false; });
  }
  function addDownload(d) {
    var badge = document.querySelector('.index-tab-pane[data-w-tab="Tab 1"] .live-badge') || document.querySelector(".live-badge");
    if (!badge || document.querySelector('[data-z47="chart-download"]')) return;
    var wrap = document.createElement("div");
    wrap.className = "z47x-dl";
    var btn = document.createElement("a");
    btn.href = "#";
    btn.className = "button is-icon b2-orange-2";
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-z47", "chart-download");
    btn.title = "Download the chart for the selected period. " + asOfText(d) + ".";
    btn.innerHTML = "<div>Download</div>"
      + '<div class="button_arrow-wrap rotate"><div class="button_arrow">' + ARROW_SVG + "</div></div>";
    var menu = document.createElement("div");
    menu.className = "z47x-dl__menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML = '<button type="button" role="menuitem" data-kind="png">Chart image (PNG)</button>'
                   + '<button type="button" role="menuitem" data-kind="pdf">Chart (PDF)</button>';
    function toggle(open) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function (e) { e.preventDefault(); toggle(menu.hidden); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === " ") { e.preventDefault(); toggle(menu.hidden); }
    });
    $all("button", menu).forEach(function (m) {
      m.addEventListener("click", function () { download(d, m.getAttribute("data-kind"), m).then(function () { toggle(false); }); });
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    badge.parentNode.insertBefore(wrap, badge);
    badge.classList.add("z47x-hidden");
  }

  /* -------------------- 5. SNAPSHOT: FIRST 7 + LOAD MORE ------------------- */
  function addLoadMore(d) {
    var pane = document.querySelector('.index-tab-pane[data-w-tab="Tab 1"]');
    var grid = pane && pane.querySelector('[data-z47="constituents-body"]');
    var host = grid && grid.closest(".constituent-live-prices");
    var total = (d.constituents || []).length;
    if (!host || total <= SNAPSHOT_ROWS || host.querySelector(".z47x-more")) return;
    var head = host.querySelector(".live-prices-header");
    var cols = head ? head.children.length : 7;
    // 03-constituents-table.js paints the rows as flat grid cells (cols per row), possibly after this runs.
    // CSS hides everything after row 7, so it holds whenever the table repaints.
    addStyle("z47x-more-css",
      '[data-z47x-rows="collapsed"] > :nth-child(n+' + (SNAPSHOT_ROWS * cols + 1) + "){display:none!important;}"
    + ".z47x-more{display:flex;justify-content:center;margin-top:1.25rem;}"
    + ".z47x-more[hidden]{display:none;}"
    + ".z47x-more .advisory-card_loadmore.button.load-more{margin:0;gap:.75rem;}"
    + ".z47x-more .advisory-card_loadmore.button.load-more:hover{background-color:var(--ai-report-swatches--ai-grey);color:#fff;}"
    + ".z47x-more .button_arrow{width:1rem;height:1rem;}");
    grid.setAttribute("data-z47x-rows", "collapsed");
    var row = document.createElement("div");
    row.className = "z47x-more";
    row.innerHTML = '<a href="#" role="button" class="advisory-card_loadmore button load-more is-icon" data-z47="snapshot-more">'
      + "<div>Load more</div>"
      + '<div class="button_arrow-wrap rotate"><div class="button_arrow">' + ARROW_SVG + "</div></div></a>";
    // The staging company search filters by hiding rows; while it has a query, show every match.
    var expanded = false;
    function sync() {
      var input = host.querySelector(".z47-company-search input");
      var open = expanded || !!(input && input.value.trim());
      if (open) grid.removeAttribute("data-z47x-rows"); else grid.setAttribute("data-z47x-rows", "collapsed");
      row.hidden = open;
    }
    ["input", "search", "keyup"].forEach(function (ev) { host.addEventListener(ev, sync); });
    row.querySelector("a").addEventListener("click", function (e) {
      e.preventDefault();
      expanded = true;
      sync();
    });
    var after = host.querySelector(".constituent-live-prices-wrapper") || grid;
    after.parentNode.insertBefore(row, after.nextSibling);
  }

  /* -------------------- 6. CHANGE LOG + WHY TOOLTIP ----------------------- */
  addStyle("z47x-log-css",
    ".z47x-log{position:relative;display:flex;flex-direction:column;gap:1.25rem;margin-bottom:2.5rem;}"
  + ".z47x-log__intro{margin:0;color:#555;}"
  + ".z47x-log__track{display:flex;gap:0;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:8px;border-top:2px solid #cfcfcf;}"
  + ".z47x-log__month{flex:0 0 260px;scroll-snap-align:start;padding:0 20px 0 0;position:relative;}"
  + ".z47x-log__month::before{content:'';position:absolute;top:-8px;left:0;width:14px;height:14px;border-radius:50%;background:" + Z47_COLOR + ";}"
  + ".z47x-log__label{padding-top:18px;font-weight:600;font-size:1.05rem;}"
  + ".z47x-log__event{position:relative;margin-top:12px;padding:12px 14px;background:#fff7e8;display:flex;flex-direction:column;gap:6px;"
  + "border:1px solid transparent;transition:border-color .15s ease,box-shadow .15s ease;}"
  + ".z47x-log__row[data-why]{cursor:help;margin:0 -6px;padding:2px 6px;transition:background-color .15s ease;}"
  + ".z47x-log__row[data-why]:hover,.z47x-log__row[data-why]:focus-visible,.z47x-log__row.is-tip{background:rgba(238,90,36,.12);outline:none;}"
  + ".z47x-log__row .z47x-log__info{margin-left:auto;align-self:center;}"
  + ".z47x-log__meta{display:flex;justify-content:space-between;gap:8px;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#777;}"
  + ".z47x-log__info{flex:0 0 auto;width:16px;height:16px;border-radius:50%;border:1.5px solid currentColor;font:600 11px/13px sans-serif;"
  + "text-align:center;text-transform:none;letter-spacing:0;color:" + Z47_COLOR + ";}"
  + ".z47x-log__row{display:flex;gap:8px;align-items:baseline;font-size:.95rem;}"
  + ".z47x-log__sign{font-weight:700;width:12px;flex:0 0 12px;}"
  + ".z47x-log__row.is-in .z47x-log__sign{color:" + POS_COLOR + ";}"
  + ".z47x-log__row.is-out .z47x-log__sign{color:" + NEG_COLOR + ";}"
  + ".z47x-log__row.is-out .z47x-log__name{color:#666;}"
  + ".z47x-log__sector{color:#777;font-size:.85rem;}"
  + ".z47x-log a{color:inherit;text-decoration:none;}.z47x-log a:hover{text-decoration:underline;}"
  + ".z47x-tip{position:absolute;z-index:40;width:320px;max-width:calc(100% - 8px);padding:14px 16px;background:#2b2118;color:#fff;"
  + "font-size:.9rem;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;"
  + "opacity:0;transform:translateY(6px);transition:opacity .18s ease,transform .18s ease;}"
  + ".z47x-tip.is-on{opacity:1;transform:none;}"
  + ".z47x-tip__head{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#ffb27f;margin-bottom:6px;}"
  + ".z47x-tip__note{margin-top:8px;font-size:.8rem;color:#cfc4ba;}"
  + "@media(prefers-reduced-motion:reduce){.z47x-tip{transition:none;transform:none;}}"
  + "@media(max-width:479px){.z47x-log__month{flex-basis:230px;}}");

  function asList(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
  function addChangeLog(d) {
    var pane = document.querySelector('.index-tab-pane[data-w-tab="Tab 3"]');
    var disclaimer = pane && pane.querySelector(".disclaimer-wrapper");
    if (!disclaimer || pane.querySelector(".z47x-log")) return;
    var byTicker = {};
    (d.constituents || []).forEach(function (c) { if (c.ticker) byTicker[c.ticker] = c; });
    var events = (d.events || []).filter(function (e) { return e.effective_date >= CHANGE_LOG_FROM; })
      .sort(function (a, b) { return a.effective_date < b.effective_date ? -1 : 1; });
    if (!events.length) return;

    function nameHtml(t, linkable) {
      var c = byTicker[t];
      var name = esc(c ? c.name : (FORMER_NAMES[t] || t));
      if (linkable && c) {
        var url = c.detail_url || ("/z47-forty-seven/" + (c.slug || t.toLowerCase()));
        return '<a class="z47x-log__name" href="' + esc(url) + '">' + name + "</a>"
             + (c.sector ? ' <span class="z47x-log__sector">' + esc(c.sector.split(" / ")[0]) + "</span>" : "");
      }
      return '<span class="z47x-log__name">' + name + "</span>";
    }
    var months = [];
    events.forEach(function (e) {
      var m = e.effective_date.slice(0, 7);
      if (!months.length || months[months.length - 1].key !== m) months.push({ key: m, events: [] });
      months[months.length - 1].events.push(e);
    });
    var html = months.map(function (m) {
      return '<div class="z47x-log__month" role="listitem">'
        + '<div class="z47x-log__label">' + monthLabel(m.key + "-01") + "</div>"
        + m.events.map(function (e) {
            var kind = e.event_type === "batch_swap" ? "Rebalance" : "Replacement";
            var head = dayLabel(e.effective_date, true) + " · " + kind;
            var reasons = CHANGE_REASONS[e.effective_date] || {};
            function row(t, added) {
              var why = reasons[t];
              return '<div class="z47x-log__row ' + (added ? "is-in" : "is-out") + '"'
                + (why ? ' tabindex="0" data-why="' + esc(why) + '" data-head="' + esc(head) + '" aria-describedby="z47x-tip"' : "") + ">"
                + '<span class="z47x-log__sign" aria-label="' + (added ? "Added" : "Removed") + '">' + (added ? "+" : "−") + "</span>"
                + "<span>" + nameHtml(t, added) + "</span>"
                + (why ? '<span class="z47x-log__info" aria-hidden="true">i</span>' : "") + "</div>";
            }
            var rows = asList(e.added).map(function (t) { return row(t, true); })
              .concat(asList(e.removed).map(function (t) { return row(t, false); })).join("");
            return '<div class="z47x-log__event">'
              + '<div class="z47x-log__meta"><span>' + esc(dayLabel(e.effective_date, false)) + " · " + kind + "</span></div>"
              + rows
              + "</div>";
          }).join("")
        + "</div>";
    }).join("");

    var wrap = document.createElement("div");
    wrap.className = "z47x-log";
    wrap.setAttribute("data-z47", "change-log");
    wrap.innerHTML =
        // Same "without-gap" header variant as the page's other headings (no left padding).
        '<div data-wf--index-page-header--variant="without-gap" class="index-header-wrap">'
      + '<h4 class="index-heading ai-heading-h4 ai-color-brown-3 u-text-capitalize w-variant-62a05fcb-f9c0-f157-e193-6bdcbe0e623c">Index changes</h4></div>'
      + '<p class="z47x-log__intro">Companies added to and removed from the index, by month. Hover over or tap a company to see why it was added or removed.</p>'
      + '<div class="z47x-log__track" role="list">' + html + "</div>"
      + '<div class="z47x-tip" id="z47x-tip" role="tooltip" aria-hidden="true"></div>';
    disclaimer.parentNode.insertBefore(wrap, disclaimer);
    var track = wrap.querySelector(".z47x-log__track");
    track.scrollLeft = track.scrollWidth;   // latest month in view on narrow screens
    wireTips(wrap, track);
  }
  // One shared tooltip, positioned under the hovered/focused/tapped company row.
  function wireTips(wrap, track) {
    var tip = wrap.querySelector(".z47x-tip");
    var current = null;
    function show(card) {
      if (current && current !== card) current.classList.remove("is-tip");
      current = card;
      card.classList.add("is-tip");
      tip.innerHTML = '<div class="z47x-tip__head">' + esc(card.getAttribute("data-head")) + "</div>"
        + "<div>" + esc(card.getAttribute("data-why")) + "</div>"
        + '<div class="z47x-tip__note">' + esc(CHANGE_NOTE) + "</div>";
      var w = wrap.getBoundingClientRect(), c = card.getBoundingClientRect();
      var left = Math.max(0, Math.min(c.left - w.left, w.width - tip.offsetWidth));
      tip.style.left = left + "px";
      tip.style.top = (c.bottom - w.top + 8) + "px";
      tip.classList.add("is-on");
      tip.setAttribute("aria-hidden", "false");
    }
    function hide() {
      if (current) current.classList.remove("is-tip");
      current = null;
      tip.classList.remove("is-on");
      tip.setAttribute("aria-hidden", "true");
    }
    $all(".z47x-log__row[data-why]", wrap).forEach(function (card) {
      card.addEventListener("mouseenter", function () { show(card); });
      card.addEventListener("mouseleave", hide);
      card.addEventListener("focus", function () { show(card); });
      card.addEventListener("blur", hide);
      // Tap on touch screens toggles. A tap also fires mouseenter/focus before click,
      // so whether it was open is read at pointerdown. Links inside the row still work.
      var openAtDown = false;
      card.addEventListener("pointerdown", function () { openAtDown = current === card; });
      card.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        if (openAtDown && e.pointerType && e.pointerType !== "mouse") hide(); else show(card);
      });
    });
    track.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".z47x-log__row[data-why]")) hide(); });
  }

  /* ------------------------- 7. DISCLAIMER -------------------------------- */
  // Desktop: keep "Disclaimer" on the left, cap the text column (~70 characters a line) and pin it right.
  addStyle("z47x-disc-css",
    "@media(min-width:992px){"
  + ".index-tab-pane .disclaimer-wrapper .disclaimer-header{flex:1 1 auto;}"
  + ".index-tab-pane .disclaimer-wrapper .disclaimer-pointer-wrap{flex:0 1 44rem;width:auto;max-width:44rem;margin-left:auto;}"
  + "}");

  /* ------------------------------- INIT ----------------------------------- */
  var started = false;
  function start(d) {
    if (started || !d || !d.index || !Array.isArray(d.history) || d.history.length < 7) return;
    started = true;
    guard("end labels", registerEndLabels);
    guard("chart range menu", function () { addChartMenu(d); });
    guard("top movers menu", addMoversMenu);
    guard("download", function () { addDownload(d); });
    guard("load more", function () { addLoadMore(d); });
    guard("change log", function () { addChangeLog(d); });
  }

  window.addEventListener("z47:performance-state", function (e) {
    if (e.detail === "ready") start(window.__Z47);
  });
  function boot() { if (window.__Z47 && chartInstance()) start(window.__Z47); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
