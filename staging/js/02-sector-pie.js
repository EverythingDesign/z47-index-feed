
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  // ── Figma colours (edit here) ─────────────────────────────────────────────
  var DEEP = { "Consumer / Consumer Tech":"#6B3410", "Fintech / Financial Services":"#103B33", "SaaS / AI":"#5E1A50", "B2B":"#12295C" };
  var LINE_COLOR = "#9B7B4E";          // leader-line tint
  var PCT_FONT   = "Kodemono, ui-monospace, Menlo, monospace";
  var PCT_SIZE   = 19;                 // % label size (≈1.2× the old 16px)
  var CUTOUT     = "58%";
  // Short legend names + which side each sector sits on (matches Figma)
  var DISP  = { "Consumer / Consumer Tech":"Consumer Tech", "Fintech / Financial Services":"Fintech", "SaaS / AI":"SaaS/AI", "B2B":"B2B" };
  var LEFT  = ["Consumer / Consumer Tech", "Fintech / Financial Services"];
  var RIGHT = ["B2B", "SaaS / AI"];
  // Arc order clockwise from top (Consumer centred at top)
  var ORDER = ["Consumer / Consumer Tech", "B2B", "SaaS / AI", "Fintech / Financial Services"];
  var FALLBACK = [{"name":"Consumer / Consumer Tech","count":19,"weight_pct":58.0},{"name":"Fintech / Financial Services","count":13,"weight_pct":29.6},{"name":"SaaS / AI","count":9,"weight_pct":6.7},{"name":"B2B","count":6,"weight_pct":5.7}];

  function ready(cb){ if (window.Chart) return cb(); var s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"; s.onload=cb; (document.head||document.body).appendChild(s); }
  function whenFonts(cb){ if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb); else cb(); }
  function fromFeed(d){ return (d.sectors || []).map(function (s){ return { name:s.name, count:s.count, weight_pct:s.weight_pct }; }); }

  // Legend is built from the chart's ACTUAL datapoints, so each square's colour is the
  // exact arc fill it points to — no more mismapping. Called once the donut has drawn.
  function buildLegend(chart, ord, vals){
    var ds = chart.data.datasets[0];
    var colorOf = {}, countOf = {};
    ord.forEach(function (n, i){
      colorOf[n] = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
      countOf[n] = vals[i];
    });
    function item(name, side){
      if (!(name in colorOf)) return "";
      var c = colorOf[name], disp = DISP[name] || name, cnt = countOf[name];
      var content = '<div class="z47-leg-text">'
        + '<div class="z47-leg-count"><span class="z47-sq" style="background:' + c + '"></span>'
        + '<span class="z47-leg-num" style="color:' + c + '">' + cnt + ' COMPANIES</span></div>'
        + '<div class="z47-leg-name">' + disp + '</div></div>';
      var line = '<span class="z47-leg-line" style="background:' + LINE_COLOR + '"></span>';
      // line always sits on the INNER side (toward the donut): after content on the
      // left column, before it on the right. Content stays left-aligned on both.
      return '<div class="z47-leg z47-leg--' + side + '">' + (side === "left" ? content + line : line + content) + '</div>';
    }
    var L = document.querySelector(".z47-secL"), R = document.querySelector(".z47-secR");
    if (L) L.innerHTML = item(LEFT[0], "left")  + item(LEFT[1], "left");
    if (R) R.innerHTML = item(RIGHT[0], "right") + item(RIGHT[1], "right");
    var wrap = document.querySelector(".z47-sec-wrap");
    if (wrap) wrap.classList.add("z47-ready");   // fade the legend in
  }

  // Fade the % labels in after the sweep finishes, rather than having them on from frame 1.
  function fadeLabelsIn(chart){
    var DURATION = 200, t0 = null;
    chart.$labelsReady = true;
    function step(ts){
      if (t0 === null) t0 = ts;
      chart.$labelAlpha = Math.min(1, (ts - t0) / DURATION);
      chart.draw();
      if (chart.$labelAlpha < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function draw(SECTORS){
    var cv = document.getElementById("z47-sector-donut");
    if (!cv || !window.Chart || !SECTORS.length) return null;
    var prev = window.Chart.getChart ? window.Chart.getChart(cv) : null;
    if (prev) prev.destroy();
    var byName = {}; SECTORS.forEach(function (s){ byName[s.name] = s; });

    var ord    = ORDER.filter(function (n){ return byName[n]; });
    var vals   = ord.map(function (n){ return byName[n].count; });
    var fills  = ord.map(function (n){ return DEEP[n] || "#999"; });
    var total  = vals.reduce(function (a, v){ return a + v; }, 0) || 1;
    var pcts   = vals.map(function (v){ return v / total * 100; });
    // Chart.js v4 uses radians. Start at 12 o'clock, then centre first arc at top.
    var rotation = -Math.PI / 2 - Math.PI * (vals[0] / total);

    // % labels held back until chart.$labelsReady, then faded via chart.$labelAlpha
    var pctLabels = { id:"z47pct", afterDatasetsDraw:function (c){
      if (!c.$labelsReady) return;
      var ctx = c.ctx, meta = c.getDatasetMeta(0);
      ctx.save();
      ctx.globalAlpha = (c.$labelAlpha == null ? 1 : c.$labelAlpha);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "600 " + PCT_SIZE + "px " + PCT_FONT; ctx.fillStyle = "#FFFFFF";
      meta.data.forEach(function (arc, i){
        var p = arc.getProps(["x","y","startAngle","endAngle","innerRadius","outerRadius"], true);
        var mid = (p.startAngle + p.endAngle) / 2, r = (p.innerRadius + p.outerRadius) / 2;
        ctx.fillText(pcts[i].toFixed(1) + "%", p.x + Math.cos(mid) * r, p.y + Math.sin(mid) * r);
      });
      ctx.restore();
    }};

    var chart = new Chart(cv, {
      type:"doughnut",
      data:{ labels:ord.map(function (n){ return DISP[n] || n; }),
             datasets:[{ data:vals, backgroundColor:fills, borderColor:"#FFFFFF", borderWidth:2, hoverOffset:6 }] },
      options:{ responsive:true, maintainAspectRatio:true, cutout:CUTOUT, rotation:rotation,
        animation:{ animateRotate:true, animateScale:false, duration:650, easing:"easeOutCirc",
          onComplete:function (){
            if (chart.$revealed) return;   // run the reveal once, not on every resize
            chart.$revealed = true;
            buildLegend(chart, ord, vals);
            fadeLabelsIn(chart);
          } },
        plugins:{
          legend:{ display:false },
          tooltip:{ callbacks:{ label:function (it){ var s = byName[ord[it.dataIndex]]; return (DISP[ord[it.dataIndex]] || s.name) + ": " + s.count + " cos \u00b7 " + pcts[it.dataIndex].toFixed(1) + "%"; } } }
        }
      },
      plugins:[pctLabels]
    });
    return chart;
  }

  // Build the donut only once its canvas is actually on-screen with a real width, so the
  // first paint is full-size and the only motion is the clockwise sweep — no grow-from-corner.
  var pending = null, made = false, theChart = null;
  function tryCreate(){
    if (made || !pending) return;
    var cv = document.getElementById("z47-sector-donut");
    if (!cv || cv.clientWidth === 0) return;   // still inside a hidden tab pane
    made = true;
    theChart = draw(pending);
  }
  function watch(){
    var cv = document.getElementById("z47-sector-donut");
    if (cv && "IntersectionObserver" in window){
      new IntersectionObserver(function (es){
        es.forEach(function (e){ if (e.isIntersecting){ tryCreate(); if (theChart) theChart.resize(); } });
      }).observe(cv);
    }
    tryCreate();   // already visible on load?
  }

  function start(){ ready(function (){ whenFonts(function (){
    fetch(FEED_URL).then(function (r){ if (!r.ok) throw 0; return r.json(); })
      .then(function (d){ pending = fromFeed(d); watch(); })
      .catch(function (){ pending = FALLBACK; watch(); });
  }); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
