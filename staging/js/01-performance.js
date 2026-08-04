
(function () {
  "use strict";
  /* ----------------------------- CONFIG ----------------------------------- */
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json"; // live feed (raw GitHub, CORS, ~5min cache); inline below = fallback // set null => always inline
  var DEFAULT_RANGE   = "SINCE"; // chart on load: 1M | 3M | 6M | 1Y | YTD | SINCE
  var HERO_PILL_RANGE = "1M";    // which return the hero +x% pill shows
  var REBASE_ON_RANGE = true;    // re-base both lines to 100 at the start of the visible range
  var Z47_COLOR   = "#EE5A24";   // brand orange
  var NIFTY_COLOR = "#3B6FE0";   // benchmark blue
  var UP_CLASS    = "ai-color-parrotgreen"; // class added to positive % values (your green)
  var DOWN_CLASS  = "ai-color-red";         // class added to negative % values  ← set to your red class
  var POS_COLOR   = "#249200";   // inline colour for positive % (Return Summary + Top Movers)
  var NEG_COLOR   = "#D31F03";   // inline colour for negative % (Return Summary + Top Movers)
  /* --------------------- INLINE SNAPSHOT (fallback) ----------------------- */
  /* Trimmed to what Tab 1 needs (meta/index/benchmark/history/movers), ~215 pts.
     Regenerate from z47_index.json near launch if you keep using the snapshot. */
  var Z47_FALLBACK = {"meta":{"generated_at":"2026-07-01T01:14:52+05:30","generated_at_ist":"01 Jul 2026, 01:14 IST","market_open":false,"usdinr":{"value":94.65,"daily_pct":0.13,"as_of":"01:15 IST"},"base_date":"2024-01-02","anchor_date":"2026-06-16","benchmark":"NIFTY 500","constituents_priced":47,"source":"Yahoo Finance (delayed) \u2014 public landing feed","data_source_of_truth":"github.com/GirishZ47/z47-dashboard (16 Jun 2026 rebalance)","methodology_flags":["MMYT & FRSH summed in USD without FX conversion \u2014 existing model quirk."]},"index":{"value":124.26,"value_mcap":126.41,"daily_pct":1.22,"returns":{"1M":5.04,"3M":15.98,"6M":-6.41,"1Y":-5.39,"YTD":-6.41,"since_base":24.26}},"benchmark":{"name":"NIFTY 500","value":22995.65,"indexed":118.42,"returns":{"1M":2.49,"3M":9.84,"6M":-3.67,"1Y":-2.63,"YTD":-3.67,"since_base":18.42}},"history":[{"date":"2024-01-02","z47":100.0,"nifty500":100.0},{"date":"2024-01-09","z47":102.5,"nifty500":100.21},{"date":"2024-01-16","z47":103.63,"nifty500":102.11},{"date":"2024-01-23","z47":100.15,"nifty500":98.91},{"date":"2024-01-30","z47":103.14,"nifty500":100.8},{"date":"2024-02-06","z47":101.64,"nifty500":103.17},{"date":"2024-02-13","z47":101.34,"nifty500":101.88},{"date":"2024-02-20","z47":103.4,"nifty500":104.4},{"date":"2024-02-27","z47":104.89,"nifty500":104.5},{"date":"2024-03-05","z47":101.87,"nifty500":104.96},{"date":"2024-03-12","z47":100.88,"nifty500":103.88},{"date":"2024-03-19","z47":100.27,"nifty500":100.99},{"date":"2024-03-26","z47":104.4,"nifty500":103.02},{"date":"2024-04-03","z47":107.51,"nifty500":106.11},{"date":"2024-04-10","z47":110.84,"nifty500":107.71},{"date":"2024-04-17","z47":106.61,"nifty500":105.17},{"date":"2024-04-24","z47":108.59,"nifty500":106.76},{"date":"2024-05-01","z47":109.7,"nifty500":108.13},{"date":"2024-05-08","z47":106.24,"nifty500":106.63},{"date":"2024-05-15","z47":108.64,"nifty500":106.82},{"date":"2024-05-22","z47":108.11,"nifty500":109.37},{"date":"2024-05-29","z47":104.48,"nifty500":109.46},{"date":"2024-06-05","z47":104.73,"nifty500":108.42},{"date":"2024-06-12","z47":108.21,"nifty500":113.09},{"date":"2024-06-19","z47":110.96,"nifty500":114.45},{"date":"2024-06-26","z47":112.45,"nifty500":115.54},{"date":"2024-07-03","z47":115.46,"nifty500":117.68},{"date":"2024-07-10","z47":116.56,"nifty500":118.33},{"date":"2024-07-17","z47":116.4,"nifty500":119.5},{"date":"2024-07-24","z47":118.52,"nifty500":118.04},{"date":"2024-07-31","z47":120.95,"nifty500":121.18},{"date":"2024-08-07","z47":120.08,"nifty500":117.67},{"date":"2024-08-14","z47":121.46,"nifty500":116.76},{"date":"2024-08-21","z47":128.09,"nifty500":120.34},{"date":"2024-08-28","z47":128.22,"nifty500":121.62},{"date":"2024-09-04","z47":128.26,"nifty500":122.3},{"date":"2024-09-11","z47":131.51,"nifty500":121.18},{"date":"2024-09-18","z47":132.89,"nifty500":123.07},{"date":"2024-09-25","z47":133.32,"nifty500":125.51},{"date":"2024-10-02","z47":130.95,"nifty500":124.99},{"date":"2024-10-09","z47":132.2,"nifty500":121.53},{"date":"2024-10-16","z47":134.69,"nifty500":121.91},{"date":"2024-10-23","z47":128.26,"nifty500":117.63},{"date":"2024-10-30","z47":128.15,"nifty500":117.16},{"date":"2024-11-06","z47":131.45,"nifty500":118.61},{"date":"2024-11-13","z47":127.11,"nifty500":112.86},{"date":"2024-11-20","z47":129.17,"nifty500":113.32},{"date":"2024-11-27","z47":136.12,"nifty500":116.86},{"date":"2024-12-04","z47":139.79,"nifty500":118.96},{"date":"2024-12-11","z47":144.54,"nifty500":120.29},{"date":"2024-12-18","z47":143.98,"nifty500":118.11},{"date":"2024-12-26","z47":140.75,"nifty500":115.51},{"date":"2025-01-02","z47":143.94,"nifty500":117.52},{"date":"2025-01-09","z47":133.51,"nifty500":113.53},{"date":"2025-01-16","z47":130.03,"nifty500":111.82},{"date":"2025-01-23","z47":127.05,"nifty500":110.92},{"date":"2025-01-30","z47":124.48,"nifty500":109.68},{"date":"2025-02-05","z47":130.17,"nifty500":112.18},{"date":"2025-02-12","z47":119.62,"nifty500":107.67},{"date":"2025-02-19","z47":120.16,"nifty500":106.76},{"date":"2025-02-26","z47":116.23,"nifty500":105.15},{"date":"2025-03-05","z47":113.32,"nifty500":104.32},{"date":"2025-03-12","z47":109.28,"nifty500":104.36},{"date":"2025-03-19","z47":115.39,"nifty500":107.45},{"date":"2025-03-26","z47":115.8,"nifty500":109.56},{"date":"2025-04-02","z47":116.19,"nifty500":109.51},{"date":"2025-04-09","z47":111.05,"nifty500":104.83},{"date":"2025-04-16","z47":116.69,"nifty500":110.23},{"date":"2025-04-24","z47":122.13,"nifty500":114.22},{"date":"2025-05-01","z47":119.48,"nifty500":113.45},{"date":"2025-05-08","z47":117.08,"nifty500":112.49},{"date":"2025-05-15","z47":124.28,"nifty500":117.36},{"date":"2025-05-22","z47":123.21,"nifty500":116.36},{"date":"2025-05-29","z47":125.14,"nifty500":117.73},{"date":"2025-06-05","z47":129.91,"nifty500":118.11},{"date":"2025-06-12","z47":129.34,"nifty500":118.68},{"date":"2025-06-19","z47":126.8,"nifty500":117.23},{"date":"2025-06-26","z47":131.5,"nifty500":121.11},{"date":"2025-07-03","z47":129.43,"nifty500":121.13},{"date":"2025-07-10","z47":129.81,"nifty500":120.87},{"date":"2025-07-17","z47":130.42,"nifty500":120.61},{"date":"2025-07-24","z47":136.17,"nifty500":119.99},{"date":"2025-07-31","z47":131.58,"nifty500":118.01},{"date":"2025-08-07","z47":131.25,"nifty500":116.87},{"date":"2025-08-14","z47":134.04,"nifty500":116.8},{"date":"2025-08-21","z47":139.49,"nifty500":119.15},{"date":"2025-08-28","z47":136.65,"nifty500":116.08},{"date":"2025-09-04","z47":138.2,"nifty500":117.52},{"date":"2025-09-11","z47":139.05,"nifty500":118.97},{"date":"2025-09-18","z47":140.64,"nifty500":121.12},{"date":"2025-09-25","z47":136.38,"nifty500":118.56},{"date":"2025-10-02","z47":134.38,"nifty500":118.08},{"date":"2025-10-09","z47":139.18,"nifty500":119.69},{"date":"2025-10-16","z47":139.12,"nifty500":121.35},{"date":"2025-10-23","z47":138.05,"nifty500":122.34},{"date":"2025-10-30","z47":139.3,"nifty500":122.78},{"date":"2025-11-06","z47":134.36,"nifty500":121.09},{"date":"2025-11-13","z47":134.29,"nifty500":122.65},{"date":"2025-11-20","z47":135.72,"nifty500":123.47},{"date":"2025-11-27","z47":134.42,"nifty500":123.33},{"date":"2025-12-04","z47":133.83,"nifty500":122.26},{"date":"2025-12-11","z47":133.31,"nifty500":121.28},{"date":"2025-12-18","z47":131.49,"nifty500":120.98},{"date":"2025-12-26","z47":134.05,"nifty500":122.46},{"date":"2026-01-02","z47":133.33,"nifty500":124.1},{"date":"2026-01-09","z47":129.0,"nifty500":120.85},{"date":"2026-01-16","z47":128.37,"nifty500":120.94},{"date":"2026-01-23","z47":121.67,"nifty500":116.93},{"date":"2026-01-30","z47":122.36,"nifty500":118.85},{"date":"2026-02-06","z47":121.23,"nifty500":120.68},{"date":"2026-02-13","z47":120.23,"nifty500":120.06},{"date":"2026-02-20","z47":117.95,"nifty500":120.48},{"date":"2026-02-27","z47":114.43,"nifty500":119.3},{"date":"2026-03-06","z47":110.45,"nifty500":115.77},{"date":"2026-03-13","z47":105.8,"nifty500":110.16},{"date":"2026-03-20","z47":108.88,"nifty500":109.83},{"date":"2026-03-27","z47":107.56,"nifty500":108.25},{"date":"2026-03-30","z47":104.4,"nifty500":105.71},{"date":"2026-03-31","z47":104.44,"nifty500":105.71},{"date":"2026-04-01","z47":107.14,"nifty500":107.81},{"date":"2026-04-02","z47":107.41,"nifty500":107.83},{"date":"2026-04-06","z47":108.81,"nifty500":109.14},{"date":"2026-04-07","z47":108.58,"nifty500":109.67},{"date":"2026-04-08","z47":113.28,"nifty500":114.0},{"date":"2026-04-09","z47":113.76,"nifty500":113.49},{"date":"2026-04-10","z47":115.38,"nifty500":115.08},{"date":"2026-04-13","z47":114.38,"nifty500":114.22},{"date":"2026-04-14","z47":114.42,"nifty500":114.22},{"date":"2026-04-15","z47":117.33,"nifty500":116.36},{"date":"2026-04-16","z47":118.75,"nifty500":116.67},{"date":"2026-04-17","z47":120.29,"nifty500":117.77},{"date":"2026-04-20","z47":120.12,"nifty500":117.75},{"date":"2026-04-21","z47":122.1,"nifty500":118.66},{"date":"2026-04-22","z47":122.68,"nifty500":118.4},{"date":"2026-04-23","z47":121.64,"nifty500":117.47},{"date":"2026-04-24","z47":121.01,"nifty500":116.23},{"date":"2026-04-27","z47":121.5,"nifty500":117.52},{"date":"2026-04-28","z47":121.07,"nifty500":117.24},{"date":"2026-04-29","z47":120.0,"nifty500":117.78},{"date":"2026-04-30","z47":119.35,"nifty500":116.81},{"date":"2026-05-01","z47":119.64,"nifty500":116.81},{"date":"2026-05-04","z47":121.45,"nifty500":117.57},{"date":"2026-05-05","z47":120.41,"nifty500":117.46},{"date":"2026-05-06","z47":121.48,"nifty500":119.13},{"date":"2026-05-07","z47":122.62,"nifty500":119.55},{"date":"2026-05-08","z47":122.04,"nifty500":119.04},{"date":"2026-05-11","z47":120.31,"nifty500":117.39},{"date":"2026-05-12","z47":116.51,"nifty500":114.84},{"date":"2026-05-13","z47":116.49,"nifty500":115.24},{"date":"2026-05-14","z47":117.75,"nifty500":116.45},{"date":"2026-05-15","z47":117.57,"nifty500":116.03},{"date":"2026-05-18","z47":117.03,"nifty500":115.67},{"date":"2026-05-19","z47":118.78,"nifty500":115.98},{"date":"2026-05-20","z47":119.11,"nifty500":116.27},{"date":"2026-05-21","z47":118.72,"nifty500":116.4},{"date":"2026-05-22","z47":118.67,"nifty500":116.65},{"date":"2026-05-25","z47":119.1,"nifty500":118.08},{"date":"2026-05-26","z47":119.69,"nifty500":117.92},{"date":"2026-05-27","z47":120.47,"nifty500":118.28},{"date":"2026-05-28","z47":120.59,"nifty500":118.28},{"date":"2026-05-29","z47":119.07,"nifty500":116.68},{"date":"2026-06-01","z47":118.3,"nifty500":115.55},{"date":"2026-06-02","z47":118.5,"nifty500":115.98},{"date":"2026-06-03","z47":117.15,"nifty500":115.62},{"date":"2026-06-04","z47":117.11,"nifty500":115.86},{"date":"2026-06-05","z47":117.25,"nifty500":115.69},{"date":"2026-06-08","z47":115.32,"nifty500":114.19},{"date":"2026-06-09","z47":116.59,"nifty500":115.2},{"date":"2026-06-10","z47":115.59,"nifty500":114.5},{"date":"2026-06-11","z47":114.57,"nifty500":113.88},{"date":"2026-06-12","z47":117.69,"nifty500":116.38},{"date":"2026-06-15","z47":120.03,"nifty500":116.38},{"date":"2026-06-16","z47":120.0,"nifty500":118.43},{"date":"2026-06-17","z47":121.45,"nifty500":119.01},{"date":"2026-06-18","z47":121.99,"nifty500":119.51},{"date":"2026-06-19","z47":122.94,"nifty500":119.19},{"date":"2026-06-22","z47":123.49,"nifty500":119.79},{"date":"2026-06-23","z47":122.55,"nifty500":118.5},{"date":"2026-06-24","z47":122.59,"nifty500":119.09},{"date":"2026-06-25","z47":121.92,"nifty500":119.03},{"date":"2026-06-26","z47":121.93,"nifty500":119.03},{"date":"2026-06-29","z47":122.76,"nifty500":118.44},{"date":"2026-06-30","z47":124.26,"nifty500":118.42}],"movers":{"gainers":[{"name":"CarTrade","ticker":"CARTRADE","sector":"Consumer / Consumer Tech","ret_1m":51.97},{"name":"Amagi Media Labs","ticker":"AMAGI","sector":"SaaS / AI","ret_1m":37.02},{"name":"PhysicsWallah","ticker":"PWL","sector":"Consumer / Consumer Tech","ret_1m":22.59},{"name":"Ather Energy","ticker":"ATHERENERG","sector":"Consumer / Consumer Tech","ret_1m":21.67},{"name":"Ixigo","ticker":"IXIGO","sector":"Consumer / Consumer Tech","ret_1m":20.83}],"losers":[{"name":"Fractal Analytics","ticker":"FRACTAL","sector":"SaaS / AI","ret_1m":-9.81},{"name":"MedPlus Health","ticker":"MEDPLUS","sector":"Consumer / Consumer Tech","ret_1m":-7.31},{"name":"Freshworks","ticker":"FRSH","sector":"SaaS / AI","ret_1m":-5.1},{"name":"Awfis Space Solutions","ticker":"AWFIS","sector":"B2B","ret_1m":-4.98},{"name":"Swiggy","ticker":"SWIGGY","sector":"Consumer / Consumer Tech","ret_1m":-4.16}]},"largest":[{"name":"Eternal (Zomato)","ret_1m":6.65},{"name":"Groww","ret_1m":8.81},{"name":"Lenskart","ret_1m":-0.77},{"name":"Nykaa","ret_1m":16.55},{"name":"Meesho","ret_1m":6.85}]};
  /* ------------------------------ HELPERS --------------------------------- */
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function byKey(key)     { return $all('[data-z47="' + key + '"]'); }
  function fmtPct(n)      { return (n >= 0 ? "+" : "") + n.toFixed(1) + "%"; }
  function fmtNum(n, d)   { return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function signCls(n)     { return n >= 0 ? UP_CLASS : DOWN_CLASS; }
  function colorFor(n)    { return (typeof n === "number" && isFinite(n)) ? (n >= 0 ? POS_COLOR : NEG_COLOR) : ""; }
  function colorKey(key, n) { byKey(key).forEach(function (el) { el.style.color = colorFor(n); }); }
  function setText(key, text) { byKey(key).forEach(function (el) { el.textContent = text; }); }
  function setPct(key, n) {
    byKey(key).forEach(function (el) {
      el.textContent = fmtPct(n);
      el.classList.remove(UP_CLASS, DOWN_CLASS);
      el.classList.add(signCls(n));
    });
  }
  // Like setPct, but colours via INLINE style only (no UP/DOWN class). Use where a
  // colour class would drag in extra styling (e.g. the chart pills, whose red class
  // bumped the font-size on negative ranges). Matches the green/red used elsewhere.
  function setPctPlain(key, n) {
    byKey(key).forEach(function (el) {
      el.textContent = fmtPct(n);
      el.classList.remove(UP_CLASS, DOWN_CLASS);
      el.style.color = colorFor(n);
    });
  }
  function monthLabel(iso) {
    var dt = new Date(iso);
    return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
  // map a toggle range key -> the matching returns{} key
  function returnsKey(range) { return range === "SINCE" ? "since_base" : range; }
  /* ------------------------------ LOADER ---------------------------------- */
  function loadFeed() {
    if (!FEED_URL) return Promise.resolve(Z47_FALLBACK);
    return fetch(FEED_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .catch(function (e) { console.warn("[z47] live feed unavailable, using inline snapshot:", e.message); return Z47_FALLBACK; });
  }
  /* --------------------------- RENDER: SCALARS ---------------------------- */
  function paintScalars(d) {
    // --- 4 value cards ---
    setText("card-z47-value", fmtNum(d.index.value, 1));
    setPct("card-z47-since", d.index.returns.since_base);
    // Nifty card: RAW NIFTY 500 points (e.g. 22,996) — matches the source dashboard,
    // which shows the actual index level here (NOT indexed-to-100).
    setText("card-nifty-value", fmtNum(d.benchmark.value, 0));
    setPct("card-nifty-since", d.benchmark.returns.since_base);
    setPct("card-spread-value", d.index.returns.since_base - d.benchmark.returns.since_base); // pp spread
    // --- FX card (meta.usdinr not yet emitted by build_z47_json.py) ---
    var fx = d.meta && d.meta.usdinr;
    if (fx && typeof fx.value === "number") {
      setText("card-fx-value", "₹" + fx.value.toFixed(2));
      if (typeof fx.daily_pct === "number") setPct("card-fx-change", fx.daily_pct);
      if (fx.as_of) setText("card-fx-time", fx.as_of);
    } else {
      setText("card-fx-value", "₹—");
      console.warn("[z47] meta.usdinr missing — FX card & hero FX blank until build_z47_json.py emits it.");
    }
    // --- hero status strip + pill ---
    setText("status-prices", (d.meta.market_open ? "LIVE — " : "") + (d.meta.generated_at_ist || ""));
    setText("status-fx", fx ? ("₹" + fx.value.toFixed(2)) : "₹—");
    setText("status-takeaway", monthLabel(d.meta.anchor_date).toUpperCase()); // swap to takeaway feed date when available
    if (d.index.returns[HERO_PILL_RANGE] != null)     setPct("hero-z47-pct",   d.index.returns[HERO_PILL_RANGE]);
    if (d.benchmark.returns[HERO_PILL_RANGE] != null) setPct("hero-nifty-pct", d.benchmark.returns[HERO_PILL_RANGE]);
    // --- return summary table ---
    ["1M", "3M", "6M", "1Y", "YTD", "since_base"].forEach(function (k) {
      var cell = k === "since_base" ? "SINCE" : k;
      setPct("ret-z47-" + cell,   d.index.returns[k]);
      setPct("ret-nifty-" + cell, d.benchmark.returns[k]);
      colorKey("ret-z47-" + cell,   d.index.returns[k]);     // green/red by sign
      colorKey("ret-nifty-" + cell, d.benchmark.returns[k]);
    });
  }
  /* ---------------------------- RENDER: MOVERS ---------------------------- */
  /* -------- Top Gainers / Laggards: CURATED editorial (client-controlled) -----
     The client shows a hand-picked shortlist with a "key driver" note per name
     instead of the raw live top-5. Names + notes are fixed here; the % is still
     pulled LIVE from the feed so the 1-month return never goes stale. To change
     what shows: edit these lists (add/remove rows, reword drivers), or set a list
     to null to fall back to the live top-5. */
  // Keyed by the Tab-2 Insights list keys (NOT the Tab-1 gainers-list/losers-list,
  // which stay LIVE top-5). Insights shows a curated 2 + a key-driver note each.
  var MOVERS_EDIT = {
    "gainers-insights": [
      { name: "CarTrade",          driver: "Auto-marketplace dominance and a cash-rich balance sheet." },
      { name: "Amagi Media Labs",  driver: "Profitability turnaround and AI-led cloud media adoption." }
    ],
    "losers-insights": [
      { name: "Fractal Analytics", driver: "Enterprise AI spending trends and post-listing share supply." },
      { name: "MedPlus Health",    driver: "Pharmacy-margin pressure and competitive intensity." }
    ]
  };
  // Largest Constituents (Insights): top-3 by market cap, names + live % filled
  // automatically. Optional context note per name goes here (keyed by company name);
  // leave "" until the client supplies copy — the engine shows nothing rather than a placeholder.
  var LARGEST_CONTEXT = {
    "Eternal (Zomato)": "Quick-commerce leadership and continued investment.",
    "Groww":            "Broking market-share gains and margin-funding growth.",
    "Lenskart":         "Store densification and margin expansion."
  };
  // live 1-month return by company name — from constituents (live feed) or movers (offline fallback)
  function retByName(d) {
    var m = {};
    (d.constituents || []).forEach(function (c) { m[c.name] = c.ret_1m; });
    ["gainers", "losers"].forEach(function (k) {
      (((d.movers || {})[k]) || []).forEach(function (r) { if (m[r.name] == null) m[r.name] = r.ret_1m; });
    });
    return m;
  }
  // curated rows for a list key (or null if not curated), each with the LIVE %
  function moversFor(listKey, d) {
    var edit = MOVERS_EDIT[listKey];
    if (!edit) return null;
    var look = retByName(d);
    return edit.map(function (e) { return { name: e.name, ret_1m: look[e.name], driver: e.driver }; });
  }
  /* Option 2 (Webflow owns the copy): fill ONLY the live % into any element tagged
     data-z47-ret="<Company Name or TICKER>". Name + driver text are typed in Webflow
     and left untouched. Use this when you build static mover rows instead of the
     cloned template. No-ops if no such elements exist. */
  function paintRetByAttr(d) {
    var byName = {}, byTicker = {};
    (d.constituents || []).forEach(function (c) {
      byName[c.name] = c.ret_1m; if (c.ticker) byTicker[c.ticker] = c.ret_1m;
    });
    ["gainers", "losers"].forEach(function (k) {
      (((d.movers || {})[k]) || []).forEach(function (r) {
        if (byName[r.name] == null) byName[r.name] = r.ret_1m;
        if (r.ticker && byTicker[r.ticker] == null) byTicker[r.ticker] = r.ret_1m;
      });
    });
    $all("[data-z47-ret]").forEach(function (el) {
      var key = el.getAttribute("data-z47-ret");
      var v = (byTicker[key] != null) ? byTicker[key] : byName[key];
      el.classList.remove(UP_CLASS, DOWN_CLASS);
      if (v == null || !isFinite(v)) { el.textContent = "—"; el.style.color = ""; return; }
      el.textContent = fmtPct(v);
      el.style.color = colorFor(v);
    });
  }
  function paintMovers(listKey, rows) {
    byKey(listKey).forEach(function (container) {   // fill EVERY list with this key (Tab 1 + Tab 2 reuse keys)
      var tpl = container.querySelector('[data-z47-template="mover"]');
      if (!tpl) { console.warn("[z47] no [data-z47-template=mover] inside", listKey); return; }
      tpl.style.display = "none";
      $all('[data-z47-clone]', container).forEach(function (n) { n.remove(); });
      rows.forEach(function (row, i) {
        var node = tpl.cloneNode(true);
        node.removeAttribute("data-z47-template");
        node.setAttribute("data-z47-clone", "");
        node.style.display = "";
        var rank = node.querySelector('[data-z47-cell="rank"]');
        var name = node.querySelector('[data-z47-cell="name"]');
        var ret  = node.querySelector('[data-z47-cell="ret"]');
        if (rank) rank.textContent = (i + 1) + ".";
        if (name) name.textContent = row.name;
        if (ret) {
          if (row.ret_1m == null || !isFinite(row.ret_1m)) {      // curated name not priced yet
            ret.textContent = "—";
            ret.classList.remove(UP_CLASS, DOWN_CLASS);
            ret.style.color = "";
          } else {
            ret.textContent = fmtPct(row.ret_1m);
            ret.classList.remove(UP_CLASS, DOWN_CLASS);
            ret.classList.add(signCls(row.ret_1m));
            ret.style.color = colorFor(row.ret_1m);          // green/red by sign
          }
        }
        // key-driver / context note — always fill data-z47-cell="context" (fallbacks:
        // "driver", .pointer-text) so the template's placeholder never leaks; blank if no note.
        var ctx = node.querySelector('[data-z47-cell="context"]')
               || node.querySelector('[data-z47-cell="driver"]')
               || node.querySelector(".pointer-text");
        if (ctx) ctx.textContent = (row.driver != null ? row.driver : "");
        container.appendChild(node);
      });
    });
  }
  /* ----------------------------- RENDER: CHART ---------------------------- */
  function sliceHistory(hist, range) {
    if (range === "SINCE") return hist;
    // The rebase base MUST match the feed's return base, so the chart endpoint == the % pill.
    // Builder uses: first history point on/after (last_date − N calendar days); YTD = Jan 1.
    var lastISO = hist[hist.length - 1].date;
    var cut;
    if (range === "YTD") {
      cut = lastISO.slice(0, 4) + "-01-01";
    } else {
      var days = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[range] || 30;
      var t = new Date(lastISO + "T00:00:00Z").getTime() - days * 86400000;  // UTC-safe day math
      cut = new Date(t).toISOString().slice(0, 10);
    }
    return hist.filter(function (p) { return p.date >= cut; });   // first point >= cut = the base
  }
  function toSeries(slice) {
    var z0 = slice[0].z47, n0 = slice[0].nifty500;
    return {
      labels: slice.map(function (p) { return p.date; }),
      z47:   slice.map(function (p) { return REBASE_ON_RANGE ? (p.z47 / z0 * 100)       : p.z47; }),
      nifty: slice.map(function (p) { return REBASE_ON_RANGE ? (p.nifty500 / n0 * 100)  : p.nifty500; })
    };
  }
  /* ------------------------- CHART LEGEND (with logo) --------------------- */
  // Renders into any [data-z47="chart-legend"] slot so the two lines are
  // identifiable: Z47 line -> brand logo, NIFTY line -> "NIFTY 500". Responsive.
  var Z47_LOGO_URL = "https://cdn.prod.website-files.com/678518036ebf6d040622b6b3/6a44aabfc756d243444e2426_zfortyseven.svg";
  function renderLegend() {
    var slots = byKey("chart-legend");
    if (!slots.length) return;
    if (!document.getElementById("z47-lgnd-css")) {
      var st = document.createElement("style"); st.id = "z47-lgnd-css";
      st.textContent =
        ".z47-lgnd{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 34px;width:100%;font-family:inherit;}"
      + ".z47-lgnd-item{display:inline-flex;align-items:center;gap:10px;}"
      + ".z47-lgnd-sw{display:inline-block;width:28px;height:4px;border-radius:2px;flex:0 0 auto;}"
      + ".z47-lgnd-logo{height:20px;width:auto;display:block;}"
      + ".z47-lgnd-txt{font-size:17px;font-weight:600;color:#111;white-space:nowrap;line-height:1;}"
      + "@media(max-width:600px){.z47-lgnd{gap:10px 22px;}.z47-lgnd-sw{width:22px;}.z47-lgnd-logo{height:16px;}.z47-lgnd-txt{font-size:14px;}}";
      document.head.appendChild(st);
    }
    var html =
        '<span class="z47-lgnd-item"><span class="z47-lgnd-sw" style="background:' + Z47_COLOR + '"></span>'
      +   '<img class="z47-lgnd-logo" src="' + Z47_LOGO_URL + '" alt="Z47 fortyseven"></span>'
      + '<span class="z47-lgnd-item"><span class="z47-lgnd-sw" style="background:' + NIFTY_COLOR + '"></span>'
      +   '<span class="z47-lgnd-txt">NIFTY 500</span></span>';
    slots.forEach(function (el) { el.classList.add("z47-lgnd"); el.innerHTML = html; });
  }
  var chart = null;
  function renderChart(d, range) {
    var canvas = document.getElementById("z47-chart");
    if (!canvas) return;
    var s = toSeries(sliceHistory(d.history, range));
    var data = {
      labels: s.labels,
      datasets: [
        { label: "Z47^fortyseven", data: s.z47,   borderColor: Z47_COLOR,   borderWidth: 2, pointRadius: 0, tension: 0.15 },
        { label: "NIFTY 500",      data: s.nifty, borderColor: NIFTY_COLOR, borderWidth: 2, pointRadius: 0, tension: 0.15 }
      ]
    };
    var narrow = (window.innerWidth || document.documentElement.clientWidth || 1024) < 480;
    var options = {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (items) { return monthLabel(items[0].label); },
            label: function (it) { return it.dataset.label + ": " + it.parsed.y.toFixed(1); }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: narrow ? 4 : 7, autoSkip: true, maxRotation: 0,
              callback: function (v) { return monthLabel(this.getLabelForValue(v)); } } },
        y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { precision: 0, maxTicksLimit: narrow ? 5 : 8 } }
      }
    };
    if (chart) { chart.data = data; chart.options = options; chart.update(); }
    else {
      var prev = window.Chart && Chart.getChart ? Chart.getChart(canvas) : null;
      if (prev) prev.destroy();
      chart = new Chart(canvas, { type: "line", data: data, options: options });
    }
    // % pills above the chart
    var rk = returnsKey(range);
    if (d.index.returns[rk] != null)     setPctPlain("chart-z47-pct",   d.index.returns[rk]);
    if (d.benchmark.returns[rk] != null) setPctPlain("chart-nifty-pct", d.benchmark.returns[rk]);
  }
  function renderSparkline(d) {
    var canvas = document.getElementById("z47-hero-spark");
    if (!canvas) return;
    var ys = d.history.map(function (p) { return p.z47; });
    new Chart(canvas, {
      type: "line",
      data: { labels: ys.map(function (_, i) { return i; }),
              datasets: [{ data: ys, borderColor: Z47_COLOR, borderWidth: 1.5, pointRadius: 0, tension: 0.2 }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } } }
    });
  }
  function wireToggle(d) {
    $all("[data-z47-range]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();   // tabs are <a href="#"> — don't jump the page
        $all("[data-z47-range]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        renderChart(d, btn.getAttribute("data-z47-range"));
      });
    });
    // reflect the default selection in the UI
    var def = $all('[data-z47-range="' + DEFAULT_RANGE + '"]')[0];
    if (def) def.classList.add("is-active");
  }
  /* If the 01–04 nav uses Webflow's native Tabs, the chart can initialise at 0px
     inside a hidden pane. Re-fit it whenever it becomes visible / a tab is shown. */
  function wireTabResize() {
    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".w-tab-link, [data-w-tab], [data-z47-tab]")) {
        setTimeout(function () { if (chart) chart.resize(); }, 60);
      }
    }, true);
    var canvas = document.getElementById("z47-chart");
    if (canvas && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting && chart) chart.resize(); });
      }).observe(canvas);
    }
  }
  /* ------------------------------- INIT ----------------------------------- */
  var DEFAULT_PERIOD = "1M";  // Performance return-summary tabs
  var PERIODS = ["1M", "3M", "6M", "YTD", "1Y"];

  function applyPeriod(d, period) {
    var key = returnsKey(period);
    var z = d.index && d.index.returns ? d.index.returns[key] : null;
    var n = d.benchmark && d.benchmark.returns ? d.benchmark.returns[key] : null;
    // Two main blocks (Z47 + Nifty) for the selected period
    if (z != null) setPct("card-z47-period", z);
    if (n != null) setPct("card-nifty-period", n);
    // Also refresh the legacy "since" cards when used as period display
    if (z != null) setPct("card-z47-since", z);
    if (n != null) setPct("card-nifty-since", n);
    if (z != null && n != null) setPct("card-spread-value", z - n);
    // Highlight active period column in the full return table (if present)
    PERIODS.concat(["SINCE"]).forEach(function (p) {
      $all('[data-z47-period-col="' + p + '"]').forEach(function (el) {
        el.classList.toggle("is-active-period", p === period);
      });
    });
    var bundle = (d.movers_by_period && d.movers_by_period[period]) || d.movers || {};
    paintMovers("gainers-list", bundle.gainers || []);
    paintMovers("losers-list",  bundle.losers  || []);
    // Update any [data-z47-period-label] text
    $all("[data-z47-period-label]").forEach(function (el) { el.textContent = period; });
  }

  function wirePeriodTabs(d) {
    if (window.__Z47_PERIOD_TABS_WIRED) {
      applyPeriod(d, DEFAULT_PERIOD);
      return;
    }
    window.__Z47_PERIOD_TABS_WIRED = true;
    var buttons = $all("[data-z47-period]");
    if (!buttons.length) {
      // Inject minimal tab bar above return summary if designer hasn't added one yet
      var host = byKey("return-summary")[0] || byKey("card-z47-value")[0] || document.querySelector("[data-z47='gainers-list']");
      if (host && host.parentNode) {
        var bar = document.createElement("div");
        bar.setAttribute("data-z47", "period-tabs");
        bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px;";
        PERIODS.forEach(function (p) {
          var b = document.createElement("button");
          b.type = "button";
          b.setAttribute("data-z47-period", p);
          b.textContent = p;
          b.style.cssText = "cursor:pointer;padding:6px 12px;border:1px solid #ccc;background:#fff;font:inherit;";
          bar.appendChild(b);
        });
        host.parentNode.insertBefore(bar, host);
        buttons = $all("[data-z47-period]");
      }
    }
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var period = btn.getAttribute("data-z47-period");
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        applyPeriod(d, period);
      });
    });
    var def = $all('[data-z47-period="' + DEFAULT_PERIOD + '"]')[0] || buttons[0];
    if (def) {
      def.classList.add("is-active");
      applyPeriod(d, def.getAttribute("data-z47-period") || DEFAULT_PERIOD);
    }
  }

  function init() {
    if (typeof Chart === "undefined") { console.error("[z47] Chart.js failed to load."); }
    loadFeed().then(function (d) {
      window.__Z47 = d; // handy for debugging in the console
      paintScalars(d);
      paintMovers("gainers-list", d.movers.gainers);   // Tab 1 Performance: LIVE top-5
      paintMovers("losers-list",  d.movers.losers);    // Tab 1 Performance: LIVE top-5
      paintMovers("gainers-insights", moversFor("gainers-insights", d) || d.movers.gainers);  // Tab 2 Insights: curated 2 + context
      paintMovers("losers-insights",  moversFor("losers-insights", d)  || d.movers.losers);   // Tab 2 Insights: curated 2 + context
      paintRetByAttr(d);   // Option 2: fill live % into any static [data-z47-ret] rows
      var _largest = (d.largest && d.largest.length) ? d.largest
        : (d.constituents || []).slice().sort(function (a, b) { return (b.mcap_mn || 0) - (a.mcap_mn || 0); })
            .map(function (c) { return { name: c.name, ret_1m: c.ret_1m }; });
      _largest = _largest.slice(0, 3).map(function (r) {          // top 3 by mkt cap
        return { name: r.name, ret_1m: r.ret_1m, driver: LARGEST_CONTEXT[r.name] };
      });
      paintMovers("largest-list", _largest);   // Insights: top-3 by mkt cap (name + live %, optional context)
      renderChart(d, DEFAULT_RANGE);
      renderLegend();
      renderSparkline(d);
      wireToggle(d);
      wireTabResize();
      wirePeriodTabs(d);  // Thursday: 1M/3M/6M/YTD/1Y tabs → Z47/Nifty + movers
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
