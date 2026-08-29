const DENSITY_KEY='flow-university-timetable-density-v1';
const DENSITY_MIN=.6;
const DENSITY_MAX=1.6;
const DENSITY_WHEEL_FACTOR=.0024;
const DENSITY_EPSILON=.001;
const boundGrids=new WeakSet();
let density=readDensity();
let touchGesture=null;
let applyFrame=0;
let wheelCommitTimer=0;
let reapplyTimer=0;
let gridObserver=null;
let densityApplied=false;

function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function readDensity(){const value=Number(localStorage.getItem(DENSITY_KEY));return Number.isFinite(value)?clamp(value,DENSITY_MIN,DENSITY_MAX):1}
function persistDensity(){localStorage.setItem(DENSITY_KEY,String(Number(density.toFixed(4))))}
function timeMinutes(value){const match=String(value||'').trim().match(/^(\d{2}):(\d{2})$/);if(!match)return NaN;return Number(match[1])*60+Number(match[2])}
function baseHourPx(){return matchMedia('(max-width:820px)').matches?72:74}
function getGrid(){return document.querySelector('#timeGrid')}
function installGestureStyle(){if(document.querySelector('style[data-timetable-density-gesture]'))return;const style=document.createElement('style');style.dataset.timetableDensityGesture='';style.textContent='#timeGrid{touch-action:pan-x pan-y}';document.head.append(style)}
function getScaleGeometry(grid){const body=grid?.querySelector('.grid-body'),labels=[...(grid?.querySelectorAll('.hour-label')||[])];if(!body||labels.length<2)return null;const start=timeMinutes(labels[0].textContent),end=timeMinutes(labels.at(-1).textContent);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;return{body,labels,start,end,spanMinutes:end-start,scroll:grid.closest('.timetable-scroll')}}
function courseTime(block){const title=String(block.getAttribute('title')||''),match=title.match(/\s(\d{2}:\d{2})-(\d{2}:\d{2})$/);if(!match)return null;const start=timeMinutes(match[1]),end=timeMinutes(match[2]);return Number.isFinite(start)&&Number.isFinite(end)&&end>start?{start,end}:null}
function updateNowLine(grid,start,hourPx){const line=grid.querySelector('.flow-now-line');if(!line)return;const now=new Date(),current=now.getHours()*60+now.getMinutes(),column=line.closest('.day-column'),top=((current-start)/60)*hourPx;if(!column||!Number.isFinite(top)||top<0||top>column.clientHeight){line.remove();return}line.style.top=`${top}px`}
function applyDensity(next,{focalY=null,persist=false}={}){const grid=getGrid();density=clamp(Number(next)||1,DENSITY_MIN,DENSITY_MAX);if(!grid){if(persist)persistDensity();return false}if(Math.abs(density-1)<DENSITY_EPSILON&&!densityApplied){if(persist)persistDensity();return true}const geometry=getScaleGeometry(grid);if(!geometry){if(persist)persistDensity();return false}const oldHour=parseFloat(getComputedStyle(grid).getPropertyValue('--hour'))||baseHourPx(),newHour=baseHourPx()*density,bodyRect=geometry.body.getBoundingClientRect();let anchorMinutes=null;if(Number.isFinite(focalY)&&oldHour>0){anchorMinutes=clamp(geometry.start+((focalY-bodyRect.top)/oldHour)*60,geometry.start,geometry.end)}grid.style.setProperty('--hour',`${newHour}px`);const totalHeight=(geometry.spanMinutes/60)*newHour;geometry.body.style.height=`${totalHeight}px`;for(const label of geometry.labels){const minute=timeMinutes(label.textContent);if(Number.isFinite(minute))label.style.top=`${((minute-geometry.start)/60)*newHour}px`}grid.querySelectorAll('.day-column').forEach(column=>{column.style.height=`${totalHeight}px`;column.querySelectorAll('.course-block').forEach(block=>{const time=courseTime(block);if(!time)return;block.style.top=`${((time.start-geometry.start)/60)*newHour}px`;block.style.height=`${Math.max(22,((time.end-time.start)/60)*newHour)}px`})});updateNowLine(grid,geometry.start,newHour);densityApplied=Math.abs(density-1)>=DENSITY_EPSILON;grid.dataset.timetableDensity=String(Math.round(density*100));grid.dataset.timetableHourPx=String(Number(newHour.toFixed(2)));if(anchorMinutes!==null&&geometry.scroll){const nextBodyTop=geometry.body.getBoundingClientRect().top,targetY=nextBodyTop+((anchorMinutes-geometry.start)/60)*newHour;geometry.scroll.scrollTop+=targetY-focalY}if(persist)persistDensity();return true}
function scheduleDensity(next,focalY){density=clamp(Number(next)||1,DENSITY_MIN,DENSITY_MAX);cancelAnimationFrame(applyFrame);applyFrame=requestAnimationFrame(()=>{applyFrame=0;applyDensity(density,{focalY})})}
function touchDistance(touches){if(!touches||touches.length<2)return 0;return Math.hypot(touches[1].clientX-touches[0].clientX,touches[1].clientY-touches[0].clientY)}
function touchFocalY(touches){return(touches[0].clientY+touches[1].clientY)/2}
function onTouchStart(event){if(event.touches.length!==2||event.target.closest?.('[data-time-selection-rail]'))return;const distance=touchDistance(event.touches);if(distance<12)return;event.preventDefault();touchGesture={distance,scale:density};document.documentElement.classList.add('flow-timetable-pinching')}
function onTouchMove(event){if(!touchGesture||event.touches.length<2)return;event.preventDefault();const distance=touchDistance(event.touches);if(distance<12)return;scheduleDensity(touchGesture.scale*(distance/touchGesture.distance),touchFocalY(event.touches))}
function finishTouchGesture(){if(!touchGesture)return;touchGesture=null;cancelAnimationFrame(applyFrame);applyFrame=0;applyDensity(density,{persist:true});document.documentElement.classList.remove('flow-timetable-pinching')}
function onTouchEnd(event){if(!touchGesture)return;if(event.touches.length>=2)return;finishTouchGesture()}
function onWheel(event){if(!event.ctrlKey)return;event.preventDefault();const factor=Math.exp(-event.deltaY*DENSITY_WHEEL_FACTOR);scheduleDensity(density*factor,event.clientY);clearTimeout(wheelCommitTimer);wheelCommitTimer=setTimeout(()=>applyDensity(density,{persist:true}),140)}
function preventNativeGesture(event){event.preventDefault()}
function bindGrid(){const grid=getGrid();if(!grid)return false;installGestureStyle();if(!boundGrids.has(grid)){boundGrids.add(grid);grid.addEventListener('touchstart',onTouchStart,{passive:false});grid.addEventListener('touchmove',onTouchMove,{passive:false});grid.addEventListener('touchend',onTouchEnd,{passive:false});grid.addEventListener('touchcancel',onTouchEnd,{passive:false});grid.addEventListener('wheel',onWheel,{passive:false});grid.addEventListener('gesturestart',preventNativeGesture,{passive:false});grid.addEventListener('gesturechange',preventNativeGesture,{passive:false});grid.addEventListener('gestureend',preventNativeGesture,{passive:false})}if(!gridObserver){gridObserver=new MutationObserver(()=>{if(Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(0)});gridObserver.observe(grid,{childList:true})}return true}
function scheduleReapply(delay=40){clearTimeout(reapplyTimer);reapplyTimer=setTimeout(()=>{if(!bindGrid())return;applyDensity(density)},delay)}

document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="timetable"],[data-go="timetable"]')&&Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(90)},{passive:true});
window.addEventListener('flow:timetable-changed',()=>{if(Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(100)});
window.addEventListener('resize',()=>{if(Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(220)},{passive:true});
window.addEventListener('blur',finishTouchGesture);

if(!bindGrid()){const observer=new MutationObserver(()=>{if(bindGrid()){observer.disconnect();if(Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(0)}});observer.observe(document.documentElement,{childList:true,subtree:true})}
if(Math.abs(density-1)>=DENSITY_EPSILON)scheduleReapply(120);
