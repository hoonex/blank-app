import {clean,kakao,reply} from "./config.ts";

export async function walk(start:any,end:any,startName="출발",endName="도착"){
  if(!start?.x||!start?.y||!end?.x||!end?.y)return null;
  const q=new URLSearchParams({
    start_x:start.x,start_y:start.y,end_x:end.x,end_y:end.y,
    s_name:startName,e_name:endName,route_mode:"SHORTEST",
  });
  const body=await (await kakao("/v2/routing/walk",q)).json();
  if(body?.status!=="OK"||!body?.route)return{status:clean(body?.status)||"NO_RESULTS"};
  const props=body.route.properties||{};
  const points=(body.route.legs||[]).flatMap((leg:any)=>(leg.steps||[]).flatMap((step:any)=>step?.path?.points||[]));
  return{
    status:"OK",
    distance:Number(props.totalDistance||0),
    time:Number(props.totalTime||0),
    landingUrl:clean(props.landingUrl),
    points:points.slice(0,2500),
  };
}

export async function staticMap(u:URL){
  const coords=(u.searchParams.get("markers")||"")
    .split(";").map(x=>x.trim()).filter(x=>/^[-\d.]+,[-\d.]+$/.test(x)).slice(0,5);
  const center=u.searchParams.get("center")||coords[0]||"";
  if(!center)return reply({error:"지도 좌표가 필요합니다."},400);
  const q=new URLSearchParams({
    center,size:"720x420",format:"png",scale:"1",
    lv:u.searchParams.get("lv")||"3",logo_pos:"BOTTOM_RIGHT",
  });
  for(const c of coords)q.append("markers",`location:${c}|option:false`);
  const r=await kakao("/v2/maps/staticmap",q);
  const bytes=await r.arrayBuffer();
  return new Response(bytes,{status:200,headers:{
    "Access-Control-Allow-Origin":"*",
    "Content-Type":r.headers.get("content-type")||"image/png",
    "Cache-Control":"public, max-age=1800",
  }});
}
