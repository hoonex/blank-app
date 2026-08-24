export const ROUTE_SHELLS=Object.freeze({
  '/home':'/index.html',
  '/week':'/index.html',
  '/schedule':'/index.html',
  '/school':'/index.html',
  '/admin':'/admin/index.html',
  '/university':'/university/index.html',
  '/university/timetable':'/university/index.html',
  '/university/campus':'/university/index.html',
  '/university/school':'/university/index.html',
});

function normalizedPath(pathname){
  if(pathname.length>1&&pathname.endsWith('/'))return pathname.slice(0,-1);
  return pathname;
}

export default{
  async fetch(request,env){
    if(request.method!=='GET'&&request.method!=='HEAD')return env.ASSETS.fetch(request);
    const url=new URL(request.url);
    const shell=ROUTE_SHELLS[normalizedPath(url.pathname)];
    if(!shell)return env.ASSETS.fetch(request);
    const assetUrl=new URL(request.url);
    assetUrl.pathname=shell;
    return env.ASSETS.fetch(new Request(assetUrl,request));
  },
};
