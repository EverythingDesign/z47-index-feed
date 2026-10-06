// Run with jsdom installed: node tests/test_insights_months.cjs [published-page.html]
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const code = fs.readFileSync('staging/js/09-insights-months.js', 'utf8');
const panel = (month, heading = '', cls = '') => `<section class="tab-pane-wrapper ${cls}" ${month === null ? '' : `data-insights-month="${month}"`}><h4>${heading}</h4><p>Fixed monthly data</p></section>`;
function run(content) {
  const dom = new JSDOM(content, { runScripts: 'outside-only' });
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
if (process.argv[2]) {
  const published = run(fs.readFileSync(process.argv[2], 'utf8'));
  const doc = published.window.document;
  assert.equal(doc.querySelector('.insights-tab-dropdown select').value, '2026-09');
  assert.equal(doc.querySelector('.insights-tab-wrap .tab-pane-wrapper').hidden, false);
  published.window.close();
}
console.log('PASS: newest month, switching, hide classes, scope, duplicate init, invalid metadata, year rollover, published markup');
