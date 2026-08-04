
(function () {
  "use strict";
  var FEED_URL = "https://raw.githubusercontent.com/EverythingDesign/z47-index-feed/main/z47_index.json";
  var UP = "ai-color-parrotgreen", DOWN = "ai-color-red";
  var POS_COLOR = "#249200", NEG_COLOR = "#D31F03";   // exact green/red
  var FALLBACK = [{"name":"Eternal (Zomato)","ticker":"ETERNAL","sector":"Consumer / Consumer Tech","price":264.6,"ccy":"INR","daily_pct":2.08,"ret_1m":6.65,"mcap_mn":2432703.9},{"name":"Groww","ticker":"GROWW","sector":"Fintech / Financial Services","price":202.07,"ccy":"INR","daily_pct":-0.14,"ret_1m":8.81,"mcap_mn":1251131.9},{"name":"Lenskart","ticker":"LENSKART","sector":"Consumer / Consumer Tech","price":514.95,"ccy":"INR","daily_pct":1.97,"ret_1m":-0.77,"mcap_mn":891605.1},{"name":"Nykaa","ticker":"NYKAA","sector":"Consumer / Consumer Tech","price":310.85,"ccy":"INR","daily_pct":2.91,"ret_1m":16.55,"mcap_mn":890219.7},{"name":"Meesho","ticker":"MEESHO","sector":"Consumer / Consumer Tech","price":192.4,"ccy":"INR","daily_pct":-0.88,"ret_1m":6.85,"mcap_mn":886706.3},{"name":"PolicyBazaar","ticker":"POLICYBZR","sector":"Fintech / Financial Services","price":1628.6,"ccy":"INR","daily_pct":0.06,"ret_1m":-2.56,"mcap_mn":752481.6},{"name":"Paytm","ticker":"PAYTM","sector":"Fintech / Financial Services","price":1141.5,"ccy":"INR","daily_pct":0.75,"ret_1m":4.25,"mcap_mn":730944.7},{"name":"Info Edge (Naukri)","ticker":"NAUKRI","sector":"Consumer / Consumer Tech","price":978.0,"ccy":"INR","daily_pct":-0.89,"ret_1m":-2.59,"mcap_mn":633487.2},{"name":"Swiggy","ticker":"SWIGGY","sector":"Consumer / Consumer Tech","price":239.35,"ccy":"INR","daily_pct":0.19,"ret_1m":-4.16,"mcap_mn":623759.2},{"name":"SBI Cards","ticker":"SBICARD","sector":"Fintech / Financial Services","price":593.2,"ccy":"INR","daily_pct":-1.45,"ret_1m":-3.69,"mcap_mn":564497.7},{"name":"MakeMyTrip","ticker":"MMYT","sector":"Consumer / Consumer Tech","price":53.97,"ccy":"USD","daily_pct":0.15,"ret_1m":14.05,"mcap_mn":484606.3},{"name":"Ather Energy","ticker":"ATHERENERG","sector":"Consumer / Consumer Tech","price":1140.55,"ccy":"INR","daily_pct":5.12,"ret_1m":21.67,"mcap_mn":436968.6},{"name":"PhysicsWallah","ticker":"PWL","sector":"Consumer / Consumer Tech","price":124.13,"ccy":"INR","daily_pct":0.36,"ret_1m":22.59,"mcap_mn":354973.6},{"name":"Delhivery","ticker":"DELHIVERY","sector":"B2B","price":472.05,"ccy":"INR","daily_pct":1.42,"ret_1m":7.96,"mcap_mn":353493.8},{"name":"Angel One","ticker":"ANGELONE","sector":"Fintech / Financial Services","price":330.65,"ccy":"INR","daily_pct":0.38,"ret_1m":-1.47,"mcap_mn":301999.0},{"name":"Go Digit Insurance","ticker":"GODIGIT","sector":"Fintech / Financial Services","price":322.75,"ccy":"INR","daily_pct":0.94,"ret_1m":6.61,"mcap_mn":298313.7},{"name":"Freshworks","ticker":"FRSH","sector":"SaaS / AI","price":10.14,"ccy":"USD","daily_pct":-0.15,"ret_1m":-5.1,"mcap_mn":265177.2},{"name":"Affle (Affle 3i)","ticker":"AFFLE","sector":"SaaS / AI","price":1419.5,"ccy":"INR","daily_pct":1.43,"ret_1m":-1.39,"mcap_mn":199639.4},{"name":"Ola Electric","ticker":"OLAELEC","sector":"Consumer / Consumer Tech","price":43.76,"ccy":"INR","daily_pct":8.45,"ret_1m":10.7,"mcap_mn":193361.5},{"name":"Urban Company","ticker":"URBANCO","sector":"Consumer / Consumer Tech","price":131.33,"ccy":"INR","daily_pct":-0.3,"ret_1m":9.44,"mcap_mn":192028.2},{"name":"Pine Labs","ticker":"PINELABS","sector":"Fintech / Financial Services","price":156.76,"ccy":"INR","daily_pct":-0.83,"ret_1m":8.97,"mcap_mn":180878.8},{"name":"TBO Tek","ticker":"TBOTEK","sector":"B2B","price":1429.7,"ccy":"INR","daily_pct":-0.71,"ret_1m":16.3,"mcap_mn":152669.1},{"name":"Fractal Analytics","ticker":"FRACTAL","sector":"SaaS / AI","price":887.2,"ccy":"INR","daily_pct":-0.65,"ret_1m":-9.81,"mcap_mn":152567.4},{"name":"Honasa (Mamaearth)","ticker":"HONASA","sector":"Consumer / Consumer Tech","price":457.9,"ccy":"INR","daily_pct":3.17,"ret_1m":13.67,"mcap_mn":149286.5},{"name":"Five-Star Business Finance","ticker":"FIVESTAR","sector":"Fintech / Financial Services","price":505.1,"ccy":"INR","daily_pct":3.78,"ret_1m":13.19,"mcap_mn":149095.3},{"name":"Aptus Value Housing","ticker":"APTUS","sector":"Fintech / Financial Services","price":278.85,"ccy":"INR","daily_pct":4.69,"ret_1m":7.21,"mcap_mn":139646.1},{"name":"Shadowfax","ticker":"SHADOWFAX","sector":"B2B","price":226.19,"ccy":"INR","daily_pct":-0.09,"ret_1m":18.28,"mcap_mn":132340.3},{"name":"CarTrade","ticker":"CARTRADE","sector":"Consumer / Consumer Tech","price":2693.0,"ccy":"INR","daily_pct":1.29,"ret_1m":51.97,"mcap_mn":129326.0},{"name":"Amagi Media Labs","ticker":"AMAGI","sector":"SaaS / AI","price":560.55,"ccy":"INR","daily_pct":1.55,"ret_1m":37.02,"mcap_mn":121268.8},{"name":"IndiaMart","ticker":"INDIAMART","sector":"B2B","price":1906.4,"ccy":"INR","daily_pct":-0.45,"ret_1m":-3.86,"mcap_mn":114648.3},{"name":"Nazara Technologies","ticker":"NAZARA","sector":"Consumer / Consumer Tech","price":303.1,"ccy":"INR","daily_pct":-0.07,"ret_1m":11.21,"mcap_mn":112287.9},{"name":"FirstCry","ticker":"FIRSTCRY","sector":"Consumer / Consumer Tech","price":223.29,"ccy":"INR","daily_pct":0.58,"ret_1m":-0.02,"mcap_mn":108375.9},{"name":"RateGain","ticker":"RATEGAIN","sector":"SaaS / AI","price":899.15,"ccy":"INR","daily_pct":4.02,"ret_1m":15.7,"mcap_mn":106421.5},{"name":"MedPlus Health","ticker":"MEDPLUS","sector":"Consumer / Consumer Tech","price":810.75,"ccy":"INR","daily_pct":1.36,"ret_1m":-7.31,"mcap_mn":97359.6},{"name":"BlackBuck","ticker":"BLACKBUCK","sector":"B2B","price":530.8,"ccy":"INR","daily_pct":-2.25,"ret_1m":3.37,"mcap_mn":96679.2},{"name":"Ixigo","ticker":"IXIGO","sector":"Consumer / Consumer Tech","price":196.65,"ccy":"INR","daily_pct":1.59,"ret_1m":20.83,"mcap_mn":86264.3},{"name":"BlueStone","ticker":"BLUESTONE","sector":"Consumer / Consumer Tech","price":545.85,"ccy":"INR","daily_pct":1.27,"ret_1m":10.03,"mcap_mn":83188.5},{"name":"E2E Networks","ticker":"E2E","sector":"SaaS / AI","price":396.3,"ccy":"INR","daily_pct":0.48,"ret_1m":-3.78,"mcap_mn":81396.2},{"name":"Kissht (OnEMI Technology)","ticker":"KISSHT","sector":"Fintech / Financial Services","price":279.5,"ccy":"INR","daily_pct":1.93,"ret_1m":6.8,"mcap_mn":47091.0},{"name":"MapmyIndia","ticker":"MAPMYINDIA","sector":"SaaS / AI","price":809.75,"ccy":"INR","daily_pct":-1.23,"ret_1m":-3.66,"mcap_mn":44342.8},{"name":"Aye Finance","ticker":"AYE","sector":"Fintech / Financial Services","price":173.7,"ccy":"INR","daily_pct":-1.64,"ret_1m":16.55,"mcap_mn":42469.5},{"name":"Wakefit","ticker":"WAKEFIT","sector":"Consumer / Consumer Tech","price":123.63,"ccy":"INR","daily_pct":1.36,"ret_1m":2.38,"mcap_mn":40962.5},{"name":"Capillary Technologies","ticker":"CAPILLARY","sector":"SaaS / AI","price":513.4,"ccy":"INR","daily_pct":0.79,"ret_1m":0.64,"mcap_mn":40800.9},{"name":"Medi Assist","ticker":"MEDIASSIST","sector":"Fintech / Financial Services","price":365.55,"ccy":"INR","daily_pct":0.81,"ret_1m":-0.54,"mcap_mn":27307.3},{"name":"Awfis Space Solutions","ticker":"AWFIS","sector":"B2B","price":302.4,"ccy":"INR","daily_pct":2.75,"ret_1m":-4.98,"mcap_mn":21640.7},{"name":"MobiKwik","ticker":"MOBIKWIK","sector":"Fintech / Financial Services","price":199.85,"ccy":"INR","daily_pct":-0.22,"ret_1m":2.92,"mcap_mn":15737.6},{"name":"Unicommerce","ticker":"UNIECOM","sector":"SaaS / AI","price":87.62,"ccy":"INR","daily_pct":0.19,"ret_1m":2.49,"mcap_mn":9846.7}];
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function byKey(k)   { return $all('[data-z47="' + k + '"]'); }
  function fmtNum(n, d) { return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function fmtPct(n)  { return (n >= 0 ? "+" : "") + Number(n).toFixed(1) + "%"; }
  function sign(n)    { return n >= 0 ? UP : DOWN; }
  function colorFor(n){ return (typeof n === "number" && isFinite(n)) ? (n >= 0 ? POS_COLOR : NEG_COLOR) : ""; }
  function fromFeed(d) {
    return (d.constituents || []).slice()
      .map(function (c) {
        return {
          name:c.name, sector:c.sector, price:c.price, ccy:c.ccy,
          daily_pct:c.daily_pct, ret_1m:c.ret_1m, mcap_mn:c.mcap_mn,
          mcap_cr:c.mcap_cr, mcap_usd_mn:c.mcap_usd_mn,
          slug:c.slug, detail_url:c.detail_url || ("/z47-forty-seven/company/" + (c.slug || (c.ticker || "").toLowerCase()))
        };
      })
      .sort(function (a, b) { return (b.mcap_mn || 0) - (a.mcap_mn || 0); });
  }
  function setNameLink(el, c) {
    el.textContent = "";
    var a = document.createElement("a");
    a.href = c.detail_url;
    a.textContent = c.name;
    a.target = "_blank";
    a.rel = "noopener";
    a.style.color = "inherit";
    a.style.textDecoration = "underline";
    a.title = "Company page (staging stub until Friday)";
    el.appendChild(a);
  }
  function fmtDualMcap(c) {
    if (c.mcap_cr != null && c.mcap_usd_mn != null) {
      return "\u20B9" + fmtNum(c.mcap_cr, 0) + " Cr / $" + fmtNum(c.mcap_usd_mn, 0) + "M";
    }
    return fmtNum(c.mcap_mn, 0);
  }
  function paint(ROWS) {
    byKey("constituents-body").forEach(function (grid) {
      var tpl = $all(":scope > *", grid).map(function (n) { return n.cloneNode(true); });
      if (!tpl.length) return;
      grid.innerHTML = "";
      ROWS.forEach(function (c) {
        tpl.forEach(function (ct) {
          var cell = ct.cloneNode(true);
          var t = cell.querySelector("[data-z47-cell]");
          if (!t && cell.getAttribute && cell.getAttribute("data-z47-cell")) t = cell;
          if (t) {
            var k = t.getAttribute("data-z47-cell");
            if      (k === "name")   setNameLink(t, c);
            else if (k === "sector") t.textContent = c.sector;
            else if (k === "price")  t.textContent = (c.ccy === "USD" ? "$" : "\u20B9") + fmtNum(c.price, 1);
            else if (k === "day")  { t.classList.remove(UP, DOWN);
                                     if (c.daily_pct == null) { t.textContent = "\u2014"; t.style.color = "#9a9a9a"; }
                                     else { t.textContent = fmtPct(c.daily_pct); t.classList.add(sign(c.daily_pct)); t.style.color = colorFor(c.daily_pct); } }
            else if (k === "ret1m"){ t.textContent = fmtPct(c.ret_1m);    t.classList.remove(UP, DOWN); t.classList.add(sign(c.ret_1m));    t.style.color = colorFor(c.ret_1m); }
            else if (k === "mcap" || k === "mcap_dual") t.textContent = fmtDualMcap(c);
            else if (k === "mcap_mn") t.textContent = fmtNum(c.mcap_mn, 0);
            else if (k === "mcap_cr") t.textContent = fmtNum(c.mcap_cr, 0);
            else if (k === "mcap_usd") t.textContent = fmtNum(c.mcap_usd_mn, 0);
          }
          grid.appendChild(cell);
        });
      });
    });
  }
  function start() {
    fetch(FEED_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { paint(fromFeed(d)); })
      .catch(function () { paint(FALLBACK); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
