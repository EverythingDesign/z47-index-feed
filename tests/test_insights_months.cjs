// Run with jsdom installed: node tests/test_insights_months.cjs [published-page.html]
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const code = fs.readFileSync('staging/js/09-insights-months.js', 'utf8');
const panel = (month, heading = '', cls = '') => `<section class="tab-pane-wrapper ${cls}" ${month === null ? '' : `data-insights-month="${month}"`}><h4>${heading}</h4><p>Fixed monthly data</p></section>`;
function run(content) {
  const dom = new JSDOM(content, { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(code);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}
const wrap = content => `<div class="insights-tab-wrap"><div class="insights-tab-dropdown"></div>${content}</div>`;
const dom = run(panel('2027-01') + wrap(panel('2026-08') + panel(null, 'MONTHLY TAKEAWAY · SEP 2026', 'hide')));
const d = dom.window.document;
const select = d.querySelector('select');
assert.deepEqual(Array.from(select.options, x => x.value), ['2026-09', '2026-08']);
assert.equal(select.value, '2026-09');
const panels = d.querySelectorAll('.insights-tab-wrap .tab-pane-wrapper');
assert.equal(panels[0].hidden, true);
assert.equal(panels[1].hidden, false);
assert.equal(panels[1].classList.contains('hide'), false);
assert.equal(d.querySelector('.tab-pane-wrapper').hidden, false, 'unrelated sections untouched');
select.value = '2026-08';
select.dispatchEvent(new dom.window.Event('change'));
assert.equal(panels[0].hidden, false);
assert.equal(panels[1].hidden, true);
assert.equal(panels[0].textContent, 'Fixed monthly data');
dom.window.eval(code);
d.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
assert.equal(d.querySelectorAll('select').length, 1);
dom.window.close();
for (const content of [panel('2026-13'), panel('2026-09') + panel('2026-09')]) {
  const invalid = run(wrap(content));
  assert.equal(invalid.window.document.querySelector('select'), null);
  assert.equal(invalid.window.document.querySelector('.tab-pane-wrapper').hidden, false);
  invalid.window.close();
}
const years = run(wrap(panel('2026-12') + panel('2027-01', '', 'hide')));
assert.equal(years.window.document.querySelector('select').value, '2027-01');
years.window.close();
const nested = run(wrap('<div class="tab-pane-wrapper">' +
  ['2026-09', '2026-08', '2026-07', '2026-06'].map((key, i) =>
    `<div class="tab-pane-wrap monthly-insights ${i ? 'hide' : ''}" data-insights-month="${key}">${key}</div>`).join('') + '</div>'));
const nd = nested.window.document;
const ns = nd.querySelector('select');
assert.equal(ns.options.length, 4);
for (const option of ns.options) {
  ns.value = option.value;
  ns.dispatchEvent(new nested.window.Event('change'));
  assert.equal(nd.querySelector('.tab-pane-wrapper').hidden, false);
  const visible = Array.from(nd.querySelectorAll('[data-insights-month]')).filter(x => !x.hidden && !x.classList.contains('hide'));
  assert.equal(visible.length, 1);
  assert.equal(visible[0].dataset.insightsMonth, option.value);
}
nested.window.close();
if (process.argv[2]) {
  // Exclude installed scripts so the candidate script is exercised in isolation.
  const published = run(fs.readFileSync(process.argv[2], 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
  const doc = published.window.document;
  const ps = doc.querySelector('.insights-tab-dropdown select');
  assert.equal(ps.value, '2026-09');
  assert.equal(doc.querySelector('.insights-tab-wrap .tab-pane-wrapper').hidden, false);
  const monthly = doc.querySelectorAll('.insights-tab-wrap [data-insights-month]');
  if (monthly.length) {
    assert.equal(ps.options.length, monthly.length);
    for (const option of ps.options) {
      ps.value = option.value;
      ps.dispatchEvent(new published.window.Event('change'));
      const visible = Array.from(monthly).filter(x => !x.hidden && !x.classList.contains('hide'));
      assert.equal(visible.length, 1);
      assert.equal(visible[0].dataset.insightsMonth, option.value);
    }
  }
  published.window.close();
}
console.log('PASS: newest month, switching, hide classes, scope, duplicate init, invalid metadata, year rollover, published markup');
