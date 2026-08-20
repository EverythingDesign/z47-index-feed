/**
 * Z47 Constituents — Large / Mid / Small Cap donut
 * Figma legend: horizontal row under donut — square + name + % below
 */
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  // Girish: Large > ₹1,00,000 Cr; Mid ₹30,000–1,00,000 Cr; Small < ₹30,000 Cr
  var LARGE_MIN_CR = 100000;
  var MID_MIN_CR = 30000;
  var ORDER = ["Large Cap", "Mid Cap", "Small Cap"];
  var COLORS = { "Large Cap": "#FFF0D2", "Mid Cap": "#FF6800", "Small Cap": "#000000" };
  var PCT_FONT = "Kodemono, ui-monospace, Menlo, monospace";
  var PCT_SIZE = 16;
  var CUTOUT = "58%";

  function capsHost() {
    return document.querySelector(".caps-consitutents") ||
      document.querySelector(".caps-constitutents") ||
      document.querySelector(".caps-constituents") ||
      document.querySelector("[class*=\"caps-cons\"]");
  }
  function wrapEl() {
    var h = capsHost();
    return h ? h.querySelector(".z47-cap-wrap") : null;
  }
  function legendEl() {
    var w = wrapEl();
    return w ? w.querySelector(".z47-cap-legend") : null;
  }

  function mcapCr(c) {
    if (c.mcap_cr != null && isFinite(c.mcap_cr)) return c.mcap_cr;
    if (c.mcap_mn != null && isFinite(c.mcap_mn)) return c.mcap_mn / 10;
    return null;
  }
  function bucketName(mcr) {
    if (mcr == null || !isFinite(mcr)) return null;
    if (mcr > LARGE_MIN_CR) return "Large Cap";
    if (mcr >= MID_MIN_CR) return "Mid Cap";
    return "Small Cap";
  }
  function fromFeed(d) {
    var buckets = {};
    ORDER.forEach(function (k) { buckets[k] = { count: 0, mcap_cr: 0 }; });
    (d.constituents || []).forEach(function (c) {
      var m = mcapCr(c);
      var b = bucketName(m);
      if (!b) return;
      buckets[b].count += 1;
      buckets[b].mcap_cr += m || 0;
    });
    var totalMcap = ORDER.reduce(function (s, k) { return s + buckets[k].mcap_cr; }, 0) || 1;
    return ORDER.map(function (name) {
      var b = buckets[name];
      return {
        name: name,
        count: b.count,
        mcap_cr: b.mcap_cr,
        weight_pct: (b.mcap_cr / totalMcap) * 100
      };
    }).filter(function (s) { return s.count > 0; });
  }

  function ready(cb) {
    if (window.Chart) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    s.onload = cb;
    (document.head || document.body).appendChild(s);
  }
  function whenFonts(cb) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb);
    else cb();
  }

  function buildLegend(ord, byName) {
    var host = legendEl();
    if (!host) return;
    host.innerHTML = ord.map(function (n) {
      var row = byName[n];
      var color = COLORS[n] || "#999";
      var pct = row.weight_pct.toFixed(1) + "%";
      var border = n === "Large Cap" ? "border:1px solid rgba(0,0,0,.12);" : "";
      return (
        '<div class="z47-cap-leg" data-z47-cap="' + n + '">' +
          '<span class="z47-cap-sq" style="background:' + color + ';' + border + '"></span>' +
          '<div class="z47-cap-leg-text">' +
            '<div class="z47-cap-leg-name">' + n + "</div>" +
            '<div class="z47-cap-leg-pct">' + pct + "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
    var wrap = wrapEl();
    if (wrap) wrap.classList.add("z47-ready");
  }

  function fadeLabelsIn(chart) {
    var DURATION = 200, t0 = null;
    chart.$labelsReady = true;
    function step(ts) {
      if (t0 === null) t0 = ts;
      chart.$labelAlpha = Math.min(1, (ts - t0) / DURATION);
      chart.draw();
      if (chart.$labelAlpha < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function draw(CAPS) {
    var cv = document.getElementById("z47-cap-donut");
    if (!cv || !window.Chart || !CAPS.length) return null;
    var prev = window.Chart.getChart ? window.Chart.getChart(cv) : null;
    if (prev) prev.destroy();

    var byName = {};
    CAPS.forEach(function (s) { byName[s.name] = s; });
    var ord = ORDER.filter(function (n) { return byName[n] && byName[n].count > 0; });
    var vals = ord.map(function (n) { return byName[n].mcap_cr; });
    var pcts = ord.map(function (n) { return byName[n].weight_pct; });
    var fills = ord.map(function (n) { return COLORS[n] || "#999"; });

    // % callouts outside the ring (Figma)
    var pctLabels = {
      id: "z47capPct",
      afterDatasetsDraw: function (c) {
        if (!c.$labelsReady) return;
        var ctx = c.ctx, meta = c.getDatasetMeta(0);
        ctx.save();
        ctx.globalAlpha = c.$labelAlpha == null ? 1 : c.$labelAlpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 " + PCT_SIZE + "px " + PCT_FONT;
        ctx.fillStyle = "#111111";
        meta.data.forEach(function (arc, i) {
          var p = arc.getProps(["x", "y", "startAngle", "endAngle", "outerRadius"], true);
          var mid = (p.startAngle + p.endAngle) / 2;
          var cos = Math.cos(mid);
          var sin = Math.sin(mid);
          var r = p.outerRadius + 36 + (pcts[i] < 3 ? 10 : 0);
          var x = p.x + cos * r;
          var y = p.y + sin * r;
          var label = pcts[i].toFixed(1) + "%";
          ctx.textAlign = cos >= 0 ? "left" : "right";
          ctx.textBaseline = "middle";
          var tw = ctx.measureText(label).width;
          var m = 12;
          if (ctx.textAlign === "left") x = Math.min(x, c.width - m - tw);
          else x = Math.max(x, m + tw);
          y = Math.min(c.height - m - 8, Math.max(m + 8, y));
          ctx.fillText(label, x, y);
        });
        ctx.restore();
      }
    };

    var chart = new Chart(cv, {
      type: "doughnut",
      data: {
        labels: ord,
        datasets: [{
          data: vals,
          backgroundColor: fills,
          borderColor: "#FFFFFF",
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { top: 22, bottom: 4, left: 52, right: 52 } },
        cutout: CUTOUT,
        // Chart.js 4: degrees, 0 = 12 o'clock, clockwise.
        // Start Large at 3 o'clock so it already fills 12 o'clock going
        // clockwise, then Mid, then Small at ~3 o'clock (1.1% readable).
        rotation: 90,
        circumference: 360,
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 650,
          easing: "easeOutCirc",
          onComplete: function () {
            if (chart.$revealed) return;
            chart.$revealed = true;
            buildLegend(ord, byName);
            fadeLabelsIn(chart);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      },
      plugins: [pctLabels]
    });
    chart.$z47Ord = ord;
    // If chart already drawn (no animation path), ensure legend
    if (!chart.$revealed) {
      // legend also after first frame in case animation skipped when hidden
      setTimeout(function () {
        if (!chart.$revealed) {
          chart.$revealed = true;
          buildLegend(ord, byName);
          fadeLabelsIn(chart);
        }
      }, 700);
    }
    return chart;
  }

  var pending = null, made = false, theChart = null;
  function tryCreate() {
    if (!pending) return;
    var cv = document.getElementById("z47-cap-donut");
    if (!cv || cv.clientWidth === 0) return;
    if (made && theChart) {
      theChart.resize();
      return;
    }
    made = true;
    theChart = draw(pending);
    window.__Z47_capChart = theChart;
  }
  window.__Z47_capChartTryCreate = function () {
    made = false;
    tryCreate();
  };

  function watch() {
    var cv = document.getElementById("z47-cap-donut");
    if (cv && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) tryCreate();
        });
      }).observe(cv);
    }
    tryCreate();
    window.addEventListener("resize", function () {
      if (theChart) theChart.resize();
    });
  }

  function loadAndDraw() {
    fetch(FEED_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("feed"); return r.json(); })
      .then(function (d) {
        pending = fromFeed(d);
        made = false;
        watch();
        tryCreate();
      })
      .catch(function (err) {
        console.warn("[z47] cap pie feed failed", err);
      });
  }

  function start() {
    if (!capsHost()) return;
    window.__Z47_capPieV = "20260820-girish";
    ready(function () {
      whenFonts(function () {
        loadAndDraw();
        setTimeout(loadAndDraw, 200);
        setTimeout(loadAndDraw, 800);
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
