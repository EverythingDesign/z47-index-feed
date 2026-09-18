const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const style = {textContent:''};
const cmsAbout = {
  textContent:'First paragraph.Second paragraph.',
  querySelectorAll:()=>[{textContent:'First paragraph.'},{textContent:'Second paragraph.'}]
};
const cmsWebsite={getAttribute:()=> 'https://www.rentomojo.com/'};
const document={
  readyState:'loading',addEventListener(){},getElementById:()=>style,
  querySelector:selector=>selector==='[data-z47-cms="about"]'?cmsAbout:selector==='[data-z47-cms="website"]'?cmsWebsite:null
};
const window={};
let source=fs.readFileSync(path.join(__dirname,'../staging/js/04-company-page.js'),'utf8');
source=source.replace('  function start() {','  window.testProfile = {companyWebsite:companyWebsite,websiteLabel:websiteLabel,readCmsFallbacks:readCmsFallbacks,profileValues:profileValues,paintAbout:paintAbout,setLink:setLink,setCms:function(v){cmsFallbacks=v;}};\n  function start() {');
vm.runInNewContext(source,{window,document,URL,console,requestAnimationFrame:fn=>fn()});
const t=window.testProfile;
assert.equal(t.companyWebsite('http://www.google.co.in/search?gfns=1&q=Rentomojo'),null);
assert.equal(t.companyWebsite('javascript:alert(1)'),null);
assert.equal(t.companyWebsite('rentomojo.com'),'https://rentomojo.com/');
assert.equal(t.websiteLabel('https://www.rentomojo.com/'),'rentomojo.com');
assert.equal(t.readCmsFallbacks().about,'First paragraph.\n\nSecond paragraph.');
t.setCms(t.readCmsFallbacks());
assert.equal(t.profileValues({about:null,website:'http://www.google.co.in/search?q=Rentomojo'}).website,'https://www.rentomojo.com/');
assert.equal(t.profileValues({about:'   '}).about,'First paragraph.\n\nSecond paragraph.');
assert.equal(t.profileValues({about:'Source description',website:'https://example.com/'}).about,'Source description');
assert.equal(t.profileValues({website:'https://example.com/'}).website,'https://example.com/');
assert.equal(t.profileValues(null).website,'https://www.rentomojo.com/','CMS remains usable when feed fails');
assert.equal(t.companyWebsite('{{wf unresolved }}'),null);
console.log('CMS fallbacks: missing fields, search-placeholder rejection, source priority, paragraphs, hostname and feed failure passed');

function classes() { const s = new Set(['w-dyn-bind-empty']); return {remove:(...names)=>names.forEach(n=>s.delete(n)),add:(...names)=>names.forEach(n=>s.add(n)),contains:n=>s.has(n)}; }
const aboutNode={classList:classes(),parentNode:null,textContent:''};
const label={classList:classes(),style:{},textContent:''};
const anchor={classList:classes(),style:{},querySelector:()=>label,setAttribute(){},removeAttribute(){}};
document.querySelectorAll=s=>s==='[data-z47-co="about"]'?[aboutNode]:s==='[data-z47-co="link-web"]'?[anchor]:[];
t.paintAbout('Existing source About');
t.setLink('link-web','https://www.turtlemint.com/','turtlemint.com');
assert.equal(aboutNode.classList.contains('w-dyn-bind-empty'),false);
assert.equal(label.classList.contains('w-dyn-bind-empty'),false);
assert.equal(aboutNode.textContent,'Existing source About');
assert.equal(label.textContent,'turtlemint.com');
console.log('Webflow empty CMS bindings no longer hide source About or website labels');
