const EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-logo';
const host='jungdong.dge.hs.kr';
const schoolName='정동고등학교';

const metaUrl=new URL(EDGE);
metaUrl.searchParams.set('host',host);
metaUrl.searchParams.set('name',schoolName);
metaUrl.searchParams.set('meta','1');
const metaStarted=Date.now();
const metaResponse=await fetch(metaUrl,{signal:AbortSignal.timeout(20000)});
const metaMs=Date.now()-metaStarted;
const meta=await metaResponse.json().catch(()=>({}));
console.log('school-logo meta',JSON.stringify({...meta,metaMs},null,2));

if(!metaResponse.ok)throw new Error(`school-logo meta HTTP ${metaResponse.status}`);
if(!meta.found)throw new Error(`No school emblem resolved for ${schoolName}`);
if(meta.schoolName!==schoolName)throw new Error(`School name mismatch: ${meta.schoolName||''}`);
if(!meta.official)throw new Error(`Resolved emblem is not from official school site: ${meta.docHost||''}`);
if(Number(meta.score||0)<100)throw new Error(`School emblem confidence too low: ${meta.score||0}`);
if(metaMs>6000)throw new Error(`School emblem metadata lookup too slow: ${metaMs}ms`);
if(!(String(meta.docHost||'')===host||String(meta.docHost||'').endsWith(`.${host}`)||host.endsWith(`.${String(meta.docHost||'')}`)))throw new Error(`Unexpected emblem source host: ${meta.docHost||''}`);

const imageUrl=new URL(EDGE);
imageUrl.searchParams.set('host',host);
imageUrl.searchParams.set('name',schoolName);
const imageStarted=Date.now();
const imageResponse=await fetch(imageUrl,{signal:AbortSignal.timeout(20000)});
const imageMs=Date.now()-imageStarted;
const type=imageResponse.headers.get('content-type')||'';
const source=imageResponse.headers.get('x-flow-logo-source')||'';
const bytes=new Uint8Array(await imageResponse.arrayBuffer());
console.log(JSON.stringify({status:imageResponse.status,type,source,bytes:bytes.length,schoolName:meta.schoolName,docHost:meta.docHost,score:meta.score,metaMs,imageMs},null,2));

if(!imageResponse.ok)throw new Error(`school-logo image HTTP ${imageResponse.status}`);
if(!type.toLowerCase().startsWith('image/'))throw new Error(`Unexpected school-logo content type: ${type}`);
if(source!=='kakao-image-official')throw new Error(`Expected official emblem source, got ${source}`);
if(imageMs>6000)throw new Error(`School emblem image lookup too slow: ${imageMs}ms`);
if(bytes.length<64)throw new Error(`School emblem response too small: ${bytes.length}`);
