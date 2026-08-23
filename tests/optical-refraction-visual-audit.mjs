import { chromium } from 'playwright';
import { inflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_OPTICAL_OUT||'optical-refraction-audit';
await mkdir(OUT,{recursive:true});
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function ymd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    const date=ymd();
    if(action==='dashboard')return json(route,{school:SCHOOL,selected:date,from:date,to:date,timetable:[{date,period:1,subject:'문학',grade:'2',className:'6'}],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:null});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c}
function decodePng(buffer){
  if(buffer.toString('ascii',1,4)!=='PNG')throw new Error('not PNG');
  let offset=8,width=0,height=0,colorType=0,bitDepth=0,interlace=0;const idat=[];
  while(offset<buffer.length){const len=buffer.readUInt32BE(offset);const type=buffer.toString('ascii',offset+4,offset+8);const data=buffer.subarray(offset+8,offset+8+len);offset+=12+len;
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];interlace=data[12]}
    else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;
  }
  if(bitDepth!==8||interlace!==0||![2,6].includes(colorType))throw new Error(`unsupported PNG ${JSON.stringify({bitDepth,colorType,interlace})}`);
  const channels=colorType===6?4:3,bpp=channels,stride=width*channels,raw=inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(stride*height);let src=0;
  for(let y=0;y<height;y++){
    const filter=raw[src++],row=y*stride,prev=(y-1)*stride;
    for(let x=0;x<stride;x++){
      const value=raw[src++],left=x>=bpp?pixels[row+x-bpp]:0,up=y?pixels[prev+x]:0,upLeft=y&&x>=bpp?pixels[prev+x-bpp]:0;
      let out=value;
      if(filter===1)out=(value+left)&255;else if(filter===2)out=(value+up)&255;else if(filter===3)out=(value+Math.floor((left+up)/2))&255;else if(filter===4)out=(value+paeth(left,up,upLeft))&255;else if(filter!==0)throw new Error(`unknown PNG filter ${filter}`);
      pixels[row+x]=out;
    }
  }
  return{width,height,channels,pixels};
}
function regionDiff(a,b,predicate){
  if(a.width!==b.width||a.height!==b.height||a.channels!==b.channels)throw new Error('PNG geometry mismatch');
  let total=0,count=0;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)if(predicate(x,y,a.width,a.height)){
    const i=(y*a.width+x)*a.channels;total+=Math.abs(a.pixels[i]-b.pixels[i])+Math.abs(a.pixels[i+1]-b.pixels[i+1])+Math.abs(a.pixels[i+2]-b.pixels[i+2]);count+=3;
  }
  return count?total/count:0;
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
const page=await context.newPage();page.setDefaultTimeout(10000);await fixtures(page);
await page.addInitScript(({school})=>{
  localStorage.clear();
  localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
  localStorage.setItem('flow-school-theme-v3','light');
  localStorage.setItem('flow-glass-mode-v2','optical');
},{school:SCHOOL});
await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();
await page.waitForFunction(()=>document.documentElement.dataset.flowRefractionCopy==='true'&&document.querySelector('.flow-refraction-copy-lens'));

await page.evaluate(()=>{
  const source=document.querySelector('.product-main'),nav=document.querySelector('#bottomNav');
  const sr=source.getBoundingClientRect(),nr=nav.getBoundingClientRect();source.style.position='relative';
  const pattern=document.createElement('div');pattern.dataset.flowRefractionCalibration='true';pattern.setAttribute('aria-hidden','true');
  pattern.innerHTML='<strong>REFRACTION 0123456789</strong>';
  pattern.style.cssText=`position:absolute;z-index:8;left:0;right:0;top:${Math.max(0,nr.top-sr.top-22)}px;height:100px;pointer-events:none;background-color:#f8fbff;background-image:linear-gradient(rgba(5,14,30,.95) 2px,transparent 2px),linear-gradient(90deg,rgba(5,14,30,.95) 2px,transparent 2px);background-size:12px 12px;color:#061126;font:900 22px/1 system-ui;letter-spacing:1px;padding:35px 4px 0;white-space:nowrap`;
  source.append(pattern);window.dispatchEvent(new CustomEvent('flow:refraction-refresh'));
  const neutral=document.createElement('style');neutral.id='flowRefractionNeutral';neutral.textContent='html[data-flow-refraction-copy="true"] body :where(.mobile-bottom-nav,.bottom-nav){box-shadow:none!important;border-color:transparent!important;background:rgba(255,255,255,.14)!important} html[data-flow-refraction-copy="true"] body .mobile-bottom-nav::before,html[data-flow-refraction-copy="true"] body .bottom-nav::before{background:rgba(255,255,255,.025)!important;border:0!important;box-shadow:none!important}';document.head.append(neutral);
});
await page.waitForFunction(()=>document.querySelector('.flow-refraction-copy-lens [data-flow-refraction-calibration="true"]'));
await page.waitForTimeout(140);

const state=await page.evaluate(async()=>{
  const nav=document.querySelector('#bottomNav'),lens=document.querySelector('.flow-refraction-copy-lens'),sample=document.querySelector('.flow-refraction-sample'),original=document.querySelector('.product-main>[data-flow-refraction-calibration="true"]'),copy=lens.querySelector('[data-flow-refraction-calibration="true"]');
  const ns=getComputedStyle(nav),ps=getComputedStyle(nav,'::before'),ss=getComputedStyle(sample),lr=lens.getBoundingClientRect(),or=original.getBoundingClientRect(),cr=copy.getBoundingClientRect();
  const initialAlignment={x:Math.abs(or.left-cr.left),y:Math.abs(or.top-cr.top)};
  nav.style.setProperty('--flow-lens-x','73px');await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const moved=copy.getBoundingClientRect(),movedOriginal=original.getBoundingClientRect(),movedAlignment={x:Math.abs(movedOriginal.left-moved.left),y:Math.abs(movedOriginal.top-moved.top)};
  nav.style.removeProperty('--flow-lens-x');await new Promise(requestAnimationFrame);
  return{navBackdrop:ns.backdropFilter||ns.webkitBackdropFilter||'',pseudoBackdrop:ps.backdropFilter||ps.webkitBackdropFilter||'',sampleFilter:ss.filter||'',lensRect:{left:lr.left,top:lr.top,width:lr.width,height:lr.height},initialAlignment,movedAlignment,root:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}};
});
if(!/url\([^)]*flow-liquid-nav-refraction/i.test(state.sampleFilter))throw new Error(`Ordinary SVG refraction filter is missing: ${JSON.stringify(state)}`);
if(state.pseudoBackdrop!=='none')throw new Error(`Legacy backdrop refraction still owns the lens: ${JSON.stringify(state)}`);
if(Math.max(state.initialAlignment.x,state.initialAlignment.y,state.movedAlignment.x,state.movedAlignment.y)>2)throw new Error(`Counter-positioned source copy drifted from the real surface: ${JSON.stringify(state)}`);
if(state.root.scrollWidth>state.root.clientWidth+3)throw new Error(`Optical calibration overflowed: ${JSON.stringify(state)}`);
const clip={x:Math.max(0,state.lensRect.left),y:Math.max(0,state.lensRect.top),width:Math.min(390,state.lensRect.width),height:Math.min(844,state.lensRect.height)};

const controlStyle=await page.evaluate(()=>{const s=document.createElement('style');s.id='flowRefractionControl';s.textContent='.flow-refraction-sample{filter:none!important}';document.head.append(s);return s.id});
await page.waitForTimeout(100);const control=await page.screenshot({path:`${OUT}/control-no-displacement.png`,clip,animations:'disabled'});
await page.evaluate(id=>document.getElementById(id)?.remove(),controlStyle);await page.waitForTimeout(120);const optical=await page.screenshot({path:`${OUT}/optical-displacement.png`,clip,animations:'disabled'});
await page.screenshot({path:`${OUT}/optical-calibration-full.png`,fullPage:false,animations:'disabled'});
const a=decodePng(control),b=decodePng(optical);
const edge=regionDiff(a,b,(x,y,w,h)=>x<w*.27||x>w*.73||y<h*.27||y>h*.73);
const center=regionDiff(a,b,(x,y,w,h)=>x>w*.32&&x<w*.68&&y>h*.30&&y<h*.70);
const all=regionDiff(a,b,()=>true),ratio=edge/Math.max(.01,center);
const report={state,clip,metrics:{edgeMeanAbsDiff:edge,centerMeanAbsDiff:center,allMeanAbsDiff:all,edgeToCenterRatio:ratio}};
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(all<1.0||edge<1.4||ratio<1.08)throw new Error(`Rendered Optical Glass does not show edge-weighted displacement: ${JSON.stringify(report.metrics)}`);
await context.close();await browser.close();
