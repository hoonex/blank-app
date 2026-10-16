import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../school.js',import.meta.url),'utf8');
const init=source.indexOf("if('serviceWorker'in navigator)window.addEventListener('load'");
assert.ok(init>0,'school.js boot boundary not found');

const storage=new Map();
let calls=0;
const context={
  localStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key),
  },
  document:{querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'},
  window:{addEventListener:()=>{}},
  location:{pathname:'/',origin:'https://example.test'},
  history:{replaceState:()=>{},pushState:()=>{}},
  matchMedia:()=>({matches:false,addEventListener:()=>{}}),
  navigator:{},setTimeout,clearTimeout,Intl,Date,URL,AbortController,console,
};
vm.createContext(context);
vm.runInContext(source.slice(0,init),context,{filename:'school.js'});
assert.equal(vm.runInContext('CACHE_TTL_MS',context),12*60*60*1000,'bundled School data should not be polled every few minutes');
vm.runInContext("profile={school:{schoolCode:'12345',officeCode:'D10',name:'테스트학교',kind:'고등학교'},grade:1,className:'1'};selectedDate=noon(new Date());",context);
context.renderActiveView=()=>{};
context.loading=()=>{};
const payload=()=>({timetable:[],meals:[{date:'20261016',dish:'sample'}],events:[]});
context.api=async()=>{calls++;return payload()};

const key=vm.runInContext('queryKey()',context);
vm.runInContext('saveCache(queryKey(),{timetable:[],meals:[{dish:"saved"}],events:[]})',context);
assert.equal(vm.runInContext('loadCache(queryKey()).meals[0].dish',context),'saved');
await context.loadDashboard();
assert.equal(calls,0,'fresh cache caused an unnecessary API request');

vm.runInContext('memoryCache.get(queryKey()).at=Date.now()-CACHE_TTL_MS-1',context);
assert.equal(vm.runInContext('loadCache(queryKey())',context),null,'expired cache was accepted');
assert.equal(vm.runInContext('loadCache(queryKey(),{allowStale:true}).meals[0].dish',context),'saved');
await context.loadDashboard();
assert.equal(calls,1,'expired cache did not revalidate');
assert.equal(vm.runInContext('data.meals[0].dish',context),'sample');

vm.runInContext('memoryCache.get(queryKey()).at=Date.now()-CACHE_TTL_MS-1',context);
context.api=async()=>{calls++;throw new Error('offline')};
await context.loadDashboard();
assert.equal(vm.runInContext('data.meals[0].dish',context),'sample','offline fallback discarded last known data');

context.api=async()=>{calls++;return payload()};
await context.loadDashboard({force:true});
assert.equal(calls,3,'explicit refresh did not bypass fresh cache');

let release;
context.api=()=>{calls++;return new Promise(resolve=>{release=resolve})};
vm.runInContext('memoryCache.get(queryKey()).at=Date.now()-CACHE_TTL_MS-1;dataKey=queryKey();lastAutoRefreshKey=""',context);
context.refreshDashboardIfStale();
context.refreshDashboardIfStale();
assert.equal(calls,4,'duplicate refresh requests started while one was pending');
release(payload());
await new Promise(resolve=>setImmediate(resolve));

context.api=async()=>{calls++;return payload()};
vm.runInContext('lastObservedToday=ymd(new Date(Date.now()-86400000));selectedDate=noon(new Date(Date.now()-86400000))',context);
context.refreshDashboardIfStale();
assert.equal(vm.runInContext('ymd(selectedDate)===ymd(new Date())',context),true,'date rollover did not select the new day');
await new Promise(resolve=>setImmediate(resolve));
vm.runInContext('lastObservedToday=ymd(new Date(Date.now()-86400000));selectedDate=noon(new Date(Date.now()-2*86400000))',context);
context.refreshDashboardIfStale();
assert.equal(vm.runInContext('ymd(selectedDate)===ymd(new Date(Date.now()-2*86400000))',context),true,'background refresh moved a user-selected historical date');

assert.ok(storage.has('flow-school-cache-v4:'+key),'existing cache storage format changed');
console.log('PASS: fresh cache, expiry, offline fallback, forced refresh, dedupe, rollover, historical date');
