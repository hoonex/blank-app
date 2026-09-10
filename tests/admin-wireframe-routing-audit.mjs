import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../admin/release-notes.js',import.meta.url),'utf8');
const sandbox={window:{}};
vm.runInNewContext(source,sandbox,{filename:'admin/release-notes.js'});
const map=sandbox.window.FLOW_ADMIN_UI_MAP;
if(!map||!Array.isArray(map.nodes)||!Array.isArray(map.edges))throw new Error('FLOW_ADMIN_UI_MAP is missing');
if(!Array.isArray(map.groups)||map.groups.length<4)throw new Error(`Expected at least four UI map groups, got ${map.groups?.length??0}`);
if(map.nodes.length<12||map.edges.length<12)throw new Error(`UI map unexpectedly sparse: ${map.nodes.length} nodes / ${map.edges.length} edges`);

const nodes=new Map(map.nodes.map(node=>[node.id,node]));
const kinds=new Set(map.edges.map(edge=>edge.kind));
for(const kind of ['nav','responsive','data','runtime'])if(!kinds.has(kind))throw new Error(`Missing wireframe route kind: ${kind}`);

function center(node){return{x:node.x+node.w/2,y:node.y+node.h/2}}
function inferredSide(source,target,sourcePort=true){
  const a=center(source),b=center(target),dx=b.x-a.x,dy=b.y-a.y;
  if(Math.abs(dx)>=Math.abs(dy))return sourcePort?(dx>=0?'right':'left'):(dx>=0?'left':'right');
  return sourcePort?(dy>=0?'bottom':'top'):(dy>=0?'top':'bottom');
}
function port(node,side,offset=0){
  if(side==='left')return{x:node.x,y:node.y+node.h/2+offset};
  if(side==='right')return{x:node.x+node.w,y:node.y+node.h/2+offset};
  if(side==='top')return{x:node.x+node.w/2+offset,y:node.y};
  return{x:node.x+node.w/2+offset,y:node.y+node.h};
}
function route(edge){
  const source=nodes.get(edge.source),target=nodes.get(edge.target);
  if(!source||!target)throw new Error(`Unknown route endpoint: ${edge.source} -> ${edge.target}`);
  const sourceSide=edge.sourceSide||inferredSide(source,target,true);
  const targetSide=edge.targetSide||inferredSide(source,target,false);
  const a=port(source,sourceSide,Number(edge.sourceOffset)||0);
  const b=port(target,targetSide,Number(edge.targetOffset)||0);
  const via=(edge.via||[]).map(([x,y])=>({x:Number(x),y:Number(y)}));
  if(via.length)return[a,...via,b];
  if(Math.abs(a.x-b.x)<1||Math.abs(a.y-b.y)<1)return[a,b];
  if(sourceSide==='left'||sourceSide==='right'){
    const x=(a.x+b.x)/2;
    return[a,{x,y:a.y},{x,y:b.y},b];
  }
  const y=(a.y+b.y)/2;
  return[a,{x:a.x,y},{x:b.x,y},b];
}
function segments(points){return points.slice(1).map((point,index)=>[points[index],point])}
function isHorizontal([a,b]){return Math.abs(a.y-b.y)<1e-6}
function isVertical([a,b]){return Math.abs(a.x-b.x)<1e-6}
function pointOnSegment(point,[a,b]){
  const within=point.x>=Math.min(a.x,b.x)-1e-6&&point.x<=Math.max(a.x,b.x)+1e-6&&point.y>=Math.min(a.y,b.y)-1e-6&&point.y<=Math.max(a.y,b.y)+1e-6;
  return within&&((isHorizontal([a,b])&&Math.abs(point.y-a.y)<1e-6)||(isVertical([a,b])&&Math.abs(point.x-a.x)<1e-6));
}
function intersection(first,second){
  const h1=isHorizontal(first),h2=isHorizontal(second),v1=isVertical(first),v2=isVertical(second);
  if(!((h1||v1)&&(h2||v2)))return{type:'non-orthogonal'};
  const [a,b]=first,[c,d]=second;
  if(h1&&v2){
    const p={x:c.x,y:a.y};return pointOnSegment(p,first)&&pointOnSegment(p,second)?{type:'point',point:p}:null;
  }
  if(v1&&h2){
    const p={x:a.x,y:c.y};return pointOnSegment(p,first)&&pointOnSegment(p,second)?{type:'point',point:p}:null;
  }
  if(h1&&h2&&Math.abs(a.y-c.y)<1e-6){
    const lo=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)),hi=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x));
    if(hi>lo+1e-6)return{type:'overlap'};
    if(Math.abs(hi-lo)<1e-6)return{type:'point',point:{x:lo,y:a.y}};
  }
  if(v1&&v2&&Math.abs(a.x-c.x)<1e-6){
    const lo=Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)),hi=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
    if(hi>lo+1e-6)return{type:'overlap'};
    if(Math.abs(hi-lo)<1e-6)return{type:'point',point:{x:a.x,y:lo}};
  }
  return null;
}
function pointInsideNode(point,node,padding=1){
  return point.x>=node.x-padding&&point.x<=node.x+node.w+padding&&point.y>=node.y-padding&&point.y<=node.y+node.h+padding;
}
function segmentHitsNode(segment,node,padding=10){
  const left=node.x-padding,right=node.x+node.w+padding,top=node.y-padding,bottom=node.y+node.h+padding;
  const [a,b]=segment;
  if(isHorizontal(segment)){
    if(a.y<top||a.y>bottom)return false;
    return Math.max(Math.min(a.x,b.x),left)<=Math.min(Math.max(a.x,b.x),right);
  }
  if(isVertical(segment)){
    if(a.x<left||a.x>right)return false;
    return Math.max(Math.min(a.y,b.y),top)<=Math.min(Math.max(a.y,b.y),bottom);
  }
  return true;
}

for(const node of map.nodes){
  if(node.x<0||node.y<0||node.x+node.w>map.width||node.y+node.h>map.height)throw new Error(`Node outside world: ${node.id}`);
  const zone=map.groups.find(group=>group.id===node.group.toLowerCase());
  if(!zone)throw new Error(`Node ${node.id} has no matching group zone`);
  if(node.x<zone.x||node.y<zone.y||node.x+node.w>zone.x+zone.w||node.y+node.h>zone.y+zone.h)throw new Error(`Node ${node.id} escapes ${zone.id} zone`);
}
for(let i=0;i<map.nodes.length;i++){
  for(let j=i+1;j<map.nodes.length;j++){
    const a=map.nodes[i],b=map.nodes[j];
    const overlap=a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    if(overlap)throw new Error(`Node rectangles overlap: ${a.id} / ${b.id}`);
  }
}

const routed=map.edges.map(edge=>({edge,points:route(edge)}));
for(const {edge,points} of routed){
  for(const segment of segments(points)){
    if(!isHorizontal(segment)&&!isVertical(segment))throw new Error(`Non-orthogonal segment in ${edge.source} -> ${edge.target}`);
    for(const node of map.nodes){
      if(node.id===edge.source||node.id===edge.target)continue;
      if(segmentHitsNode(segment,node))throw new Error(`Route ${edge.source} -> ${edge.target} crosses node ${node.id}`);
    }
  }
}
for(let i=0;i<routed.length;i++){
  for(let j=i+1;j<routed.length;j++){
    const first=routed[i],second=routed[j];
    for(const a of segments(first.points)){
      for(const b of segments(second.points)){
        const hit=intersection(a,b);if(!hit)continue;
        const shared=[first.edge.source,first.edge.target].find(id=>id===second.edge.source||id===second.edge.target);
        if(hit.type==='point'&&shared&&pointInsideNode(hit.point,nodes.get(shared)))continue;
        throw new Error(`Wireframe routes overlap/cross: ${first.edge.source}->${first.edge.target} with ${second.edge.source}->${second.edge.target} (${hit.type})`);
      }
    }
  }
}

console.log(JSON.stringify({groups:map.groups.length,nodes:map.nodes.length,edges:map.edges.length,kinds:[...kinds],crossings:0,nodeCrossings:0},null,2));
