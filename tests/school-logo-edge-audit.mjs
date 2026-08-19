const EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-logo';
const host='jungdong.dge.hs.kr';

const metaUrl=new URL(EDGE);
metaUrl.searchParams.set('host',host);
metaUrl.searchParams.set('meta','1');
const metaResponse=await fetch(metaUrl,{signal:AbortSignal.timeout(20000)});
const meta=await metaResponse.json().catch(()=>({}));
console.log('school-logo meta',JSON.stringify(meta,null,2));

if(!metaResponse.ok)throw new Error(`school-logo meta HTTP ${metaResponse.status}`);
if(!meta.found)throw new Error(`No school emblem resolved for ${host}`);
if(!String(meta.schoolName||'').includes('정동'))throw new Error(`School name inference failed: ${meta.schoolName||''}`);
if(!meta.official)throw new Error(`Resolved emblem is not from official school site: ${meta.docHost||''}`);
if(Number(meta.score||0)<100)throw new Error(`School emblem confidence too low: ${meta.score||0}`);
if(!(String(meta.docHost||'')===host||String(meta.docHost||'').endsWith(`.${host}`)||host.endsWith(`.${String(meta.docHost||'')}`)))throw new Error(`Unexpected emblem source host: ${meta.docHost||''}`);

const imageUrl=new URL(EDGE);
imageUrl.searchParams.set('host',host);
const imageResponse=await fetch(imageUrl,{signal:AbortSignal.timeout(20000)});
const type=imageResponse.headers.get('content-type')||'';
const source=imageResponse.headers.get('x-flow-logo-source')||'';
const bytes=new Uint8Array(await imageResponse.arrayBuffer());
console.log(JSON.stringify({status:imageResponse.status,type,source,bytes:bytes.length,schoolName:meta.schoolName,docHost:meta.docHost,score:meta.score},null,2));

if(!imageResponse.ok)throw new Error(`school-logo image HTTP ${imageResponse.status}`);
if(!type.toLowerCase().startsWith('image/'))throw new Error(`Unexpected school-logo content type: ${type}`);
if(source!=='kakao-image-official')throw new Error(`Expected official emblem source, got ${source}`);
if(bytes.length<64)throw new Error(`School emblem response too small: ${bytes.length}`);
