import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  SCHOOL_RESOURCE_KINDS,SCHOOL_RESOURCE_TTL_MS,schoolResourceKey,createSchoolResourceCache,
} from '../school-data-store.mjs';

const source=readFileSync(new URL('../school.js',import.meta.url),'utf8')
  .replace(/^import .*?from '\.\/school-data-store\.mjs';\s*/,'');
const boot=source.indexOf("if('serviceWorker'in navigator)window.addEventListener('load'");
assert.ok(boot>0,'school.js boot boundary not found');

const storage=new Map(),localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key),
};
const profile={school:{schoolCode:'12345',officeCode:'D10',name:'테스트학교',kind:'고등학교'},grade:2,className:'6'};
const date=new Date(2026,9,16,12);
const store=createSchoolResourceCache(localStorage,()=>Date.now());
assert.deepEqual(SCHOOL_RESOURCE_TTL_MS,{
  school:7*86400000,timetable:4*3600000,meals:86400000,events:86400000,
});
assert.notEqual(schoolResourceKey(profile,'timetable',date),schoolResourceKey({...profile,grade:3},'timetable',date));
assert.equal(schoolResourceKey(profile,'meals',date),schoolResourceKey({...profile,grade:3},'meals',date));
assert.equal(schoolResourceKey(profile,'events',date),schoolResourceKey({...profile,grade:3},'events',date));
assert.notEqual(schoolResourceKey(profile,'events',date),schoolResourceKey(profile,'events',new Date(2026,10,1,12)));
assert.notEqual(schoolResourceKey(profile,'meals',date),schoolResourceKey(profile,'meals',new Date(2026,9,25,12)));

const context={
  SCHOOL_RESOURCE_KINDS,createSchoolResourceCache,localStorage,
  document:{querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'},
  window:{addEventListener:()=>{}},location:{pathname:'/',origin:'https://example.test'},
  history:{replaceState:()=>{},pushState:()=>{}},
  matchMedia:()=>({matches:false,addEventListener:()=>{}}),
  navigator:{},setTimeout,clearTimeout,Intl,Date,URL,AbortController,console,
};
vm.createContext(context);
vm.runInContext(source.slice(0,boot),context,{filename:'school.js'});
vm.runInContext('profile='+JSON.stringify(profile)+';selectedDate=new Date(2026,9,16,12)',context);
context.renderActiveView=()=>{};
context.loading=()=>{};

let count=0,calls=[],pending=null;
const fixture={
  'school-info':()=>({school:profile.school}),
  'timetable':()=>({timetable:[{date:'20261016',period:1,subject:'수학'}],from:'20261012',to:'20261016'}),
  'meals':()=>({meals:[{date:'20261016',type:'중식',dishes:['밥']}] }),
  'events':()=>({events:[{date:'20261020',name:'행사'}],scheduleMeta:{mode:'month',count:1}}),
};
context.api=async args=>{
  count++;calls.push(args.action);
  if(pending&&args.action==='timetable')return new Promise(resolve=>{pending=resolve});
  if(!fixture[args.action])throw new Error('Legacy endpoint not expected');
  return fixture[args.action]();
};
const run=code=>vm.runInContext(code,context);

await context.loadDashboard();
assert.deepEqual([...calls].sort(),['events','meals','school-info','timetable']);
assert.equal(run('data.timetable[0].subject'),'수학');
await context.loadDashboard();
assert.equal(count,4,'fresh cache made a network request');

run('resourceCache.record(profile,"timetable",selectedDate).at=Date.now()-5*3600000');
calls=[];await context.loadDashboard();
assert.deepEqual(calls,['timetable'],'only timetable should revalidate after four hours');

run('resourceCache.record(profile,"meals",selectedDate).at=Date.now()-25*3600000');
calls=[];await context.loadDashboard();
assert.deepEqual(calls,['meals'],'meals should not be tied to the timetable TTL');

run('resourceCache.record(profile,"events",selectedDate).at=Date.now()-25*3600000');
calls=[];await context.loadDashboard();
assert.deepEqual(calls,['events'],'events should refresh independently');

run('resourceCache.record(profile,"school",selectedDate).at=Date.now()-8*86400000');
calls=[];await context.loadDashboard();
assert.deepEqual(calls,['school-info'],'school metadata should have its own seven-day TTL');

calls=[];await context.loadDashboard({force:true});
assert.deepEqual([...calls].sort(),['events','meals','school-info','timetable']);
assert.equal(run('data.meals[0].dishes[0]'),'밥','forced refresh lost meals');

run('resourceCache.record(profile,"meals",selectedDate).at=Date.now()-25*3600000');
context.api=async()=>{count++;throw new Error('offline')};
await context.loadDashboard();
assert.equal(run('data.meals[0].dishes[0]'),'밥','offline fallback discarded last known meals');

calls=[];let release=null;
run('resourceCache.put(profile,"meals",selectedDate,{meals:[{date:"20261016",dishes:["밥"]}]})');
run('resourceCache.record(profile,"timetable",selectedDate).at=Date.now()-5*3600000');
context.api=async args=>{
  count++;calls.push(args.action);
  if(args.action==='timetable')return new Promise(resolve=>{release=resolve});
  return fixture[args.action]?.()||fixture.timetable();
};
const first=context.loadDashboard();await Promise.resolve();
const second=context.loadDashboard();await Promise.resolve();
assert.deepEqual(calls,['timetable'],'identical in-flight dashboard requests were duplicated');
release(fixture.timetable());await Promise.all([first,second]);
assert.equal(run('dashboardLoadingKey'),'','loading flag not cleared');

context.api=async args=>{calls.push(args.action);return fixture[args.action]?.()||fixture.timetable()};
run('selectedDate=new Date(2026,9,15,12);lastObservedToday=ymd(new Date(Date.now()-86400000))');
context.refreshDashboardIfStale();
assert.equal(run('ymd(selectedDate)===ymd(new Date())'),true,'today should roll over at midnight');
await new Promise(resolve=>setImmediate(resolve));

assert.ok(store.get(profile,'school',date,{allowStale:true}), 'persisted resource was not recovered');
console.log('PASS: resource TTLs, scope, independent revalidation, fallback, forced refresh, request deduplication');
