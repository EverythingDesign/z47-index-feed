const fs = require('fs'), vm = require('vm'), assert = require('assert');
const original = fs.readFileSync('staging/js/01-performance.js','utf8');
const hook = `
  companyLookup = function(){return {}};
  paintScalars = renderLegend = paintMovers = paintRetByAttr = renderSparkline = wireToggle = wireTabResize = wirePeriodTabs = function(){};
  renderChart = function(){ if (window.failChart) throw new Error('render failed'); chart = {}; };
`;
const marker = '  if (document.readyState === "loading")';
assert(original.includes(marker));
const code = original.replace(marker, hook + marker);
async function run(failFeed,failChart) {
 const events=[];let painted=false;
 const ctx={console, Chart:function(){}, AbortController, Number, Promise,
   setTimeout,clearTimeout,setInterval(){},CustomEvent:function(type,init){this.type=type;this.detail=init.detail},
   document:{getElementById(){return {}},readyState:'complete'},
   window:{failChart,dispatchEvent(e){events.push(e.detail)}},
   fetch(){return failFeed?Promise.reject(new Error('offline')):Promise.resolve({ok:true,json(){return Promise.resolve({index:{value:134.23},benchmark:{},history:[{}],movers:{gainers:[],losers:[]},constituents:[]})}})}
 };
 vm.runInNewContext(code,ctx);assert.deepEqual(events,[]);
 await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(events,[failFeed||failChart?'error':'ready']);
}
(async()=>{await run(false,false);await run(true,false);await run(false,true);console.log('PASS: actual init emits ready on success and error on fetch/render failures');})().catch(e=>{console.error(e);process.exit(1)});
