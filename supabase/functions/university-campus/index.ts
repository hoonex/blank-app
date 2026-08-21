import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {CORS,category,clean,reply} from "./config.ts";
import {diningCandidates,resolveCampus,resolveLecturePlace,uniqueLecturePlaces} from "./resolve.ts";
import {staticMap,walk} from "./route.ts";

async function buildCampus(payload:any){
  const schoolName=clean(payload?.schoolName),address=clean(payload?.address);
  if(!schoolName)return reply({error:"대학 이름이 필요합니다."},400);
  const center=await resolveCampus(schoolName,address);
  if(!center)return reply({error:"캠퍼스 위치를 찾지 못했습니다."},404);
  const timetable=Array.isArray(payload?.items)?payload.items:[];
  const rawPlaces=uniqueLecturePlaces(timetable).slice(0,18);
  const resolved=[];
  for(const raw of rawPlaces)resolved.push(await resolveLecturePlace(raw,schoolName,center));
  const [stores,cafes,food,dining]=await Promise.all([
    category("CS2",center,8,2200).catch(()=>[]),
    category("CE7",center,8,2200).catch(()=>[]),
    category("FD6",center,8,2200).catch(()=>[]),
    diningCandidates(schoolName,center),
  ]);
  return reply({center,places:resolved,nearby:{stores,cafes,food,dining}},200,"no-store");
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  const u=new URL(req.url),action=u.searchParams.get("action")||"campus";
  try{
    if(action==="campus"){
      const payload=req.method==="POST"
        ?await req.json().catch(()=>({}))
        :{schoolName:u.searchParams.get("schoolName"),address:u.searchParams.get("address"),items:[]};
      return await buildCampus(payload);
    }
    if(action==="route"){
      const payload=req.method==="POST"
        ?await req.json().catch(()=>({}))
        :{start:{x:u.searchParams.get("startX"),y:u.searchParams.get("startY")},end:{x:u.searchParams.get("endX"),y:u.searchParams.get("endY")}};
      const route=await walk(payload.start,payload.end,clean(payload.startName)||"출발",clean(payload.endName)||"도착");
      return reply({route},200,"no-store");
    }
    if(action==="static-map")return await staticMap(u);
    return reply({error:"unknown action"},404);
  }catch(e){
    console.error(e);
    return reply({error:e instanceof Error?e.message:"캠퍼스 데이터를 불러오지 못했습니다."},502,"no-store");
  }
});
