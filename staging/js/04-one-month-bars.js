
/**
 * Z47 Tab 3 — One-month price movement bars (all 47 constituents)
 * Click a company name / bar → /z47-forty-seven/{slug}
 */
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  var GAIN = "#FF6800", LOSS = "#707070";
  var GAIN_FADE = "rgba(255,104,0,0.22)", LOSS_FADE = "rgba(112,112,112,0.22)";
  var NAME_FONT = '"NN Swinton", Georgia, serif';
  var NAME_SIZE = 18, NAME_COLOR = "#000";
  var NAME_DIM  = "rgba(0,0,0,0.30)";
  var ROW_H = 26;

  function ready(cb) {
    if (window.Chart) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    s.onload = cb;
    (document.head || document.body).appendChild(s);
  }
  function whenFonts(cb) {
    if (!(document.fonts && document.fonts.ready)) return cb();
    var p = document.fonts.load ? document.fonts.load('18px "NN Swinton"').catch(function () {}) : Promise.resolve();
    p.then(function () { return document.fonts.ready; }).then(cb);
  }
  function detailUrl(c) {
    return c.detail_url || ("/z47-forty-seven/" + (c.slug || (c.ticker || "").toLowerCase()));
  }
  function fromFeed(d) {
    return (d.constituents || []).slice()
      .sort(function (a, b) {
        if (a.ret_1m == null) return b.ret_1m == null ? 0 : 1;
        if (b.ret_1m == null) return -1;
        return b.ret_1m - a.ret_1m;
      })
      .map(function (c) {
        return {
          name: c.name,
          ticker: c.ticker,
          slug: c.slug,
          ret_1m: c.ret_1m,
          detail_url: detailUrl(c)
        };
      });
  }
  function metrics() {
    var w = window.innerWidth || 1024;
    if (w < 480) return { size: 11, rowH: 19, bar: 11, trunc: 16, xTicks: 6 };
    if (w < 768) return { size: 13, rowH: 22, bar: 14, trunc: 24, xTicks: 8 };
    return { size: NAME_SIZE, rowH: ROW_H, bar: 18, trunc: 0, xTicks: 0 };
  }
  function draw(ROWS) {
    var cv = document.getElementById("z47-movement-bars");
    if (!cv || !window.Chart || !ROWS.length) return;
    var prev = window.Chart.getChart ? window.Chart.getChart(cv) : null;
    if (prev) prev.destroy();

    var view = metrics();
    cv.parentNode.style.height = (ROWS.length * view.rowH + 56) + "px";
    var labels = ROWS.map(function (r) { return r.name; });
    var vals = ROWS.map(function (r) { return r.ret_1m; });
    var hoverIndex = null;

    function barColors() {
      return vals.map(function (v, i) {
        var full = v >= 0 ? GAIN : LOSS, fade = v >= 0 ? GAIN_FADE : LOSS_FADE;
        return (hoverIndex == null || i === hoverIndex) ? full : fade;
      });
    }
    function setFocus(idx) {
      if (idx === hoverIndex) return;
      hoverIndex = idx;
      chart.data.datasets[0].backgroundColor = barColors();
      chart.update("none");
    }
    function openCompany(idx) {
      if (idx == null || idx < 0 || idx >= ROWS.length) return;
      var href = ROWS[idx].detail_url;
      if (!href) return;
      window.location.href = href;
    }

    function tickLabel(idx) {
      var s = labels[idx] || "";
      return (view.trunc && s.length > view.trunc) ? s.slice(0, view.trunc - 1) + "\u2026" : s;
    }
    var underlinePlugin = {
      id: "z47NameUnderline",
      afterDraw: function (c) {
        if (hoverIndex == null || hoverIndex < 0) return;
        var yScale = c.scales.y;
        if (!yScale) return;
        var text = tickLabel(hoverIndex);
        var ctx = c.ctx;
        var weight = "700";
        ctx.save();
        ctx.font = weight + " " + view.size + "px " + NAME_FONT;
        var tw = ctx.measureText(text).width;
        var y = yScale.getPixelForTick(hoverIndex);
        // y-axis labels sit just left of the plot, right-aligned
        var xEnd = c.chartArea.left - 8;
        var xStart = xEnd - tw;
        ctx.strokeStyle = NAME_COLOR;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(xStart, y + view.size * 0.45);
        ctx.lineTo(xEnd, y + view.size * 0.45);
        ctx.stroke();
        ctx.restore();
      }
    };
    var unavailablePlugin = {
        id: "z47-unavailable-returns",
        afterDatasetsDraw: function (ch) {
          var ctx = ch.ctx;
          ctx.save(); ctx.fillStyle = "#707070";
          ctx.font = view.size + "px sans-serif"; ctx.textBaseline = "middle";
          ROWS.forEach(function (row, i) {
            if (row.ret_1m == null) ctx.fillText("N/A", ch.scales.x.getPixelForValue(0) + 6, ch.scales.y.getPixelForValue(i));
          });
          ctx.restore();
        }
    };

    var chart = new Chart(cv, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: vals,
          backgroundColor: barColors(),
          borderRadius: 2,
          maxBarThickness: view.bar
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", axis: "y", intersect: false },
        onHover: function (e, els) {
          var idx = els.length ? els[0].index : null;
          if (e && e.native && e.native.target) {
            e.native.target.style.cursor = idx == null ? "default" : "pointer";
          }
          setFocus(idx);
        },
        onClick: function (_e, els) {
          if (els && els.length) openCompany(els[0].index);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (it) { return it[0].label; },
              label: function (it) {
                var v = it.parsed.x;
                if (v == null || !isFinite(v)) return "N/A — insufficient trading history";
                return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
              }
            }
          }
        },
        scales: {
          x: {
            position: "top",
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              maxTicksLimit: view.xTicks || undefined,
              callback: function (v) { return v + "%"; }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              font: function (ctx) {
                return {
                  family: NAME_FONT,
                  size: view.size,
                  weight: ctx.index === hoverIndex ? "700" : "400"
                };
              },
              color: function (ctx) {
                return (hoverIndex == null || ctx.index === hoverIndex) ? NAME_COLOR : NAME_DIM;
              },
              callback: function (val, idx) { return tickLabel(idx); }
            }
          }
        }
      },
      plugins: [underlinePlugin, unavailablePlugin]
    });

    // Click on y-axis label area (left of bars) — Chart.js onClick often misses labels
    cv.addEventListener("click", function (e) {
      var rect = cv.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var area = chart.chartArea;
      if (!area) return;
      // Left of plot (name column) OR on a bar
      var els = chart.getElementsAtEventForMode(e, "index", { axis: "y", intersect: false }, true);
      if (els && els.length) {
        openCompany(els[0].index);
        return;
      }
      if (x < area.left) {
        var scale = chart.scales.y;
        if (!scale) return;
        var idx = Math.round(scale.getValueForPixel(y));
        openCompany(idx);
      }
    });

    cv.addEventListener("mouseleave", function () { setFocus(null); });

    function applyResponsive() {
      view = metrics();
      cv.parentNode.style.height = (ROWS.length * view.rowH + 56) + "px";
      chart.data.datasets[0].maxBarThickness = view.bar;
      chart.options.scales.x.ticks.maxTicksLimit = view.xTicks || undefined;
      chart.resize();
      chart.update("none");
    }
    window.addEventListener("resize", applyResponsive);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) applyResponsive(); });
      }).observe(cv);
    }
  }

  function start() {
    ready(function () {
      whenFonts(function () {
        fetch(FEED_URL, { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (d) { draw(fromFeed(d)); })
          .catch(function (err) {
            console.warn("[z47] one-month bars feed failed", err);
          });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
