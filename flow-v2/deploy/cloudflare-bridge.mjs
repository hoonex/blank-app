/* Flow V2: Rust school as the front door, pinned legacy static fallback.
   SHA-pinned sources avoid deploying credentials or unreviewed HEAD changes.
   No static ASSETS binding: this intentionally avoids asset-first routing. */
const V2_RELEASE="8c024bcf54e5e414607633e7f90ba8daee4289d4";
const LEGACY_RELEASE="b1ac095b47baa0c09430559bf127e7c873fa9263";
const V2_BASE="https://raw.githubusercontent.com/hoonex/blank-app/"+V2_RELEASE+"/";
const LEGACY_BASE="https://raw.githubusercontent.com/hoonex/blank-app/"+LEGACY_RELEASE+"/";
const DIST="/flow-v2/frontend-rust/dist/";
const FILE_EXT=/\.(?:js|mjs|css|html|htm|json|webmanifest|svg|png|jpg|jpeg|webp|avif|ico|gif|woff|woff2|ttf|otf|wasm|mp3|wav|ogg|xml|txt|pdf|map)$/i;
function mime(path){
  const name=path.toLowerCase().split(".").pop();
  return ({
    js:"text/javascript; charset=utf-8",mjs:"text/javascript; charset=utf-8",
    css:"text/css; charset=utf-8",html:"text/html; charset=utf-8",
    htm:"text/html; charset=utf-8",json:"application/json; charset=utf-8",
    webmanifest:"application/manifest+json; charset=utf-8",
    svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",
    webp:"image/webp",avif:"image/avif",ico:"image/x-icon",gif:"image/gif",
    woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",
    wasm:"application/wasm",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",
    xml:"application/xml",txt:"text/plain; charset=utf-8",pdf:"application/pdf",
    map:"application/json; charset=utf-8"
  })[name]||"application/octet-stream";
}
async function proxy(rel,version,request){
  if(!rel||rel.includes("..")||rel.startsWith("/"))return new Response("Not found",{status:404});
  const isRust=version==="rust";
  const source=isRust?V2_BASE:LEGACY_BASE;
  let upstream;
  try{
    upstream=await fetch(source+rel,{
      headers:{accept:"*/*"},
      cf:{cacheEverything:true,cacheTtl:1800}
    });
  }catch(_){
    return new Response("Asset origin temporarily unavailable",{status:502});
  }
  if(!upstream.ok)return new Response("Asset missing",{status:upstream.status===404?404:502});
  const headers=new Headers();
  headers.set("content-type",mime(rel));
  headers.set("x-content-type-options","nosniff");
  headers.set("x-flow-ui-release",V2_RELEASE.slice(0,12));
  headers.set("cache-control",rel.endsWith(".html")?"no-store":"public,max-age=3600");
  return new Response(request.method==="HEAD"?null:upstream.body,{status:200,headers});
}

/* Daegu BIS ngisXPos/ngisYPos is KGD2002 / East Belt 2010 (EPSG:5187),
   in metres, not WGS84 latitude/longitude. GRS80 inverse Transverse Mercator.
   Incorrect or out-of-Daegu coordinates must never produce a guessed marker. */
function daeguNgisToGps(rawX,rawY){
  const x=Number(rawX),y=Number(rawY);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<100000||x>300000||y<250000||y>500000)return null;
  const a=6378137,f=1/298.257222101,e2=2*f-f*f,ep2=e2/(1-e2),rad=Math.PI/180;
  const a0=1-e2/4-3*e2**2/64-5*e2**3/256,
    a2=3*e2/8+3*e2**2/32+45*e2**3/1024,
    a4=15*e2**2/256+45*e2**3/1024,a6=35*e2**3/3072;
  const arc=t=>a*(a0*t-a2*Math.sin(2*t)+a4*Math.sin(4*t)-a6*Math.sin(6*t));
  const mu=(arc(38*rad)+(y-600000))/(a*a0),
    e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+
    (21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+
    (151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
  const sn=Math.sin(p),cs=Math.cos(p),tn=Math.tan(p),t=tn*tn,c=ep2*cs*cs,
    n=a/Math.sqrt(1-e2*sn*sn),
    r=a*(1-e2)/(1-e2*sn*sn)**1.5,d=(x-200000)/n;
  const lat=(p-n*tn/r*(d*d/2-(5+3*t+10*c-4*c*c-9*ep2)*d**4/24+
    (61+90*t+298*c+45*t*t-252*ep2-3*c*c)*d**6/720))/rad;
  const lng=(129*rad+(d-(1+2*t+c)*d**3/6+
    (5-2*c+28*t-3*c*c+8*ep2+24*t*t)*d**5/120)/cs)/rad;
  return lat>=35.4&&lat<=36.5&&lng>=127.7&&lng<=129.4?
    {lat:Math.round(lat*1e7)/1e7,lng:Math.round(lng*1e7)/1e7}:null;
}

/* A deliberately narrow bridge for the public Daegu BIS web data endpoints.
   This is the same unauthenticated JSON endpoint the public BIS site uses,
   not a paid Kakao API. Never let the client choose an origin or path. */
const BIS_ORIGIN="https://businfo.daegu.go.kr:8095/dbms_web_api";
const BUS_ERRORS={
  bad:"정류장 이름은 2~40자로 입력해 주세요.",
  unavailable:"대구 버스정보를 가져오지 못했어요. 잠시 후 다시 조회해 주세요."
};
function busJSON(data,status=200,maxAge=0){
  return new Response(JSON.stringify(data),{
    status,headers:{"content-type":"application/json; charset=utf-8",
      "x-content-type-options":"nosniff",
      "cache-control":maxAge>0?"public,max-age="+maxAge:"no-store"}
  });
}
async function busProxy(request,path){
  const url=new URL(request.url);
  let endpoint,ttl,op;
  if(path==="/api/bus/search"){
    op="search";
    const query=(url.searchParams.get("q")||"").trim().replace(/\s+/g," ");
    if(query.length<2||query.length>40||!/^[\p{L}\p{N}\s()./-]+$/u.test(query))
      return busJSON({ok:false,error:BUS_ERRORS.bad},400);
    endpoint=BIS_ORIGIN+"/bsInfo/bslistNm?bsNm="+encodeURIComponent(query);
    ttl=3600;
  }else if(path==="/api/bus/arrivals"){
    op="arrivals";
    const stopId=url.searchParams.get("stopId")||"";
    if(!/^\d{10}$/.test(stopId))
      return busJSON({ok:false,error:"올바른 정류장 ID가 아니에요."},400);
    endpoint=BIS_ORIGIN+"/realtime/arr/"+stopId;
    ttl=20;
  }else return busJSON({ok:false,error:"해당 버스 기능이 없어요."},404);
  const cacheKey=new Request(request.url,{method:"GET"});
  try{
    const cached=await caches.default.match(cacheKey);
    if(cached)return request.method==="HEAD"?new Response(null,{status:200,headers:cached.headers}):cached;
  }catch(_){}
  let source;
  try{
    const upstream=await fetch(endpoint,{
      headers:{accept:"application/json","Accept-Language":"ko-KR,ko;q=0.9"},
      signal:AbortSignal.timeout(6500),
      cf:{cacheEverything:true,cacheTtl:ttl}
    });
    if(!upstream.ok)throw Error("upstream status "+upstream.status);
    source=await upstream.json();
    if(source?.header?.success!==true||!source.body)throw Error("invalid BIS schema");
  }catch(_){
    return busJSON({ok:false,error:BUS_ERRORS.unavailable},502);
  }
  let output;
  if(op==="search"){
    if(!Array.isArray(source.body))return busJSON({ok:false,error:BUS_ERRORS.unavailable},502);
    const items=source.body.filter(x=>/^\d{10}$/.test(String(x.bsId||"")))
      .slice(0,35).map(x=>({
        id:String(x.bsId),name:String(x.bsNm||"").slice(0,90),
        number:String(x.wincId||"").slice(0,14),
        ...daeguNgisToGps(x.ngisXPos,x.ngisYPos)
      }));
    output={ok:true,source:"대구광역시 버스정보시스템",stops:items};
  }else{
    const body=source.body;
    if(body.block)output={ok:true,blocked:true,reason:String(body.blockMsg||"일시적으로 도착정보를 제공하지 않습니다."),
      buses:[],fetchedAt:new Date().toISOString(),source:"대구광역시 버스정보시스템"};
    else if(!Array.isArray(body.list))return busJSON({ok:false,error:BUS_ERRORS.unavailable},502);
    else output={ok:true,blocked:false,buses:body.list.slice(0,90).map(item=>{
      const gap=Number(item.bsGap);
      const rawState=String(item.arrState||item.bsNm||"도착정보 없음");
      // BIS abbreviates one/two stops away as "전" and "전전".
      // Pair a readable status with the exact provider stop count below.
      const readableState=(rawState==="전"||rawState==="전전")?"접근 중":rawState;
      return {
        route:String(item.routeNo||"").slice(0,30),
        state:readableState.slice(0,90),
        previousStop:String(item.bsNm||"").slice(0,90),
        remainingStops:Number.isFinite(gap)&&gap>=0?gap:null,
        note:String(item.routeNote||"").slice(0,120)
      };
    }),fetchedAt:new Date().toISOString(),source:"대구광역시 버스정보시스템"};
  }
  const response=busJSON(output,200,ttl);
  try{await caches.default.put(cacheKey,response.clone())}catch(_){}
  return request.method==="HEAD"?new Response(null,{status:200,headers:response.headers}):response;
}

export default {
  async fetch(request){
    if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405});
    const pathname=new URL(request.url).pathname;
    const path=pathname.replace(/\/+$/,"")||"/";
    if(path.startsWith("/api/bus/"))return busProxy(request,path);
    if(path==="/__flow_v2_status"){
      return Response.json({live:true,ui:"Rust/WASM",version:V2_RELEASE,legacy:LEGACY_RELEASE,mode:"origin-proxy"});
    }
    if(path==="/"||path==="/index.html"||path==="/v2"||path==="/home"||
       path==="/week"||path==="/schedule"||path==="/school"){
      return proxy("index.html","rust",request);
    }
    if(path.startsWith(DIST)){
      return proxy(path.slice(DIST.length),"rust",request);
    }
    if(path==="/legacy"||path==="/legacy/index.html"||path==="/transit"||
      /^\/legacy\/(?:home|week|schedule|school|settings|transit)$/.test(path)){
      return proxy("index.html","legacy",request);
    }
    if(path.startsWith("/legacy/")){
      const file=path.slice("/legacy/".length);
      return proxy(FILE_EXT.test(file)?file:"index.html","legacy",request);
    }
    if(path==="/university"||path==="/university/index.html"||
       /^\/university\/(?:timetable|campus|school|settings)$/.test(path)){
      return proxy("university/index.html","legacy",request);
    }
    if(path==="/admin"||path==="/admin/index.html"||path==="/admin/login"){
      return proxy("admin/index.html","legacy",request);
    }
    return proxy(path.slice(1),"legacy",request);
  }
};
