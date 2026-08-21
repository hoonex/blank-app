import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KAKAO_REST_KEY=Deno.env.get("KAKAO_REST_KEY")||"";
const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,OPTIONS",
  "Access-Control-Allow-Headers":"content-type",
  "Cache-Control":"public, max-age=86400, s-maxage=604800",
};
const JSON_HEADERS={...CORS,"Content-Type":"application/json; charset=utf-8"};

function validHost(value:string){
  const host=value.trim().toLowerCase().replace(/^www\./,'');
  if(!host||host.length>253||!host.includes('.')||!/^[a-z0-9.-]+$/.test(host))return null;
  if(host==='localhost'||host.endsWith('.local')||/^(?:10|127|169\.254|192\.168)\./.test(host))return null;
  const m=host.match(/^172\.(\d+)\./);if(m&&Number(m[1])>=16&&Number(m[1])<=31)return null;
  return host;
}
function stripHtml(v:string){return v.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function compact(value:string){return stripHtml(value).toLowerCase().replace(/[^0-9a-z가-힣]/g,'')}
function urlHost(value:string){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return''}}
function sameSite(candidate:string,official:string){return candidate===official||candidate.endsWith(`.${official}`)||official.endsWith(`.${candidate}`)}
function ratioScore(width:number,height:number){if(!width||!height)return 0;const r=width/height;if(r<.45||r>2.2)return-30;return Math.max(0,18-Math.abs(Math.log(r))*20)+(width>=100&&height>=100?6:0)+(width>=200&&height>=200?4:0)}
async function imageSearch(query:string){
  if(!KAKAO_REST_KEY)throw new Error('school-logo is missing KAKAO_REST_KEY');
  const q=new URLSearchParams({query,sort:'accuracy',size:'40'});
  const r=await fetch(`https://dapi.kakao.com/v2/search/image?${q}`,{headers:{Authorization:`KakaoAK ${KAKAO_REST_KEY}`},signal:AbortSignal.timeout(5500)});
  if(!r.ok)return[];const body=await r.json().catch(()=>({}));return Array.isArray(body?.documents)?body.documents:[];
}
function score(doc:any,schoolName:string,officialHost:string,queryIndex:number){
  const docHost=urlHost(String(doc?.doc_url||'')),site=compact(String(doc?.display_sitename||''));
  const school=compact(schoolName).replace(/(초등학교|중학교|고등학교|대학교|학교)$/,'');
  let points=0;
  if(docHost&&sameSite(docHost,officialHost))points+=140;
  if(site&&school&&site.includes(school))points+=36;
  const path=decodeURIComponent(String(doc?.doc_url||'')).toLowerCase();
  if(/교표|학교상징|상징|symbol|emblem|logo|schoolmark/.test(path))points+=24;
  points+=ratioScore(Number(doc?.width||0),Number(doc?.height||0));
  points+=queryIndex===0?10:4;
  if(/blog|cafe|instagram|facebook|namu\.wiki|youtube/.test(docHost))points-=45;
  if(!String(doc?.thumbnail_url||doc?.image_url||''))points-=100;
  return{points,docHost};
}
async function findMark(name:string,host:string){
  if(!name||!KAKAO_REST_KEY)return null;
  const queries=[`${name} 교표`,`${name} 학교상징`];
  const candidates:any[]=[];
  for(let qi=0;qi<queries.length;qi++){
    const docs=await imageSearch(queries[qi]);
    for(const doc of docs){const s=score(doc,name,host,qi);candidates.push({doc,...s,query:queries[qi]})}
    if(candidates.some(x=>x.points>=140))break;
  }
  candidates.sort((a,b)=>b.points-a.points);const best=candidates[0];
  if(!best||best.points<105)return null;
  const source=String(best.doc.thumbnail_url||best.doc.image_url||'');if(!source)return null;
  return{source,score:Math.round(best.points),query:best.query,schoolName:name,docUrl:String(best.doc.doc_url||''),docHost:best.docHost,displaySite:String(best.doc.display_sitename||''),width:Number(best.doc.width||0),height:Number(best.doc.height||0),official:sameSite(best.docHost,host)};
}
async function imageFrom(url:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{const response=await fetch(url,{signal:controller.signal,redirect:'follow',headers:{'user-agent':'FlowSchoolLogo/4.0'}});if(!response.ok)return null;const type=response.headers.get('content-type')||'';if(!type.toLowerCase().startsWith('image/'))return null;const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength<32||bytes.byteLength>500_000)return null;return{bytes,type}}catch{return null}finally{clearTimeout(timer)}
}
async function faviconFallback(host:string){
  for(const item of[{url:`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,source:'google-favicon'},{url:`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,source:'duckduckgo-favicon'}]){const hit=await imageFrom(item.url);if(hit)return{...hit,source:item.source}}
  return null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='GET')return new Response('Method not allowed',{status:405,headers:CORS});
  const u=new URL(req.url),host=validHost(u.searchParams.get('host')||''),name=(u.searchParams.get('name')||'').trim().slice(0,80),meta=u.searchParams.get('meta')==='1';
  if(!host)return new Response(JSON.stringify({error:'Invalid host'}),{status:400,headers:JSON_HEADERS});
  if(name){
    const mark=await findMark(name,host).catch(()=>null);
    if(mark){
      const hit=await imageFrom(mark.source);
      if(hit){const source=mark.official?'kakao-image-official':'kakao-image-search';if(meta)return new Response(JSON.stringify({found:true,source,...mark}),{status:200,headers:JSON_HEADERS});return new Response(hit.bytes,{status:200,headers:{...CORS,'Content-Type':hit.type,'X-Flow-Logo-Source':source,'X-Flow-Logo-Score':String(mark.score)}})}
    }
    if(meta)return new Response(JSON.stringify({found:false,source:KAKAO_REST_KEY?'none':'kakao-unconfigured',schoolName:name}),{status:200,headers:JSON_HEADERS});
  }else if(meta){
    return new Response(JSON.stringify({found:false,source:'name-required'}),{status:200,headers:JSON_HEADERS});
  }
  const fallback=await faviconFallback(host);
  if(fallback)return new Response(fallback.bytes,{status:200,headers:{...CORS,'Content-Type':fallback.type,'X-Flow-Logo-Source':fallback.source,'X-Flow-Logo-Score':'0'}});
  return new Response(null,{status:204,headers:{...CORS,'Cache-Control':'public, max-age=3600'}});
});
