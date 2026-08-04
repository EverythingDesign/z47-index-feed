
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  var GAIN = "#FF6800", LOSS = "#707070";            // gainers / laggards
  var GAIN_FADE = "rgba(255,104,0,0.22)", LOSS_FADE = "rgba(112,112,112,0.22)"; // dimmed (focus state)
  var NAME_FONT = '"NN Swinton", Georgia, serif';    // company-name labels (NN Swinton)
  var NAME_SIZE = 18, NAME_COLOR = "#000";           // black labels
  var NAME_DIM  = "rgba(0,0,0,0.30)";                // label dims when another row is focused
  var ROW_H = 26;                                     // px per company row
  var FALLBACK = [{"name":"CarTrade","ret_1m":49.65},{"name":"Amagi Media Labs","ret_1m":32.49},{"name":"PhysicsWallah","ret_1m":20.32},{"name":"Aye Finance","ret_1m":18.7},{"name":"TBO Tek","ret_1m":16.94},{"name":"Shadowfax","ret_1m":16.01},{"name":"Ixigo","ret_1m":15.88},{"name":"Nykaa","ret_1m":13.44},{"name":"MakeMyTrip","ret_1m":12.81},{"name":"Nazara Technologies","ret_1m":11.41},{"name":"Pine Labs","ret_1m":10.5},{"name":"Ather Energy","ret_1m":9.93},{"name":"BlackBuck","ret_1m":9.67},{"name":"RateGain","ret_1m":9.34},{"name":"Urban Company","ret_1m":8.79},{"name":"Five-Star Business Finance","ret_1m":8.36},{"name":"Honasa (Mamaearth)","ret_1m":7.58},{"name":"Groww","ret_1m":7.38},{"name":"Delhivery","ret_1m":7.24},{"name":"BlueStone","ret_1m":7.04},{"name":"Meesho","ret_1m":5.6},{"name":"Go Digit Insurance","ret_1m":5.37},{"name":"Eternal (Zomato)","ret_1m":4.49},{"name":"Aptus Value Housing","ret_1m":3.4},{"name":"Kissht (OnEMI Technology)","ret_1m":3.25},{"name":"Ola Electric","ret_1m":3.19},{"name":"MobiKwik","ret_1m":3.02},{"name":"Paytm","ret_1m":2.57},{"name":"Unicommerce","ret_1m":2.56},{"name":"MapmyIndia","ret_1m":-0.3},{"name":"Capillary Technologies","ret_1m":-0.47},{"name":"FirstCry","ret_1m":-0.6},{"name":"Wakefit","ret_1m":-0.79},{"name":"Medi Assist","ret_1m":-0.98},{"name":"Angel One","ret_1m":-1.36},{"name":"SBI Cards","ret_1m":-1.41},{"name":"Info Edge (Naukri)","ret_1m":-1.43},{"name":"PolicyBazaar","ret_1m":-1.88},{"name":"Affle (Affle 3i)","ret_1m":-2.16},{"name":"Lenskart","ret_1m":-2.46},{"name":"IndiaMart","ret_1m":-3.3},{"name":"E2E Networks","ret_1m":-3.82},{"name":"Swiggy","ret_1m":-4.4},{"name":"MedPlus Health","ret_1m":-6.98},{"name":"Awfis Space Solutions","ret_1m":-7.31},{"name":"Freshworks","ret_1m":-7.77},{"name":"Fractal Analytics","ret_1m":-9.42}];
  function ready(cb){ if (window.Chart) return cb(); var s=document.createElement("script"); s.src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"; s.onload=cb; (document.head||document.body).appendChild(s); }
  function whenFonts(cb){
    if (!(document.fonts && document.fonts.ready)) return cb();
    // canvas text does NOT trigger @font-face loading â request NN Swinton explicitly, then draw
    var p = document.fonts.load ? document.fonts.load('18px "NN Swinton"').catch(function (){}) : Promise.resolve();
    p.then(function (){ return document.fonts.ready; }).then(cb);
  }
  function fromFeed(d){
    return (d.constituents || []).slice()
      .sort(function (a, b){ return (b.ret_1m || 0) - (a.ret_1m || 0); })
      .map(function (c){ return { name:c.name, ret_1m:c.ret_1m }; });
  }
  // responsive sizing by viewport: { label size, row height, bar thickness, truncate-at (0=off), x-axis tick cap (0=auto) }
  function metrics(){
    var w = window.innerWidth || 1024;
    if (w < 480) return { size: 11, rowH: 19, bar: 11, trunc: 16, xTicks: 6 };   // phones
    if (w < 768) return { size: 13, rowH: 22, bar: 14, trunc: 24, xTicks: 8 };   // small tablets
    return { size: NAME_SIZE, rowH: ROW_H, bar: 18, trunc: 0, xTicks: 0 };       // desktop (full)
  }
  function draw(ROWS){
    var cv = document.getElementById("z47-movement-bars");
    if (!cv || !window.Chart || !ROWS.length) return;
    var view = metrics();
    cv.parentNode.style.height = (ROWS.length * view.rowH + 56) + "px";   // fit all rows
    var labels = ROWS.map(function (r){ return r.name; });
    var vals   = ROWS.map(function (r){ return r.ret_1m; });
    var hoverIndex = null;                              // currently focused row (null = none)
    function barColors(){
      return vals.map(function (v, i){
        var full = v >= 0 ? GAIN : LOSS, fade = v >= 0 ? GAIN_FADE : LOSS_FADE;
        return (hoverIndex == null || i === hoverIndex) ? full : fade;
      });
    }
    function setFocus(idx){
      if (idx === hoverIndex) return;                  // nothing changed -> skip redraw
      hoverIndex = idx;
      chart.data.datasets[0].backgroundColor = barColors();
      chart.update("none");                            // re-tint bars + re-evaluate label font/colour
    }
    var chart = new Chart(cv, {
      type:"bar",
      data:{ labels:labels, datasets:[{ data:vals, backgroundColor:barColors(), borderRadius:2, maxBarThickness:view.bar }] },
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false,
        // hover anywhere along a row â including the company name on the left â focuses that row
        interaction:{ mode:"index", axis:"y", intersect:false },
        onHover:function (e, els){
          var idx = els.length ? els[0].index : null;
          if (e && e.native && e.native.target) e.native.target.style.cursor = idx == null ? "default" : "pointer";
          setFocus(idx);
        },
        plugins:{
          legend:{ display:false },
          tooltip:{ callbacks:{ title:function (it){ return it[0].label; }, label:function (it){ var v=it.parsed.x; return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; } } }
        },
        scales:{
          x:{ position:"top", grid:{ color:"rgba(0,0,0,0.06)" }, ticks:{ maxTicksLimit:view.xTicks || undefined, callback:function (v){ return v + "%"; } } },
          y:{ grid:{ display:false }, ticks:{ autoSkip:false,
              // #1 hover effect: hovered name goes bold; #3 mobile: smaller font
              font:function (ctx){ return { family:NAME_FONT, size:view.size, weight: ctx.index === hoverIndex ? "700" : "400" }; },
              color:function (ctx){ return (hoverIndex == null || ctx.index === hoverIndex) ? NAME_COLOR : NAME_DIM; },
              // #3 mobile: truncate very long names (full name still shown in the tooltip)
              callback:function (val, idx){ var s = labels[idx] || ""; return (view.trunc && s.length > view.trunc) ? s.slice(0, view.trunc - 1) + "\u2026" : s; } }
        }
      }
    }
    });
    // #2 hover-out -> everything back to active (Chart.js doesn't always fire the empty hover on exit)
    cv.addEventListener("mouseleave", function (){ setFocus(null); });
    // #3 re-apply responsive metrics on resize / when the tab becomes visible
    function applyResponsive(){
      view = metrics();
      cv.parentNode.style.height = (ROWS.length * view.rowH + 56) + "px";
      chart.data.datasets[0].maxBarThickness = view.bar;
      chart.options.scales.x.ticks.maxTicksLimit = view.xTicks || undefined;
      chart.resize(); chart.update("none");
    }
    window.addEventListener("resize", applyResponsive);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es){ es.forEach(function (e){ if (e.isIntersecting) applyResponsive(); }); }).observe(cv);
  }
  function start(){ ready(function(){ whenFonts(function(){
    fetch(FEED_URL).then(function (r){ if (!r.ok) throw 0; return r.json(); })
      .then(function (d){ draw(fromFeed(d)); })
      .catch(function (){ draw(FALLBACK); });
  }); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
