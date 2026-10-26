const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('staging/js/01-performance.js', 'utf8');
const elements = new Map();
function el(key, placeholder = '129.1') {
  const attrs = new Map();
  const node = {textContent:placeholder, style:{removeProperty(){}}, classList:{add(){},remove(){}},
    setAttribute(k,v){attrs.set(k,v)}, removeAttribute(k){attrs.delete(k)},
    getAttribute(k){return attrs.get(k)}, hasAttribute(k){return attrs.has(k)}};
  elements.set(key,node); return node;
}
const doc = {getElementById(){return {}}, querySelectorAll(selector){
  const match = selector.match(/^\[data-z47="([^"]+)"\]$/);
  return match ? (elements.has(match[1]) ? [elements.get(match[1])] : []) : [...elements.values()];
}, readyState:'loading', addEventListener(){}};
const events = {}, timers = [];
const window = {addEventListener(n,f){events[n]=f},dispatchEvent(){}};
const context = {document:doc, window, console, setTimeout(f){timers.push(f);return timers.length},clearTimeout(){}};
vm.createContext(context);
const marker = '  if (document.readyState === "loading")';
vm.runInContext(source.slice(0,source.lastIndexOf(marker)) + 'window.testValues={setText,setPct,setPctPlain,fmtNum};})();', context);
const api = window.testValues;
const value = el('card-z47-value');
assert.equal(value.getAttribute('data-z47-value-state'),undefined,'Designer placeholder must start masked');
api.setText('card-z47-value',api.fmtNum(128.456,1));
assert.equal(value.textContent,'128.5');assert.equal(value.getAttribute('data-z47-value-state'),'ready');
for (const invalid of [null,undefined,NaN,Infinity]) {
  el('ret-z47-1M','+3.0%');api.setPct('ret-z47-1M',invalid);
  assert.equal(elements.get('ret-z47-1M').textContent,'—');
  assert.equal(elements.get('ret-z47-1M').getAttribute('data-z47-value-state'),'unavailable');
}
api.setPct('ret-z47-1M',0);assert.equal(elements.get('ret-z47-1M').textContent,'+0.0%');
el('card-fx-value');el('ret-nifty-1M','+3.0%');
doc.readyState='complete';
vm.runInContext(fs.readFileSync('staging/js/00-numeric-loading.js','utf8'),context);
events['z47:performance-state']({detail:'error'});
assert.equal(elements.get('card-fx-value').textContent,'—');
assert.equal(elements.get('ret-nifty-1M').textContent,'—');
assert.equal(value.textContent,'128.5','A chart failure must not erase already validated numeric data');
el('card-fx-time','18:52');timers.at(-1)();
assert.equal(elements.get('card-fx-time').textContent,'—','Missing performance script times out safely');
console.log('PASS numeric loading: placeholders masked, zero retained, missing/invalid values and failures show unavailable.');
