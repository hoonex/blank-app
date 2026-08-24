import assert from 'node:assert/strict';
import {installUniversityFetchRetry} from '../university/net-bootstrap.js';

const target='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-data?action=search&q=test';
const campus='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus?action=campus';

function response(status,body={},headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}})}
function scopeWith(handler){const calls=[];const scope={fetch:async request=>{calls.push(request);return handler(request,calls.length)}};installUniversityFetchRetry(scope,{delays:[0,0]});return{scope,calls}}

{
  const {scope,calls}=scopeWith((request,count)=>count===1?response(502,{error:'temporary'}):response(200,{ok:true}));
  const result=await scope.fetch(target);
  assert.equal(result.status,200);
  assert.equal(calls.length,2,'502 should retry once before success');
}

{
  const {scope,calls}=scopeWith(()=>response(400,{error:'bad request'}));
  const result=await scope.fetch(target);
  assert.equal(result.status,400);
  assert.equal(calls.length,1,'non-transient 4xx must not retry');
}

{
  const {scope,calls}=scopeWith((request,count)=>{if(count===1)throw new TypeError('network down');return response(200,{ok:true})});
  const result=await scope.fetch(target);
  assert.equal(result.status,200);
  assert.equal(calls.length,2,'network failures should retry');
}

{
  const seen=[];
  const {scope,calls}=scopeWith(request=>{seen.push({method:request.method,body:request.clone().text()});return response(calls.length<3?503:200,{ok:true})});
  const payload=JSON.stringify({schoolName:'경북대학교'});
  const result=await scope.fetch(campus,{method:'POST',headers:{'content-type':'application/json'},body:payload});
  assert.equal(result.status,200);
  assert.equal(calls.length,3,'bounded retry should stop after third attempt');
  assert.deepEqual(calls.map(x=>x.method),['POST','POST','POST']);
  assert.deepEqual(await Promise.all(calls.map(x=>x.clone().text())),[payload,payload,payload],'POST body must survive retries');
}

{
  const {scope,calls}=scopeWith(()=>response(502));
  const result=await scope.fetch('https://example.com/data');
  assert.equal(result.status,502);
  assert.equal(calls.length,1,'unrelated hosts must bypass the retry layer');
}

{
  let calls=0;const scope={fetch:async()=>{calls++;return response(200)}};installUniversityFetchRetry(scope,{delays:[0,0]});
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>scope.fetch(target,{signal:controller.signal}),error=>error?.name==='AbortError');
  assert.equal(calls,0,'aborted requests must not hit the network');
}

{
  const {scope,calls}=scopeWith(()=>response(503,{error:'still down'}));
  const result=await scope.fetch(target);
  assert.equal(result.status,503);
  assert.equal(calls.length,3,'transient failures are capped at three total attempts');
}

console.log(JSON.stringify({targetHost:'eicwcohfrvhwimwevzkd.supabase.co',attemptCap:3,retryStatuses:[408,425,429,500,502,503,504],status:'ok'},null,2));
