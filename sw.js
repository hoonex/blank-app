const CACHE='flow-school-shell-v10';
const SHELL=['/','/index.html','/school.css','/school.js','/school-metrics.js','/school-v5.css','/school-hotfix.css','/school-polish.css','/manifest.webmanifest','/university/','/university/index.html','/university/university.css','/university/university-polish.css','/university/university.js','/university/dashboard.css','/university/dashboard.js','/university/poi-icons.js','/university/campus.css','/university/campus.js','/university/campus-interactive.css','/university/campus-interactive.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(async()=>{
    const hit=await caches.match(event.request);
    if(hit)return hit;
    if(url.pathname==='/university'||url.pathname.startsWith('/university/'))return caches.match('/university/index.html');
    return caches.match('/index.html');
  }));
});