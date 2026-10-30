/* Z47 — Index page, Phase 1 extras
   File: staging/js/11-index-extras.js   (load after 01-performance.js)

   Adds, without touching 01-performance.js or the Designer layout:
     1. Hero top bar — latest value, change vs previous close, prev. close, as-of
     2. Download — PNG / PDF snapshot of the chart for the selected range
     3. Constituent change log above the Constituents-tab disclaimer

   Reads the feed 01-performance.js already loaded (window.__Z47) and waits for its
   "z47:performance-state" event. If the feed never arrives, nothing new is shown. */
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

  // Short periods, counted in NSE sessions back from the latest close.
  var RANGE_LABELS = {
    "1M": "Last 1 month", "3M": "Last 3 months",
    "6M": "Last 6 months", "1Y": "Last 1 year", "YTD": "Year to date", "SINCE": "Since Jan 2024"
  };

  // Change log: first effective date shown publicly, and the public wording per change.
  // Reasons stay hidden until Z47 supplies copy (keyed by effective_date).
  var CHANGE_LOG_FROM = "2026-06-16";
  var CHANGE_REASONS = {};
  // Names for companies no longer in the index (constituents[] only lists current members).
  var FORMER_NAMES = {
    "SBICARD": "SBI Card", "MOBIKWIK": "MobiKwik", "UNIECOM": "Unicommerce",
    "TURTLEMINT": "Turtlemint", "MEDIASSIST": "Medi Assist", "AWFIS": "Awfis",
    "HOMEFIRST": "Home First Finance", "INDIASHLTR": "India Shelter Finance",
    "YATRA": "Yatra Online", "NIVABUPA": "Niva Bupa", "SMARTWORKS": "Smartworks",
    "360ONE": "360 ONE WAM"
  };

  /* ------------------------------ HELPERS --------------------------------- */
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function fin(n) { return typeof n === "number" && isFinite(n); }
  function fmtNum(n, dp) {
    return fin(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "—";
  }
  // Same sign style as 01-performance.js ("+3.0%" / "-1.5%").
  function fmtPct(n) { return fin(n) ? (n >= 0 ? "+" : "") + n.toFixed(2) + "%" : "—"; }
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
  function addStyle(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement("style");
    st.id = id; st.textContent = css;
    (document.head || document.body).appendChild(st);
  }
  function guard(name, fn) {
    try { fn(); } catch (e) { console.error("[z47 extras] " + name + " failed:", e); }
  }

  // Return over the last n sessions, from the daily closes in history[].
  // Return for the selected chart range, straight from the feed.
  function rangeReturns(d, range) {
    var k = range === "SINCE" ? "since_base" : range;
    return { z47: d.index.returns[k], nifty: d.benchmark.returns[k] };
  }
  function activeRange() {
    var a = document.querySelector("[data-z47-range].is-active");
    return a ? a.getAttribute("data-z47-range") : "SINCE";
  }

  /* --------------------------- 1. HERO TOP BAR ---------------------------- */
  addStyle("z47x-bar-css",
    ".z47x-bar{display:flex;flex-direction:column;gap:6px;font-family:inherit;color:#111;}"
  + ".z47x-bar[hidden]{display:none;}"
  + ".z47x-bar__main{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;}"
  + ".z47x-bar__value{font-size:clamp(2rem,1.6rem + 1.6vw,3rem);font-weight:500;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;}"
  + ".z47x-bar__chg{font-size:clamp(1.05rem,1rem + .3vw,1.3rem);font-weight:600;font-variant-numeric:tabular-nums;}"
  + ".z47x-bar__meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:.95rem;color:#555;}"
  + ".z47x-bar__meta b{color:#111;font-weight:600;font-variant-numeric:tabular-nums;}"
  + ".z47x-bar.is-loading .z47x-bar__value,.z47x-bar.is-loading .z47x-bar__chg,.z47x-bar.is-loading .z47x-bar__meta b{color:transparent;background:#efe6dc;border-radius:4px;}"
  + "@media(max-width:479px){.z47x-bar__meta{font-size:.85rem;}}");

  var bar = null;
  function mountBar() {
    if (bar) return bar;
    var anchor = document.querySelector(".index-hero-text .index-context.max-width-full")
              || document.querySelector(".index-hero-text");
    if (!anchor) return null;
    bar = document.createElement("div");
    bar.className = "z47x-bar is-loading";
    bar.setAttribute("data-z47", "live-bar");
    bar.setAttribute("aria-live", "polite");
    bar.innerHTML =
        '<div class="z47x-bar__main">'
      +   '<span class="z47x-bar__value" data-z47="live-value">000.00</span>'
      +   '<span class="z47x-bar__chg" data-z47="live-change">▲ 0.00 (+0.00%)</span>'
      + '</div>'
      + '<div class="z47x-bar__meta">'
      +   '<span>Prev. close <b data-z47="live-prev-close">000.00</b></span>'
      +   '<span aria-hidden="true">·</span>'
      +   '<span data-z47="live-asof">Loading latest value</span>'
      + '</div>';
    anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    return bar;
  }
  function paintBar(d) {
    if (!mountBar()) return;
    var h = d.history, last = h[h.length - 1];
    // history[] ends with the latest snapshot when it carries today's date
    var prevRow = last.date === d.meta.data_as_of ? h[h.length - 2] : last;
    var value = d.index.value, prev = prevRow && prevRow.z47;
    if (!fin(value) || !fin(prev)) { bar.hidden = true; return; }
    var chg = value - prev;
    var pct = fin(d.index.daily_pct) ? d.index.daily_pct : (chg / prev) * 100;
    var up = chg >= 0;
    bar.querySelector('[data-z47="live-value"]').textContent = fmtNum(value, 2);
    var c = bar.querySelector('[data-z47="live-change"]');
    c.textContent = (up ? "▲ " : "▼ ") + fmtNum(Math.abs(chg), 2) + " (" + fmtPct(pct) + ")";
    c.style.color = up ? POS_COLOR : NEG_COLOR;
    bar.querySelector('[data-z47="live-prev-close"]').textContent = fmtNum(prev, 2);
    var asof = d.meta.market_open
      ? "Intraday, as of " + (d.meta.generated_at_ist || "")
      : "As of close, " + dayLabel(d.meta.data_as_of, true);
    bar.querySelector('[data-z47="live-asof"]').textContent = asof;
    bar.title = "Updated " + (d.meta.generated_at_ist || "") + ". Scheduled updates; not streaming quotes.";
    bar.classList.remove("is-loading");
  }

  /* --------------------------- 2. DOWNLOAD -------------------------------- */
  function chartInstance() {
    var canvas = document.getElementById("z47-chart");
    return canvas && window.Chart && Chart.getChart ? Chart.getChart(canvas) : null;
  }
  addStyle("z47x-dl-css",
    ".z47x-dl{position:relative;display:flex;}"
  + ".z47x-dl > .chart-tabs{height:100%;cursor:pointer;background:#fff;box-shadow:inset 0 0 0 1px #cfcfcf;}"
  + ".z47x-dl > .chart-tabs:hover{background:#fdeddd;}"
  + ".z47x-dl__menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;min-width:180px;background:#fff;"
  + "border:1px solid #cfcfcf;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;flex-direction:column;}"
  + ".z47x-dl__menu[hidden]{display:none;}"
  + ".z47x-dl__menu button{all:unset;cursor:pointer;padding:12px 16px;font:inherit;font-size:.95rem;color:#111;}"
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
    var c = document.createElement("canvas");
    c.width = 2800; c.height = 1160;
    var font = getComputedStyle(document.body).fontFamily;
    var ch = new Chart(c, {
      type: "line",
      data: {
        labels: live.data.labels.slice(),
        datasets: live.data.datasets.map(function (ds) {
          return { label: ds.label, data: ds.data.slice(), borderColor: ds.borderColor, borderWidth: 3,
                   pointRadius: 0, pointBackgroundColor: ds.borderColor, tension: 0.15 };
        })
      },
      options: {
        responsive: false, animation: false, devicePixelRatio: 1,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9,
               font: { family: font, size: 24 }, color: "#555",
               callback: function (v) { return monthLabel(this.getLabelForValue(v)); } } },
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

      // Header: logo + title + range
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
      g.textAlign = "right"; g.fillStyle = "#555"; g.font = "400 36px " + font;
      g.fillText("Data as of " + (d.meta.generated_at_ist || d.meta.data_as_of), W - P, y);
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

      // Footer
      g.fillStyle = "#e5e5e5"; g.fillRect(P, H - 170, W - 2 * P, 2);
      g.fillStyle = "#555"; g.font = "400 34px " + font;
      g.fillText("Source: " + PAGE_URL_LABEL + "  ·  Downloaded " + istNow(), P, H - 110);
      g.fillText("Rebased to 100 at the start of the period. For information only; not investment advice.", P, H - 60);
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
    var range = activeRange();
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
    var links = document.querySelector(".chart-tenure-links");
    var b1M = document.querySelector('[data-z47-range="1M"]');
    if (!links || !b1M || links.querySelector(".z47x-dl")) return;
    var wrap = document.createElement("div");
    wrap.className = "z47x-dl";
    var btn = b1M.cloneNode(true);
    ["id", "data-w-id", "data-z47-range", "data-tenure", "href"].forEach(function (a) { btn.removeAttribute(a); });
    btn.classList.remove("is-active", "w--current");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("data-z47", "chart-download");
    var label = btn.querySelector(".chart-tenure-text span") || btn.querySelector(".chart-tenure-text");
    if (label) label.textContent = "Download ↓";
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
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(menu.hidden); }
    });
    $all("button", menu).forEach(function (m) {
      m.addEventListener("click", function () { download(d, m.getAttribute("data-kind"), m).then(function () { toggle(false); }); });
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    links.appendChild(wrap);
  }

  /* ------------------------- 3. CHANGE LOG -------------------------------- */
  addStyle("z47x-log-css",
    ".z47x-log{display:flex;flex-direction:column;gap:1.25rem;margin-bottom:2.5rem;}"
  + ".z47x-log__intro{margin:0;color:#555;}"
  + ".z47x-log__track{display:flex;gap:0;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:8px;border-top:2px solid #cfcfcf;}"
  + ".z47x-log__month{flex:0 0 260px;scroll-snap-align:start;padding:0 20px 0 0;position:relative;}"
  + ".z47x-log__month::before{content:'';position:absolute;top:-8px;left:0;width:14px;height:14px;border-radius:50%;background:" + Z47_COLOR + ";}"
  + ".z47x-log__label{padding-top:18px;font-weight:600;font-size:1.05rem;}"
  + ".z47x-log__event{margin-top:12px;padding:12px 14px;background:#fff7e8;display:flex;flex-direction:column;gap:6px;}"
  + ".z47x-log__meta{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:#777;}"
  + ".z47x-log__row{display:flex;gap:8px;align-items:baseline;font-size:.95rem;}"
  + ".z47x-log__sign{font-weight:700;width:12px;flex:0 0 12px;}"
  + ".z47x-log__row.is-in .z47x-log__sign{color:" + POS_COLOR + ";}"
  + ".z47x-log__row.is-out .z47x-log__sign{color:" + NEG_COLOR + ";}"
  + ".z47x-log__row.is-out .z47x-log__name{color:#666;}"
  + ".z47x-log__sector{color:#777;font-size:.85rem;}"
  + ".z47x-log__why{font-size:.85rem;color:#555;}"
  + ".z47x-log a{color:inherit;text-decoration:none;}.z47x-log a:hover{text-decoration:underline;}"
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
            var rows = asList(e.added).map(function (t) {
              return '<div class="z47x-log__row is-in"><span class="z47x-log__sign" aria-label="Added">+</span><span>' + nameHtml(t, true) + "</span></div>";
            }).concat(asList(e.removed).map(function (t) {
              return '<div class="z47x-log__row is-out"><span class="z47x-log__sign" aria-label="Removed">−</span><span>' + nameHtml(t, false) + "</span></div>";
            })).join("");
            var kind = e.event_type === "batch_swap" ? "Rebalance" : "Replacement";
            var why = CHANGE_REASONS[e.effective_date];
            return '<div class="z47x-log__event">'
              + '<div class="z47x-log__meta">' + esc(dayLabel(e.effective_date, false)) + " · " + kind + "</div>"
              + rows
              + (why ? '<div class="z47x-log__why">' + esc(why) + "</div>" : "")
              + "</div>";
          }).join("")
        + "</div>";
    }).join("");

    var wrap = document.createElement("div");
    wrap.className = "z47x-log";
    wrap.setAttribute("data-z47", "change-log");
    wrap.innerHTML =
        '<div class="index-header-wrap"><h4 class="index-heading ai-heading-h4 ai-color-brown-3 u-text-capitalize">Index changes</h4></div>'
      + '<p class="z47x-log__intro">Companies added to and removed from the index, by month.</p>'
      + '<div class="z47x-log__track" role="list">' + html + "</div>";
    disclaimer.parentNode.insertBefore(wrap, disclaimer);
    var track = wrap.querySelector(".z47x-log__track");
    track.scrollLeft = track.scrollWidth;   // latest month in view on narrow screens
  }

  /* ------------------------------- INIT ----------------------------------- */
  var started = false;
  function start(d) {
    if (started || !d || !d.index || !Array.isArray(d.history) || d.history.length < 7) return;
    started = true;
    guard("top bar", function () { paintBar(d); });
    guard("download", function () { addDownload(d); });
    guard("change log", function () { addChangeLog(d); });
  }
  function fail() { if (!started && bar) bar.hidden = true; }

  window.addEventListener("z47:performance-state", function (e) {
    if (e.detail === "ready") start(window.__Z47);
    else if (e.detail === "error") fail();
  });
  function boot() {
    guard("top bar mount", mountBar);
    if (window.__Z47) start(window.__Z47);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
