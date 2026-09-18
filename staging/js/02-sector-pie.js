
/**
 * Z47 Tab 3 — Sector Composition donut
 * Consumer STARTS at 12 o'clock; legends pinned to each arc's mid-height.
 */
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  var DEEP = {
    "Consumer / Consumer Tech": "#6B3410",
    "Fintech / Financial Services": "#103B33",
    "SaaS / AI": "#5E1A50",
    "B2B": "#12295C"
  };
  var LINE_COLOR = "#9B7B4E";
  var PCT_FONT = "Kodemono, ui-monospace, Menlo, monospace";
  var PCT_SIZE = 19;
  var CUTOUT = "58%";
  var DISP = {
    "Consumer / Consumer Tech": "Consumer Tech",
    "Fintech / Financial Services": "Fintech",
    "SaaS / AI": "SaaS/AI",
    "B2B": "B2B"
  };
  // Legend sides are computed from each arc mid-angle (not hard-coded),
  // so leader lines always sit next to the matching segment.
  var ORDER = ["Consumer / Consumer Tech", "B2B", "SaaS / AI", "Fintech / Financial Services"];
  var FALLBACK = [{"name":"Consumer / Consumer Tech","count":21,"weight_pct":63.1,"avg_ret_1m":3.68,"top_mover":{"name":"Milky Mist","ret_1m":39.94}},{"name":"Fintech / Financial Services","count":11,"weight_pct":24.9,"avg_ret_1m":4.3,"top_mover":{"name":"Pine Labs","ret_1m":18.64}},{"name":"SaaS / AI","count":8,"weight_pct":6.4,"avg_ret_1m":-5.97,"top_mover":{"name":"Amagi Media Labs","ret_1m":2.23}},{"name":"B2B","count":7,"weight_pct":5.6,"avg_ret_1m":-3.51,"top_mover":{"name":"TBO Tek","ret_1m":3.77}}];

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
  function fromFeed(d) {
    return (d.sectors || []).map(function (s) {
      return { name: s.name, count: s.count, weight_pct: s.weight_pct };
    });
  }
  function isNarrow() {
    return (window.innerWidth || document.documentElement.clientWidth || 1024) <= 720;
  }

  function itemHtml(name, color, count, side) {
    var disp = DISP[name] || name;
    var content =
      '<div class="z47-leg-text">' +
      '<div class="z47-leg-count"><span class="z47-sq" style="background:' + color + '"></span>' +
      '<span class="z47-leg-num" style="color:' + color + '">' + count + " COMPANIES</span></div>" +
      '<div class="z47-leg-name">' + disp + "</div></div>";
    var line = '<span class="z47-leg-line" style="background:' + LINE_COLOR + '"></span>';
    return (
      '<div class="z47-leg z47-leg--' + side + '" data-z47-sector="' + name + '">' +
      (side === "left" ? content + line : line + content) +
      "</div>"
    );
  }

  function buildLegend(chart, ord, vals) {
    var ds = chart.data.datasets[0];
    var meta = chart.getDatasetMeta(0);
    var items = [];
    ord.forEach(function (n, i) {
      var arc = meta.data[i];
      if (!arc) return;
      var p = arc.getProps(["startAngle", "endAngle"], true);
      var mid = (p.startAngle + p.endAngle) / 2;
      // Chart.js: 0 = 3 o'clock, +clockwise. cos>0 => right half of donut.
      items.push({
        name: n,
        side: Math.cos(mid) >= 0 ? "right" : "left",
        y: Math.sin(mid), // smaller = higher on screen
        color: Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor,
        count: vals[i],
        mid: mid
      });
    });
    items.sort(function (a, b) {
      if (a.side !== b.side) return a.side === "left" ? -1 : 1;
      return a.y - b.y;
    });
    var left = items.filter(function (it) { return it.side === "left"; });
    var right = items.filter(function (it) { return it.side === "right"; });

    var L = document.querySelector(".z47-secL");
    var R = document.querySelector(".z47-secR");
    if (L) L.innerHTML = left.map(function (it) { return itemHtml(it.name, it.color, it.count, "left"); }).join("");
    if (R) R.innerHTML = right.map(function (it) { return itemHtml(it.name, it.color, it.count, "right"); }).join("");

    chart.$z47LegendItems = items;
    var wrap = document.querySelector(".z47-sec-wrap");
    if (wrap) wrap.classList.add("z47-ready");
    positionLegends(chart, items);
  }

  function positionLegends(chart, items) {
    var wrap = document.querySelector(".z47-sec-wrap");
    var L = document.querySelector(".z47-secL");
    var R = document.querySelector(".z47-secR");
    if (!wrap || !L || !R) return;

    var legs = wrap.querySelectorAll(".z47-leg");
    if (isNarrow()) {
      wrap.classList.remove("z47-legends-pinned");
      Array.prototype.forEach.call(legs, function (el) {
        el.style.position = "";
        el.style.top = "";
        el.style.left = "";
        el.style.right = "";
      });
      return;
    }

    var meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;
    var wrapRect = wrap.getBoundingClientRect();
    var canvasRect = chart.canvas.getBoundingClientRect();
    var byName = {};
    items.forEach(function (it) { byName[it.name] = it; });

    // Map sector → Y of outer-rim midpoint in wrap coordinates
    var midYInWrap = {};
    chart.data.labels.forEach(function (_label, i) {
      // recover sector full name from items order matching ord
    });
    // Prefer items[].name with matching arc index from chart.$z47Ord
    var ord = chart.$z47Ord || [];
    ord.forEach(function (n, i) {
      var arc = meta.data[i];
      if (!arc) return;
      var p = arc.getProps(["x", "y", "startAngle", "endAngle", "outerRadius"], true);
      var mid = (p.startAngle + p.endAngle) / 2;
      var py = p.y + Math.sin(mid) * p.outerRadius;
      midYInWrap[n] = canvasRect.top - wrapRect.top + py;
    });

    function pinColumn(col) {
      var colRect = col.getBoundingClientRect();
      var colTopInWrap = colRect.top - wrapRect.top;
      var colH = col.clientHeight || colRect.height;
      Array.prototype.forEach.call(col.querySelectorAll(".z47-leg"), function (el) {
        var name = el.getAttribute("data-z47-sector");
        if (!name || midYInWrap[name] == null) return;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.right = "0";
        var h = el.offsetHeight || 56;
        var top = midYInWrap[name] - colTopInWrap - h / 2;
        top = Math.max(0, Math.min(top, Math.max(0, colH - h)));
        el.style.top = Math.round(top) + "px";
      });
    }

    wrap.classList.add("z47-legends-pinned");
    pinColumn(L);
    pinColumn(R);
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

  function draw(SECTORS) {
    var cv = document.getElementById("z47-sector-donut");
    if (!cv || !window.Chart || !SECTORS.length) return null;
    var prev = window.Chart.getChart ? window.Chart.getChart(cv) : null;
    if (prev) prev.destroy();
    var byName = {};
    SECTORS.forEach(function (s) { byName[s.name] = s; });

    var ord = ORDER.filter(function (n) { return byName[n]; });
    var vals = ord.map(function (n) { return byName[n].count; });
    var fills = ord.map(function (n) { return DEEP[n] || "#999"; });
    var total = vals.reduce(function (a, v) { return a + v; }, 0) || 1;
    var pcts = vals.map(function (v) { return (v / total) * 100; });
    // -π/2 = 12 o'clock. Consumer STARTS here, then clockwise B2B → SaaS/AI → Fintech.
    var rotation = -Math.PI / 2;

    var pctLabels = {
      id: "z47pct",
      afterDatasetsDraw: function (c) {
        if (!c.$labelsReady) return;
        var ctx = c.ctx, meta = c.getDatasetMeta(0);
        ctx.save();
        ctx.globalAlpha = c.$labelAlpha == null ? 1 : c.$labelAlpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 " + PCT_SIZE + "px " + PCT_FONT;
        ctx.fillStyle = "#FFFFFF";
        meta.data.forEach(function (arc, i) {
          var p = arc.getProps(["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"], true);
          var mid = (p.startAngle + p.endAngle) / 2;
          var r = (p.innerRadius + p.outerRadius) / 2;
          ctx.fillText(pcts[i].toFixed(1) + "%", p.x + Math.cos(mid) * r, p.y + Math.sin(mid) * r);
        });
        ctx.restore();
      }
    };

    var chart = new Chart(cv, {
      type: "doughnut",
      data: {
        labels: ord.map(function (n) { return DISP[n] || n; }),
        datasets: [{
          data: vals,
          backgroundColor: fills,
          borderColor: "#FFFFFF",
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: CUTOUT,
        rotation: rotation,
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 650,
          easing: "easeOutCirc",
          onComplete: function () {
            if (chart.$revealed) return;
            chart.$revealed = true;
            buildLegend(chart, ord, vals);
            fadeLabelsIn(chart);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (it) {
                var s = byName[ord[it.dataIndex]];
                return (DISP[ord[it.dataIndex]] || s.name) + ": " + s.count + " cos · " + pcts[it.dataIndex].toFixed(1) + "%";
              }
            }
          }
        }
      },
      plugins: [pctLabels]
    });

    chart.$z47Ord = ord;
    return chart;
  }

  var pending = null, made = false, theChart = null;

  function tryCreate() {
    if (made || !pending) return;
    var cv = document.getElementById("z47-sector-donut");
    if (!cv || cv.clientWidth === 0) return;
    made = true;
    theChart = draw(pending);
  }

  function watch() {
    var cv = document.getElementById("z47-sector-donut");
    if (cv && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            tryCreate();
            if (theChart) {
              theChart.resize();
              if (theChart.$z47LegendItems) positionLegends(theChart, theChart.$z47LegendItems);
            }
          }
        });
      }).observe(cv);
    }
    tryCreate();
    window.addEventListener("resize", function () {
      if (!theChart || !theChart.$z47LegendItems) return;
      positionLegends(theChart, theChart.$z47LegendItems);
    });
  }

  function start() {
    ready(function () {
      whenFonts(function () {
        fetch(FEED_URL)
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (d) { pending = fromFeed(d); watch(); })
          .catch(function () { pending = FALLBACK; watch(); });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
