// Flow School shared design contract. Run with Node 20+.
// Source regression guard, not a substitute for browser/screen-reader QA.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const css={
 base:file('style-f2805f3fda656187.css'),
 editorial:file('flow-editorial-refine-v2.css'),
 meal:file('flow-meal-single-v2.css'),
 motion:file('flow-motion-polish-v1.css'),
 wheel:file('flow-ui-wheel-smooth-v4.css'),
 events:file('flow-month-events-v1.css')
};
const html=file('index.html');
const checks=[];
const check=(label,fn)=>{fn();checks.push(label)};
function rule(src,selector){
 let i=src.indexOf(selector+'{');
 if(i<0)i=src.indexOf(selector+' {');
 assert.ok(i>=0,'CSS rule missing: '+selector);
 const start=src.indexOf('{',i)+1,end=src.indexOf('}',start);
 return src.slice(start,end);
}
const tight=x=>x.replace(/\s+/g,'');
const hasToken=(src,selector,prop,token)=>{
 assert.ok(tight(rule(src,selector)).includes(prop+':var(--'+token+')'),selector+' must use '+token);
};
check('Design tokens defined',()=>{
 for(const x of ['--flow-surface-radius:24px','--flow-action-radius:14px','--flow-segment-radius:11px','--flow-segment-thumb-radius:8px','--flow-press-scale:.985','--flow-floating-shadow:']){
  assert.ok(tight(css.base).includes(x),x);
 }
});
check('Passive surface geometry unified',()=>{
 hasToken(css.base,'.event-sheet','border-radius','flow-surface-radius');
 hasToken(css.base,'.bus-panel','border-radius','flow-surface-radius');
 hasToken(css.editorial,'.flow-shell .scene[data-scene="today"] .meal-sheet.flow-meal-single-host','border-radius','flow-surface-radius');
 hasToken(css.meal,'.scene[data-scene="today"] .meal-sheet.flow-meal-single-host','border-radius','flow-surface-radius');
});
check('Passive meal surface uses common subtle shadow',()=>{
 hasToken(css.editorial,'.flow-shell .scene[data-scene="today"] .meal-sheet.flow-meal-single-host','box-shadow','flow-surface-shadow');
});
check('Clickable school tiles have action radius without fake elevation',()=>{
 const s=tight(rule(css.editorial,'.flow-shell .scene[data-scene="school"] .flow-school-shortcut'));
 assert.ok(s.includes('box-shadow:none'));
 assert.ok(s.includes('border-radius:var(--flow-action-radius)'));
});
check('Segment controls share geometry',()=>{
 hasToken(css.editorial,'.flow-shell .scene[data-scene="today"] .switch-track','border-radius','flow-segment-radius');
 hasToken(css.editorial,'.flow-shell .scene[data-scene="today"] .flow-meal-segment','border-radius','flow-segment-radius');
});
check('Common press feedback and no arbitrary hover lift',()=>{
 const pressed=[
  [css.base,'.rail-navigation button:active'],
  [css.base,'.switch-track button:active'],
  [css.base,'.week-grid-header button:active'],
  [css.base,'.week-cell:active'],
  [css.base,'.setting-toggle:active'],
  [css.base,'.button-strong:active'],
  [css.meal,'.flow-meal-arrow:active'],
  [css.meal,'.flow-meal-day:active'],
  [css.editorial,'.flow-shell .scene[data-scene="school"] .flow-school-shortcut:active']
 ];
 for(const [src,sel] of pressed){
  assert.ok(tight(rule(src,sel)).includes('scale(var(--flow-press-scale))'),'Press mismatch: '+sel);
 }
 for(const sel of ['.setting-toggle:hover','.transit-link:hover']){
  assert.ok(!rule(css.base,sel).includes('translateY('),'Hover lift mismatch: '+sel);
 }
});
check('Wheel and floating nav retain their role-specific shadows',()=>{
 assert.ok(css.wheel.includes('--flow-wheel-shadow')||css.events.includes('--flow-wheel-shadow'));
 assert.ok(css.events.includes('var(--flow-floating-shadow)'));
});
check('Only the expected stylesheets are linked',()=>{
 for(const name of ['style-f2805f3fda656187.css','flow-editorial-refine-v2.css','flow-meal-single-v2.css','flow-motion-polish-v1.css']){
  assert.equal(html.split(name).length-1,1,'duplicate or missing: '+name);
 }
 assert.ok(!html.includes('flow-editorial-refine-v1.css'));
});
check('Core CSS integrity derived from staged Git blob',()=>{
 let blob;
 try{blob=execFileSync('git',['show',':style-f2805f3fda656187.css'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','ignore']})}
 catch{blob=readFileSync(new URL('../style-f2805f3fda656187.css',import.meta.url))}
 const integrity='sha384-'+createHash('sha384').update(blob).digest('base64');
 assert.ok(html.includes('integrity="'+integrity+'"'),'SRI mismatch: '+integrity);
});
console.log('PASS '+checks.length+' Flow design contract groups');
for(const label of checks)console.log('✓ '+label);
