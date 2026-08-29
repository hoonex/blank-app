import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const css=await fs.readFile('school-transit-map.css','utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:640,height:480}});
await page.setContent(`<!doctype html><style>${css}</style><div id="stage" style="position:relative;width:640px;height:480px"><span id="pin" class="flow-transit-map-pin board" style="position:absolute;left:320px;top:240px;transform:translate(-50%,-105%)"><i></i><b><span>승차</span><small>정류장 이름이 길어져도 좌표는 움직이지 않아야 합니다</small></b></span></div>`);
const geometry=await page.evaluate(()=>{
  const pin=document.querySelector('#pin');
  const dot=pin?.querySelector(':scope>i');
  const label=pin?.querySelector(':scope>b');
  const pr=pin?.getBoundingClientRect();
  const dr=dot?.getBoundingClientRect();
  const lr=label?.getBoundingClientRect();
  return {
    pin:pr&&{width:pr.width,height:pr.height,left:pr.left,top:pr.top},
    dot:dr&&{cx:dr.left+dr.width/2,cy:dr.top+dr.height/2,width:dr.width,height:dr.height},
    label:lr&&{left:lr.left,top:lr.top,right:lr.right,bottom:lr.bottom},
  };
});
await browser.close();
if(!geometry.pin||!geometry.dot||!geometry.label)throw new Error(`Transit marker DOM missing: ${JSON.stringify(geometry)}`);
const dx=Math.abs(geometry.dot.cx-320),dy=Math.abs(geometry.dot.cy-240);
if(dx>.25||dy>.25)throw new Error(`Transit stop dot is not anchored to the map coordinate: ${JSON.stringify({dx,dy,geometry})}`);
if(Math.abs(geometry.pin.width-19)>.25||geometry.pin.height>.25)throw new Error(`Transit pin anchor box must be 19px wide and zero-height: ${JSON.stringify(geometry.pin)}`);
if(geometry.label.left<=geometry.dot.cx)throw new Error(`Transit label must stay outside the coordinate anchor box: ${JSON.stringify(geometry)}`);
console.log(JSON.stringify({ok:true,coordinate:{x:320,y:240},dotCenter:{x:geometry.dot.cx,y:geometry.dot.cy},anchorBox:geometry.pin,labelLeft:geometry.label.left},null,2));
