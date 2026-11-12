const RELEASE="4edbec6ae36837aec3a581fb2f41d81efaba4d61";
const BASE="https://raw.githubusercontent.com/hoonex/blank-app/"+RELEASE+"/";
const V2="/flow-v2/frontend-rust/dist/";
const SHELLS={"/university":"/university/index.html","/admin":"/admin/index.html"};
function asType(p){
 if(p.endsWith(".wasm"))return"application/wasm";
 if(p.endsWith(".js"))return"text/javascript; charset=utf-8";
 if(p.endsWith(".css"))return"text/css; charset=utf-8";
 if(p.endsWith(".html"))return"text/html; charset=utf-8";
 return"application/octet-stream";
}
async function published(rel){
 let from;
 try{from=await fetch(BASE+rel,{cf:{cacheEverything:true,cacheTtl:300},headers:{accept:"*/*"}})}catch(e){
  return new Response("Build origin unavailable",{status:502});
 }
 if(!from.ok)return new Response("Build asset unavailable "+from.status,{status:502});
 const hd=new Headers({"content-type":asType(rel),"x-flow-v2-release":RELEASE,
 "x-content-type-options":"nosniff",
 "cache-control":rel==="index.html"?"no-cache":"public,max-age=31536000,immutable"});
 return new Response(from.body,{status:200,headers:hd});
}
export default {
 async fetch(req,env){
  if(req.method!=="GET"&&req.method!=="HEAD")return env.ASSETS?env.ASSETS.fetch(req):new Response("Method Not Allowed",{status:405});
  const url=new URL(req.url),path=url.pathname.replace(/\/+$/,"")||"/";
  if(path==="/__flow_v2_status")return Response.json({release:RELEASE,source:"GitHub-built Rust WASM",mode:env.ASSETS?"production-bridge":"preview-bridge"});
  if(path==="/__originprobe"){
    const r=await fetch("https://raw.githubusercontent.com/hoonex/blank-app/main/wrangler.jsonc");
    return Response.json({status:r.status,ok:r.ok});
  }
  if(path===V2+"index.html"||path==="/"||path==="/index.html"||path==="/v2"||path==="/home"||path==="/week"||path==="/schedule"||path==="/school")
    return published("index.html");
  if(path.startsWith(V2)){
    const name=path.slice(V2.length);
    if(!name||name.includes("/")||name.includes(".."))return new Response("Not found",{status:404});
    return published(name);
  }
  if(!env.ASSETS)return new Response("Not found: preview includes Rust school only",{status:404});
  if(path==="/legacy"||path==="/legacy/index.html"||path==="/transit"){
    const x=new URL(req.url);x.pathname="/index.html";return env.ASSETS.fetch(new Request(x,req));
  }
  if(path==="/university"||path.startsWith("/university/")){
    const x=new URL(req.url);x.pathname="/university/index.html";return env.ASSETS.fetch(new Request(x,req));
  }
  if(path==="/admin"||path.startsWith("/admin/")){
    const x=new URL(req.url);x.pathname="/admin/index.html";return env.ASSETS.fetch(new Request(x,req));
  }
  return env.ASSETS.fetch(req);
 }
};