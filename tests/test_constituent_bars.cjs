// Execute the delivered chart script with a minimal browser/Chart harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let config;
const cv = {parentNode:{style:{}},addEventListener(){}};
const document = {readyState:'complete',getElementById:()=>cv};
function Chart(_cv, options) { config=options; this.data=options.data; this.options=options.options; }
const window = {Chart,innerWidth:1280,addEventListener(){},location:{}};
const context = {document,window,Chart,console,fetch:async()=>({ok:true,json:async()=>({constituents:[
  {name:'Rentomojo',ticker:'RENTOMOJO',ret_1m:null},
  {name:'Swiggy',ticker:'SWIGGY',ret_1m:2},
  {name:'FirstCry',ticker:'FIRSTCRY',ret_1m:-3}
]})})};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../staging/js/04-one-month-bars.js'),'utf8'),context);
setImmediate(()=>{
  assert.deepEqual(Array.from(config.data.labels),['Swiggy','FirstCry','Rentomojo']);
  assert.equal(config.data.datasets[0].data[2],null);
  assert.equal(config.plugins.length,2,'Preserve name-hover plugin alongside missing-return label');
  let labels=[];
  const ctx={save(){},restore(){},fillText(text,x,y){labels.push([text,x,y]);}};
  config.plugins.find(x=>x.id==='z47-unavailable-returns').afterDatasetsDraw({ctx,scales:{x:{getPixelForValue:()=>50},y:{getPixelForValue:i=>i*26}}});
  assert.deepEqual(labels,[['N/A',56,52]]);
  config.options.onClick({},[{index:2}]);
  assert.equal(window.location.href,'/z47-forty-seven/rentomojo');
  console.log('Constituent chart: missing-history label, ordering, hover plugin and Rentomojo link passed');
});
