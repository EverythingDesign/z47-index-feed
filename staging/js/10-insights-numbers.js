/* Review-only monthly index figures. Editorial company/fundamental claims are separate. */
(function () {
  'use strict';
  var url = window.Z47_MONTHLY_URL;
  function pct(value, digits) { return (value >= 0 ? '+' : '') + value.toFixed(digits == null ? 1 : digits) + '%'; }
  function write(node, text) { if (node) { node.textContent = text; node.setAttribute('data-z47-value-state','ready'); } }
  function paragraph(node, text) { write(node.querySelector('p') || node,text); }
  function resetTexts(panel) {
    return Array.from(panel.querySelectorAll('.index-performance-pointers .pointer-text')).filter(function (node) {
      return /^Z47\^fortyseven (is|returned) /i.test(node.textContent.trim()) || /^The cohort (moved|gained|fell|returned)/i.test(node.textContent.trim());
    });
  }
  function fail() {
    document.querySelectorAll('[data-insights-month]').forEach(function (panel) {
      panel.querySelectorAll('.index-performance-wrapper .heading-style-h5.is-48').forEach(function (node) { write(node,'—'); });
      resetTexts(panel).forEach(function (node) { paragraph(node,'Reviewed index figures are temporarily unavailable.'); });
    });
    document.documentElement.setAttribute('data-z47-monthly-state','error');
  }
  function apply(rows) {
    document.querySelectorAll('[data-insights-month]').forEach(function (panel) {
      var row = rows.find(function (r) { return r.month === panel.getAttribute('data-insights-month'); });
      if (!row) throw new Error('Missing reviewed month '+panel.getAttribute('data-insights-month'));
      ['z47_since_base_pct','nifty_since_base_pct','z47_month_return_pct','nifty_month_return_pct','excess_return_pp'].forEach(function (key) {
        if (!Number.isFinite(row[key])) throw new Error('Invalid monthly value '+key);
      });
      var cards=panel.querySelectorAll('.index-performance-wrapper .index-performance-cards');
      if (cards.length!==2) throw new Error('Monthly card structure changed');
      // Fixed month names: en-GB renders September as "Sept"; the page uses "Sep".
      var ymd=row.end_price_date.split('-');
      var dateLabel=Number(ymd[2])+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(ymd[1])-1]+' '+ymd[0];
      [row.z47_since_base_pct,row.nifty_since_base_pct].forEach(function (v,i) {
        var number=cards[i].querySelector('.heading-style-h5.is-48');
        if (!number) throw new Error('Missing monthly value binding');
        write(number,pct(v));number.style.color=v>=0?'#249200':'#D31F03';
        // The NIFTY card also has a bold "NIFTY 500" label; only rewrite the date line.
        write(cards[i].querySelector('.text-size-small:not(.text-weight-bold)'),'Since Jan 2024 · As of '+dateLabel);
      });
      var spread=row.z47_since_base_pct-row.nifty_since_base_pct;
      var cumulative='Z47^fortyseven returned '+pct(row.z47_since_base_pct)+' since its January 2024 base date, versus Nifty 500\'s '+pct(row.nifty_since_base_pct)+', '+(spread>=0?'ahead':'behind')+' by '+Math.round(Math.abs(spread)*100).toLocaleString('en-IN')+' bps.';
      var monthly='The cohort returned '+pct(row.z47_month_return_pct,2)+' over the month versus Nifty 500\'s '+pct(row.nifty_month_return_pct,2)+', '+(row.excess_return_pp>=0?'outperforming':'underperforming')+' by '+Math.round(Math.abs(row.excess_return_pp)*100).toLocaleString('en-IN')+' bps (previous month-end close to '+dateLabel+').';
      var seenMonthly=false;
      resetTexts(panel).forEach(function (node) {
        if (/^Z47\^fortyseven/i.test(node.textContent.trim())) paragraph(node,cumulative);
        else if (!seenMonthly) { paragraph(node,monthly);seenMonthly=true; }
        else { var duplicate=node.closest('.disclaimer-pointer'); if (duplicate) duplicate.style.display='none'; }
      });
    });
    document.documentElement.setAttribute('data-z47-monthly-state','ready');
  }
  function init() {
    if (!url) { fail();return; }
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},15000);
    fetch(url,{cache:'no-store',signal:controller.signal}).then(function (r) {
      if (!r.ok) throw new Error('HTTP '+r.status);return r.json();
    }).then(function (rows) {
      if (!Array.isArray(rows)) throw new Error('Invalid monthly dataset');apply(rows);
    }).catch(function (error) { console.error('[z47] Monthly figures unavailable:',error);fail(); })
      .finally(function(){clearTimeout(timer);});
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);else init();
})();
