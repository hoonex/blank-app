import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NEIS_KEY = Deno.env.get("NEIS_KEY") || "";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type, apikey, authorization",
  "Access-Control-Allow-Methods":"GET,OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"public, max-age=120"
};
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...CORS,...headers}});

function requireKey(name:string,value:string){if(!value)throw new Error(`${name} is not configured`);return value}
function rows(payload:any,name:string){
  const block=payload?.[name];
  if(!Array.isArray(block)) return [];
  return block.find((x:any)=>Array.isArray(x?.row))?.row||[];
}
async function call(name:string,params:Record<string,string>){
  const q=new URLSearchParams({KEY:requireKey("NEIS_KEY",NEIS_KEY),Type:"json",pIndex:"1",pSize:"1000",...params});
  const r=await fetch(`https://open.neis.go.kr/hub/${name}?${q}`,{signal:AbortSignal.timeout(9000)});
  if(!r.ok) throw new Error(`NEIS ${r.status}`);
  const data=await r.json();
  if(data?.RESULT?.CODE && data.RESULT.CODE!=="INFO-000" && data.RESULT.CODE!=="INFO-200") throw new Error(data.RESULT.MESSAGE||data.RESULT.CODE);
  return rows(data,name);
}
async function kakao(path:string,params:Record<string,string>){
  const q=new URLSearchParams(params);
  const r=await fetch(`https://dapi.kakao.com${path}?${q}`,{
    headers:{Authorization:`KakaoAK ${requireKey("KAKAO_REST_KEY",KAKAO_REST_KEY)}`},
    signal:AbortSignal.timeout(7000)
  });
  if(!r.ok){
    const detail=(await r.text().catch(()=>"")).slice(0,240);
    throw new Error(`Kakao ${r.status}${detail?`: ${detail}`:""}`);
  }
  return await r.json();
}
function date8(d:Date){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}
function baseDate(raw:string|null){if(raw&&/^\d{8}$/.test(raw)) return new Date(+raw.slice(0,4),+raw.slice(4,6)-1,+raw.slice(6,8),12);return new Date()}
function week(d:Date){const a=new Date(d);const day=a.getDay();a.setDate(a.getDate()+(day===0?-6:1-day));const b=new Date(a);b.setDate(a.getDate()+4);return [a,b]}
function endpoint(kind:string){if(kind.includes("초등"))return"elsTimetable";if(kind.includes("중학"))return"misTimetable";if(kind.includes("특수"))return"spsTimetable";return"hisTimetable"}
function clean(v:any){return v==null?"":String(v).trim()}
function school(r:any){return{
  officeCode:clean(r.ATPT_OFCDC_SC_CODE),officeName:clean(r.ATPT_OFCDC_SC_NM),schoolCode:clean(r.SD_SCHUL_CODE),
  name:clean(r.SCHUL_NM),englishName:clean(r.ENG_SCHUL_NM),kind:clean(r.SCHUL_KND_SC_NM),location:clean(r.LCTN_SC_NM),
  jurisdiction:clean(r.JU_ORG_NM),type:clean(r.FOND_SC_NM),postalCode:clean(r.ORG_RDNZC),address:clean(r.ORG_RDNMA),addressDetail:clean(r.ORG_RDNDA),
  phone:clean(r.ORG_TELNO),fax:clean(r.ORG_FAXNO),homepage:clean(r.HMPG_ADRES),coed:clean(r.COEDU_SC_NM),highSchoolType:clean(r.HS_SC_NM),
  highSchoolTrack:clean(r.HS_GNRL_BUSNS_SC_NM),specialPurpose:clean(r.SPCLY_PURPS_HS_ORD_NM),admissionTerm:clean(r.ENE_BFE_SEHF_SC_NM),
  dayNight:clean(r.DGHT_SC_NM),founded:clean(r.FOND_YMD),anniversary:clean(r.FOAS_MEMRD),loadedAt:clean(r.LOAD_DTM)
}}
function variants(q:string){const s=q.replace(/\s+/g,"");const v=[q,s];if(s.endsWith("고"))v.push(s.slice(0,-1)+"고등학교");if(s.endsWith("중"))v.push(s.slice(0,-1)+"중학교");if(s.endsWith("초"))v.push(s.slice(0,-1)+"초등학교");return [...new Set(v)].filter(Boolean)}
function normalizeMedia(src:string,base:string){try{const u=new URL(src,base);if(u.protocol==="http:")u.protocol="https:";return u.toString()}catch{return""}}
async function discoverMedia(homepage:string){
  if(!homepage)return{hero:"",logo:""};
  let base=homepage.trim();
  if(!/^https?:\/\//i.test(base))base=`https://${base}`;
  try{
    const r=await fetch(base,{redirect:"follow",signal:AbortSignal.timeout(4500),headers:{"user-agent":"Mozilla/5.0 FlowSchool/1.0"}});
    if(!r.ok)return{hero:"",logo:""};
    const html=await r.text();
    const meta=(prop:string)=>{
      const a=html.match(new RegExp(`<meta[^>]+(?:property|name)=[\\"']${prop}[\\"'][^>]+content=[\\"']([^\\"']+)[\\"']`,`i`));
      const b=html.match(new RegExp(`<meta[^>]+content=[\\"']([^\\"']+)[\\"'][^>]+(?:property|name)=[\\"']${prop}[\\"']`,`i`));
      return a?.[1]||b?.[1]||"";
    };
    const icon=html.match(/<link[^>]+rel=[\"'][^\"']*(?:icon|apple-touch-icon)[^\"']*[\"'][^>]+href=[\"']([^\"']+)[\"']/i)?.[1]
      || html.match(/<link[^>]+href=[\"']([^\"']+)[\"'][^>]+rel=[\"'][^\"']*(?:icon|apple-touch-icon)[^\"']*[\"']/i)?.[1]||"";
    const finalBase=r.url||base;
    return{hero:normalizeMedia(meta("og:image")||meta("twitter:image"),finalBase),logo:normalizeMedia(icon,finalBase)};
  }catch{return{hero:"",logo:""}}
}
function scheduleEvent(r:any){return{
  date:clean(r.AA_YMD),name:clean(r.EVENT_NM),content:clean(r.EVENT_CNTNT),
  grade1:clean(r.ONE_GRADE_EVENT_YN),grade2:clean(r.TW_GRADE_EVENT_YN),grade3:clean(r.THREE_GRADE_EVENT_YN),
  grade4:clean(r.FR_GRADE_EVENT_YN),grade5:clean(r.FIV_GRADE_EVENT_YN),grade6:clean(r.SIX_GRADE_EVENT_YN),
  holidayType:clean(r.SBTR_DD_SC_NM)
}}
async function scheduleForMonth(common:Record<string,string>,ms:Date,me:Date){
  let list=await call("SchoolSchedule",{...common,AA_FROM_YMD:date8(ms),AA_TO_YMD:date8(me)});
  let mode="month";
  if(!list.length){
    try{
      const all=await call("SchoolSchedule",common);
      const prefix=date8(ms).slice(0,6);
      list=all.filter((r:any)=>clean(r.AA_YMD).startsWith(prefix));
      if(list.length) mode="all-fallback";
    }catch{ }
  }
  return {list,mode};
}
function compactSchoolName(v:string){return v.replace(/\s+/g,"").replace(/(초등학교|중학교|고등학교|학교)$/g,"")}
async function kakaoPlace(name:string,address:string){
  let x="",y="";
  if(address){
    try{
      const geo=await kakao("/v2/local/search/address.json",{query:address,size:"1"});
      const first=Array.isArray(geo?.documents)?geo.documents[0]:null;
      x=clean(first?.x);y=clean(first?.y);
    }catch{ }
  }
  const params:Record<string,string>={query:name,size:"10"};
  if(x&&y){params.x=x;params.y=y;params.radius="10000";params.sort="distance"}
  let result=await kakao("/v2/local/search/keyword.json",params);
  let docs=Array.isArray(result?.documents)?result.documents:[];
  if(!docs.length&&address){
    result=await kakao("/v2/local/search/keyword.json",{query:`${name} ${address}`,size:"10"});
    docs=Array.isArray(result?.documents)?result.documents:[];
  }
  const target=compactSchoolName(name);
  docs.sort((a:any,b:any)=>{
    const an=compactSchoolName(clean(a?.place_name)),bn=compactSchoolName(clean(b?.place_name));
    const score=(n:string)=>n===target?0:n.includes(target)||target.includes(n)?1:2;
    return score(an)-score(bn)||(+clean(a?.distance)||999999)-(+clean(b?.distance)||999999);
  });
  const d=docs[0];
  if(!d)return null;
  return{
    id:clean(d.id),name:clean(d.place_name),url:clean(d.place_url),
    address:clean(d.address_name),roadAddress:clean(d.road_address_name),phone:clean(d.phone),
    x:clean(d.x),y:clean(d.y),distance:clean(d.distance)
  };
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  const u=new URL(req.url), action=u.searchParams.get("action")||"search";
  try{
    if(action==="search"){
      const q=(u.searchParams.get("q")||"").trim(); if(q.length<2)return reply({error:"학교명을 2자 이상 입력하세요."},400);
      const found=new Map<string,any>();
      for(const v of variants(q)){for(const r of await call("schoolInfo",{SCHUL_NM:v}))found.set(r.SD_SCHUL_CODE,r);if(found.size>=16)break}
      const scored=[...found.values()].sort((a:any,b:any)=>{const an=clean(a.SCHUL_NM).replace(/\s/g,""),bn=clean(b.SCHUL_NM).replace(/\s/g,""),qq=q.replace(/\s/g,"");const score=(n:string)=>n===qq?0:n.startsWith(qq)?1:n.includes(qq)?2:3;return score(an)-score(bn)||an.length-bn.length});
      return reply({schools:scored.slice(0,16).map(school)});
    }
    if(action==="classes"){
      const office=u.searchParams.get("office")||"", code=u.searchParams.get("school")||"", grade=u.searchParams.get("grade")||"";
      if(!office||!code||!grade)return reply({error:"학교와 학년 정보가 필요합니다."},400);
      const list=await call("classInfo",{ATPT_OFCDC_SC_CODE:office,SD_SCHUL_CODE:code,GRADE:grade});
      const classes=[...new Set(list.map((r:any)=>clean(r.CLASS_NM)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko",{numeric:true}));
      return reply({classes});
    }
    if(action==="media"){
      const office=u.searchParams.get("office")||"", code=u.searchParams.get("school")||"";
      if(!office||!code)return reply({error:"학교 정보가 필요합니다."},400);
      const si=await call("schoolInfo",{ATPT_OFCDC_SC_CODE:office,SD_SCHUL_CODE:code});
      const info=si[0]?school(si[0]):null;
      const media=await discoverMedia(info?.homepage||"");
      return reply({media,homepage:info?.homepage||""},200,{"Cache-Control":"public, max-age=86400"});
    }
    if(action==="place"){
      const name=(u.searchParams.get("name")||"").trim(),address=(u.searchParams.get("address")||"").trim();
      if(!name)return reply({error:"학교 이름이 필요합니다."},400);
      try{
        const place=await kakaoPlace(name,address);
        return reply({place,provider:"kakao"},200,{"Cache-Control":"public, max-age=86400"});
      }catch(e){
        const upstreamError=e instanceof Error?e.message:"Kakao place lookup failed";
        console.error(upstreamError);
        return reply({place:null,provider:"kakao",upstreamError},200,{"Cache-Control":"no-store"});
      }
    }
    if(action==="dashboard"){
      const office=u.searchParams.get("office")||"", code=u.searchParams.get("school")||"", grade=u.searchParams.get("grade")||"", cls=u.searchParams.get("class")||"", kind=u.searchParams.get("kind")||"고등학교";
      if(!office||!code||!grade||!cls)return reply({error:"학교/학년/반 정보가 필요합니다."},400);
      const d=baseDate(u.searchParams.get("date")), [from,to]=week(d), common={ATPT_OFCDC_SC_CODE:office,SD_SCHUL_CODE:code};
      const ms=new Date(d.getFullYear(),d.getMonth(),1,12), me=new Date(d.getFullYear(),d.getMonth()+1,0,12);
      const mealFrom=new Date(from);mealFrom.setDate(mealFrom.getDate()-2);const mealTo=new Date(to);mealTo.setDate(mealTo.getDate()+9);
      const [si,tt,meals,schedule]=await Promise.all([
        call("schoolInfo",common),
        call(endpoint(kind),{...common,GRADE:grade,CLASS_NM:cls,TI_FROM_YMD:date8(from),TI_TO_YMD:date8(to)}),
        call("mealServiceDietInfo",{...common,MLSV_FROM_YMD:date8(mealFrom),MLSV_TO_YMD:date8(mealTo)}),
        scheduleForMonth(common,ms,me)
      ]);
      return reply({school:si[0]?school(si[0]):null,selected:date8(d),from:date8(from),to:date8(to),
        timetable:tt.map((r:any)=>({date:clean(r.ALL_TI_YMD),period:+r.PERIO,subject:clean(r.ITRT_CNTNT),grade:clean(r.GRADE),className:clean(r.CLASS_NM)})),
        meals:meals.map((r:any)=>({date:clean(r.MLSV_YMD),type:clean(r.MMEAL_SC_NM),dishes:String(r.DDISH_NM||"").split("<br/>").map((x:string)=>x.trim()).filter(Boolean),calories:clean(r.CAL_INFO),nutrition:String(r.NTR_INFO||""),origin:String(r.ORPLC_INFO||""),people:clean(r.MLSV_FGR)})),
        events:schedule.list.map(scheduleEvent),scheduleMeta:{mode:schedule.mode,count:schedule.list.length}});
    }
    return reply({error:"unknown action"},404);
  }catch(e){console.error(e);return reply({error:e instanceof Error?e.message:"학교 데이터를 불러오지 못했습니다."},502)}
});
