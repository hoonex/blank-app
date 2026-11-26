// Flow UI action icon regression checks (Node built-ins only).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=source('index.html');
const entries=[
  ['flow-date-ribbon-v2.js',['calendar','chevron-left','chevron-right']],
  ['flow-meal-select-fast-v1.js',['chevron-left','chevron-right']],
  ['flow-month-events-v1.js',['chevron-right']],
  ['flow-school-shortcuts-v1.js',['external-link']],
  ['flow-bus-nearby-v2.js',['chevron-right','bookmark']],
  ['flow-feature-guide-v1.js',['close','help']]
];
const iconSource=source('flow-icons-handdrawn-v1.js');
const checks=[];
const verify=(label,fn)=>{fn();checks.push(label)};

verify('Shared icon system loads ahead of every dependent feature',()=>{
  const iconLink='flow-icons-handdrawn-v1.js?v=vector-3';
  const anchor=html.indexOf(iconLink);
  assert.ok(anchor>0,'Shared icon provider not linked');
  for(const [name] of entries){
    const pos=html.indexOf(name);
    assert.ok(pos>anchor,name+' loads before shared icon provider');
  }
  assert.ok(iconSource.includes('window.FlowActionIcons=Object.freeze({create:action})'));
});

verify('All active features render action SVG instead of font glyphs',()=>{
  for(const [name,icons] of entries){
    const js=source(name);
    for(const icon of icons)assert.ok(js.includes("FlowActionIcons.create('"+icon+"')"),name+': '+icon);
    assert.doesNotMatch(js,/[‹›⌄↗×]/,name+' contains a glyph-only icon');
  }
});

verify('Icon strokes and accessibility follow the same design system',()=>{
  for(const declaration of ["setAttribute('viewBox','0 0 24 24')","setAttribute('stroke-width','2')","setAttribute('stroke-linecap','round')","setAttribute('stroke-linejoin','round')","setAttribute('aria-hidden','true')"]){
    assert.ok(iconSource.includes(declaration),'Missing icon property: '+declaration);
  }
  assert.ok(iconSource.includes("n.nodeType===Node.TEXT_NODE"),'Settings text node preservation missing');
  assert.ok(iconSource.includes("characterData:true"),'Reactive theme text observation missing');
  assert.ok(source('flow-date-ribbon-v2.js').includes("month.setAttribute('aria-controls','flow-date-picker')"));
});

verify('All actionable date, meal and settings controls reserve at least 44px',()=>{
  const date=source('flow-date-ribbon-v3.css'),meal=source('flow-editorial-refine-v2.css'),settings=source('flow-five-tabs-minimal-v1.css');
  assert.ok((date.match(/min-height:44px/g)||[]).length>=3,'Date controls 44px requirement lost');
  assert.ok(date.includes('width:44px;height:44px'),'Date step 44x44 lost');
  assert.ok(date.includes('grid-template-columns:44px 1fr 44px'),'Picker arrows 44px lost');
  assert.ok(meal.includes('width:44px!important;height:44px!important'),'Meal action 44px lost');
  assert.ok(settings.includes('min-height:var(--flow-target-size)!important'),'Settings hit target lost');
});

verify('Updated assets are cache-busted exactly once',()=>{
  for(const name of ['flow-date-ribbon-v2.js','flow-date-ribbon-v3.css','flow-icons-handdrawn-v1.js','flow-five-tabs-minimal-v1.css','flow-meal-select-fast-v1.js','flow-school-shortcuts-v1.js','flow-month-events-v1.js','flow-bus-nearby-v2.js']){
    const version=['flow-icons-handdrawn-v1.js','flow-school-shortcuts-v1.js','flow-bus-nearby-v2.js'].includes(name)?'3':name==='flow-date-ribbon-v3.css'?'2':'1';
    const match=html.match(new RegExp(name.replace(/[.]/g,'\\.')+'\\?v=vector-'+version,'g'))||[];
    assert.equal(match.length,1,'Missing/duplicate versioned asset: '+name);
  }
});
verify('Guide and desktop controls use shared vectors, with cache-busted assets',()=>{
  assert.ok(iconSource.includes("upgradeCalendarActions()"));
  assert.ok(iconSource.includes("label==='←'?'chevron-left':label==='→'?'chevron-right'"));
  for(const name of ['flow-feature-guide-v1.js','flow-feature-guide-v1.css','flow-meal-single-v2.css']){
    assert.ok(html.includes(name+'?v=vector-2'),name+' stale URL');
  }
  assert.ok(html.includes('flow-editorial-refine-v2.css?v=vector-3'));
});
console.log('PASS '+checks.length+' action icon contract groups');
for(const label of checks)console.log('✓ '+label);
