import {addressPoint,category,clean,compact,keyword,norm} from "./config.ts";

function schoolScore(p:any,schoolName:string){
  const pn=compact(p.name),sn=compact(schoolName);
  let s=0;
  if(pn===sn)s+=180;
  else if(pn.startsWith(sn))s+=135;
  else if(pn.includes(sn))s+=105;
  if(/학교\s*>\s*대학교|대학교/.test(p.category))s+=55;
  else if(p.category.includes("학교"))s+=25;
  if(/카페|커피|음식점|편의점|제과|베이커리/.test(p.category))s-=140;
  if(/카페|커피|편의점|식당|베이커리|라운지/.test(p.name))s-=70;
  s-=Math.min(20,(p.distance||0)/500);
  return s;
}

export async function resolveCampus(schoolName:string,address:string){
  const addr=await addressPoint(address).catch(()=>null);
  const [relevance,nearby]=await Promise.all([
    keyword(schoolName,null,15,12000).catch(()=>[]),
    keyword(schoolName,addr,15,12000).catch(()=>[]),
  ]);
  const dedup=new Map<string,any>();
  for(const p of [...relevance,...nearby]){
    const k=p.id||`${p.name}|${p.x}|${p.y}`;
    if(!dedup.has(k))dedup.set(k,p);
  }
  const list=[...dedup.values()].sort((a,b)=>schoolScore(b,schoolName)-schoolScore(a,schoolName));
  const p=list[0];
  if(p&&schoolScore(p,schoolName)>=70)return p;
  if(addr)return{
    name:schoolName,address,x:addr.x,y:addr.y,
    url:`https://map.kakao.com/link/search/${encodeURIComponent(schoolName)}`,
    category:"교육,학문 > 학교 > 대학교",categoryCode:"",roadAddress:address,phone:"",id:"",distance:0,
  };
  return null;
}

function stripCampusPrefix(value:string){
  let s=clean(value).replace(/\s+/g," ");
  s=s.replace(/^\s*(?:[가-힣a-z0-9]+동\s+)?(?:[가-힣a-z0-9]+\s+)?캠퍼스\s+/i,"");
  s=s.replace(/^\s*(?:본교|제[12]캠퍼스)\s+/i,"");
  return s.trim();
}
function stripRoomSuffix(value:string){
  let s=clean(value).replace(/\s+/g," ").trim();
  for(let i=0;i<2;i++){
    s=s.replace(/\s*(?:[-–—·:/]\s*)?(?:B?\d{1,4}[A-Z]?|[A-Z]\d{1,4}|\d{1,4}(?:호|실))\s*$/i,"").trim();
  }
  return s.replace(/[-–—·:/]\s*$/g,"").trim();
}
function lectureNameForms(raw:string){
  const src=stripCampusPrefix(raw);
  if(!src)return[];
  const aliases=[...src.matchAll(/\(([^)]+)\)/g)]
    .flatMap(m=>String(m[1]||"").split(/[|/,·]/g))
    .map(x=>stripRoomSuffix(stripCampusPrefix(x)))
    .filter(Boolean);
  const outside=stripRoomSuffix(src.replace(/\([^)]*\)/g," ").replace(/\s+/g," "));
  const joined=stripRoomSuffix(src.replace(/[()]/g," ").replace(/\s+/g," "));
  return [...new Set([outside,...aliases,joined].map(x=>x.trim()).filter(x=>x.length>=2))];
}
function placeQueries(raw:string,schoolName:string){
  const forms=lectureNameForms(raw);
  const queries:string[]=[];
  for(const form of forms)queries.push(`${schoolName} ${form}`,form);
  return [...new Set(queries.map(x=>x.trim()).filter(Boolean))];
}
function matchScore(p:any,raw:string,schoolName:string){
  const pn=norm(p.name),sn=norm(schoolName),forms=lectureNameForms(raw);
  let s=0;
  for(const form of forms){
    const fn=norm(form);if(!fn)continue;
    if(pn===fn)s=Math.max(s,125);
    else if(pn.endsWith(fn)||pn.startsWith(fn))s=Math.max(s,110);
    else if(pn.includes(fn)||fn.includes(pn))s=Math.max(s,92);
    const tokens=clean(form).toLowerCase().match(/[0-9a-z가-힣]+/gi)||[];
    let tokenScore=0;
    for(const t of tokens){const n=norm(t);if(n&&pn.includes(n))tokenScore+=14}
    s=Math.max(s,tokenScore);
  }
  if(sn&&pn.includes(sn))s+=22;
  if(p.category.includes("학교")||p.category.includes("대학교"))s+=8;
  if((p.distance||0)<=1200)s+=10;
  s-=Math.min(35,(p.distance||0)/150);
  return s;
}

export async function resolveLecturePlace(raw:string,schoolName:string,center:any){
  const queries=placeQueries(raw,schoolName);
  const candidates:any[]=[];
  for(const q of queries.slice(0,8)){
    const found=await keyword(q,center,15,6500).catch(()=>[]);
    candidates.push(...found);
    if(found.some((p:any)=>matchScore(p,raw,schoolName)>=78))break;
  }
  const byId=new Map<string,any>();
  for(const p of candidates){
    const key=p.id||`${p.name}|${p.x}|${p.y}`;
    const prev=byId.get(key);
    if(!prev||matchScore(p,raw,schoolName)>matchScore(prev,raw,schoolName))byId.set(key,p);
  }
  const list=[...byId.values()].sort((a,b)=>matchScore(b,raw,schoolName)-matchScore(a,raw,schoolName));
  const best=list[0];
  if(!best)return{raw,resolved:false,confidence:0,place:null,candidates:[],queries};
  const score=matchScore(best,raw,schoolName);
  return{raw,resolved:score>=20,confidence:Math.max(0,Math.min(100,Math.round(score))),place:best,candidates:list.slice(0,3),queries};
}

export function uniqueLecturePlaces(items:any[]){
  const out=[];const seen=new Set<string>();
  for(const item of items){
    const raw=clean(item?.place);if(!raw)continue;
    const key=raw.toLowerCase();if(seen.has(key))continue;
    seen.add(key);out.push(raw);
  }
  return out;
}

function diningScore(p:any,schoolName:string){
  let s=0;const pn=compact(p.name),sn=compact(schoolName);
  if(p.category.includes("구내식당"))s+=150;
  if(pn.includes(sn))s+=65;
  if(/학생식당|카페테리아|학식|교직원식당|복지관.*식당|학생회관.*식당/.test(p.name))s+=85;
  if(/카페|커피|제과|베이커리/.test(p.category))s-=140;
  if(/카페|커피|베이커리|빵집/.test(p.name))s-=100;
  s-=Math.min(20,(p.distance||0)/250);
  return s;
}

export async function diningCandidates(schoolName:string,center:any){
  const queries=[`${schoolName} 학생식당`,`${schoolName} 학식`,`${schoolName} 구내식당`,`${schoolName} 카페테리아`];
  const found:any[]=[];
  for(const q of queries)found.push(...await keyword(q,center,10,3500).catch(()=>[]));
  found.push(...await category("FD6",center,15,2200).catch(()=>[]));
  const dedup=new Map<string,any>();
  for(const p of found){const k=p.id||`${p.name}|${p.x}`;if(!dedup.has(k))dedup.set(k,p)}
  return [...dedup.values()]
    .map(p=>({p,score:diningScore(p,schoolName)}))
    .filter(x=>x.score>=35)
    .sort((a,b)=>b.score-a.score||(a.p.distance||999999)-(b.p.distance||999999))
    .slice(0,8).map(x=>x.p);
}
