export const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=600",
};

export const reply=(body:unknown,status=200,cache="public, max-age=600")=>
  new Response(JSON.stringify(body),{status,headers:{...CORS,"Cache-Control":cache}});

export const clean=(v:any)=>v==null?"":String(v).trim();
export const norm=(v="")=>v.toLowerCase().replace(/대학교|대학|캠퍼스|관|동|호|실|[^0-9a-z가-힣]/gi,"");
export const compact=(v="")=>v.toLowerCase().replace(/[^0-9a-z가-힣]/gi,"");

function requireKakao(){
  if(!KAKAO_REST_KEY)throw new Error("KAKAO_REST_KEY is not configured");
  return KAKAO_REST_KEY;
}

export async function kakao(path:string,params:URLSearchParams){
  const r=await fetch(`https://dapi.kakao.com${path}?${params}`,{
    headers:{Authorization:`KakaoAK ${requireKakao()}`},
    signal:AbortSignal.timeout(9000),
  });
  if(!r.ok){
    const detail=(await r.text().catch(()=>"")).slice(0,300);
    throw new Error(`Kakao ${r.status}${detail?`: ${detail}`:""}`);
  }
  return r;
}

export async function addressPoint(address:string){
  if(!address)return null;
  const q=new URLSearchParams({query:address,size:"5"});
  const body=await (await kakao("/v2/local/search/address.json",q)).json();
  const d=body?.documents?.[0];
  return d?{x:clean(d.x),y:clean(d.y),address:clean(d.address_name)}:null;
}

export function mapPlace(d:any){return{
  id:clean(d?.id),name:clean(d?.place_name),url:clean(d?.place_url).replace(/^http:/,"https:"),
  category:clean(d?.category_name),categoryCode:clean(d?.category_group_code),
  address:clean(d?.address_name),roadAddress:clean(d?.road_address_name),phone:clean(d?.phone),
  x:clean(d?.x),y:clean(d?.y),distance:Number(d?.distance||0),
}}

export async function keyword(query:string,center:any,size=15,radius=5000){
  if(!query)return[];
  const q=new URLSearchParams({query,size:String(Math.min(15,Math.max(1,size)))});
  if(center?.x&&center?.y){
    q.set("x",center.x);q.set("y",center.y);q.set("radius",String(radius));q.set("sort","distance");
  }
  const body=await (await kakao("/v2/local/search/keyword.json",q)).json();
  return (body?.documents||[]).map(mapPlace);
}

export async function category(code:string,center:any,size=8,radius=2000){
  if(!center?.x||!center?.y)return[];
  const q=new URLSearchParams({category_group_code:code,x:center.x,y:center.y,radius:String(radius),sort:"distance",size:String(Math.min(15,size))});
  const body=await (await kakao("/v2/local/search/category.json",q)).json();
  return (body?.documents||[]).map(mapPlace);
}
