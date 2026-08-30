const CACHE='flow-school-shell-v14';
const SHELL=['/','/index.html','/school.css','/school.js','/school-metrics.js','/school-metrics-core.js','/school-ia.js','/school-surface-cleanup.js','/school-v5.css','/school-hotfix.css','/school-polish.css','/school-settings-wide.css','/school-landscape-toolbar.css','/flow-native.css','/flow-native.js','/flow-settings-view.js','/flow-material.css','/flow-refraction.js','/flow-refraction.css','/flow-experience.js','/flow-experience.css','/flow-adfit-config.js','/flow-adfit.js','/flow-adfit.css','/manifest.webmanifest','/university/','/university/index.html','/university/university.css','/university/university-polish.css','/university/net-bootstrap.js','/university/university.js','/university/dashboard.css','/university/dashboard-variants.css','/university/dashboard.js','/university/dashboard-campus.js','/university/dashboard-editor-v2.css','/university/dashboard-editor-v2.js','/university/dashboard-editor-feedback.css','/university/dashboard-editor-feedback.js','/university/dashboard-home-editing.css','/university/dashboard-home-editing.js','/university/dashboard-memo-panel.css','/university/dashboard-memo-panel.js','/university/ui-unify.css','/university/ui-unify-v2.css','/university/settings-wide.css','/university/landscape-toolbar.css','/university/campus-ui-polish.css','/university/ui-unify.js','/university/timetable-enhance.css','/university/timetable-enhance.js','/university/timetable-density.js','/university/poi-icons.js','/university/campus.css','/university/campus.js','/university/campus-interactive.css','/university/campus-interactive.js','/university/campus-route-editor.css','/university/campus-route-editor.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))return;
  const freshShell=['document','script','style','worker'].includes(event.request.destination)||SHELL.includes(url.pathname);
  event.respondWith(fetch(event.request,freshShell?{cache:'no-cache'}:undefined).then(response=>{
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