/* Flow V2: Rust school as the front door, pinned legacy static fallback.
   SHA-pinned sources avoid deploying credentials or unreviewed HEAD changes.
   No static ASSETS binding: this intentionally avoids asset-first routing. */
const V2_RELEASE="4edbec6ae36837aec3a581fb2f41d81efaba4d61";
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
export default {
  async fetch(request){
    if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405});
    const pathname=new URL(request.url).pathname;
    const path=pathname.replace(/\/+$/,"")||"/";
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
