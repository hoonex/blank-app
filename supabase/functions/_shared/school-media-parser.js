export function normalizeMedia(src='',base=''){
  try{const u=new URL(src,base);if(u.protocol==='http:')u.protocol='https:';return u.toString()}catch{return''}
}
function htmlText(v=''){return String(v).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim()}
function attr(attrs='',name=''){const m=String(attrs).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*[\"']([^\"']+)[\"']`,'i'));return m?.[1]||''}
export function dgeSchoolHost(host=''){return /\.dge\.(?:hs|ms|es|kg)\.kr$/i.test(String(host))}
function allowedDgeAsset(url,schoolHost){try{const h=new URL(url).hostname.toLowerCase().replace(/^www\./,'');return h===schoolHost||/\.dge\.(?:hs|ms|es|kg)\.kr$/i.test(h)}catch{return false}}
export function symbolLinks(html='',base='',schoolHost=''){
  const found=[];
  for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=attr(m[1],'href'),label=htmlText(m[2]);
    if(!href||(!/schulSymbol|schoolSymbol/i.test(href)&&!/학교\s*상징|교표/.test(label)))continue;
    const url=normalizeMedia(href,base);if(url&&allowedDgeAsset(url,schoolHost)&&!found.includes(url))found.push(url);
  }
  return found.slice(0,4);
}
export function officialMarkFromHtml(html='',base='',schoolHost=''){
  let best='',bestScore=-999;
  for(const m of String(html).matchAll(/<img\b([^>]*)>/gi)){
    const attrs=m[1],src=attr(attrs,'src')||attr(attrs,'data-src')||attr(attrs,'data-original');if(!src)continue;
    const label=`${attr(attrs,'alt')} ${attr(attrs,'title')}`.trim(),path=src.toLowerCase();
    let score=0;
    if(/교표/.test(label))score+=180;
    if(/학교\s*(?:로고|마크)|school\s*(?:logo|mark)|emblem/i.test(label))score+=120;
    if(/logo|symbol|emblem|schoolmark/.test(path))score+=35;
    if(/교기|교목|교화|교가|교훈|교복|급식|배너/.test(label))score-=180;
    const url=normalizeMedia(src,base);if(!url||!allowedDgeAsset(url,schoolHost))continue;
    if(score>bestScore){bestScore=score;best=url}
  }
  return bestScore>=100?best:'';
}
export async function discoverOfficialDgeMark(homeHtml='',homeUrl='',fetchImpl=globalThis.fetch){
  let home;try{home=new URL(homeUrl)}catch{return''}
  const host=home.hostname.toLowerCase().replace(/^www\./,'');if(!dgeSchoolHost(host))return'';
  const direct=officialMarkFromHtml(homeHtml,homeUrl,host);if(direct)return direct;
  for(const pageUrl of symbolLinks(homeHtml,homeUrl,host)){
    try{
      const r=await fetchImpl(pageUrl,{redirect:'follow',signal:AbortSignal.timeout(3800),headers:{'user-agent':'Mozilla/5.0 FlowSchool/2.0','accept':'text/html,application/xhtml+xml'}});
      if(!r.ok)continue;const type=r.headers.get('content-type')||'';if(type&&!type.includes('html'))continue;
      const html=(await r.text()).slice(0,1_200_000),mark=officialMarkFromHtml(html,r.url||pageUrl,host);if(mark)return mark;
    }catch{}
  }
  return'';
}
