import '/university/dashboard-editor-v2.js';
import '/university/dashboard-campus.js';
import '/university/dashboard-memo-panel.js';
const STYLE='/university/dashboard-editor-feedback.css';
const AUTO_SCROLL_EDGE=110;
const AUTO_SCROLL_MAX=18;
let resize=null,press=null,autoScrollRaf=0,dragPointerY=null;
function ensureStyle(){if(document.querySelector(`link[href="${STYLE}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=STYLE;document.head.append(l)}
function editing(){return document.querySelector('#todayView')?.classList.contains('dashboard-editing')}
function widgetFrom(target){return target?.closest?.('#widgetDashboard [data-widget-id]')||target?.closest?.('.widget-direct-floating[data-widget-id]')||null}
function stopResize(){if(!resize)return;const el=resize.el;el.removeAttribute('data-resize-pressed');el.removeAttribute('data-resize-moving');resize=null}
function stopPress(){if(!press)return;press.el.classList.remove('widget-pressing');press=null}
function stopAutoScroll(){if(autoScrollRaf)cancelAnimationFrame(autoScrollRaf);autoScrollRaf=0;dragPointerY=null;document.documentElement.removeAttribute('data-widget-auto-scroll')}
function autoScrollStep(){
  if(!document.body.classList.contains('widget-drag-active')||dragPointerY===null){stopAutoScroll();return}
  const h=innerHeight,edge=Math.min(AUTO_SCROLL_EDGE,Math.max(72,h*.16));let speed=0;
  if(dragPointerY<edge)speed=-AUTO_SCROLL_MAX*(1-Math.max(0,dragPointerY)/edge);
  else if(dragPointerY>h-edge)speed=AUTO_SCROLL_MAX*(1-Math.max(0,h-dragPointerY)/edge);
  if(Math.abs(speed)>.35){const max=Math.max(0,document.documentElement.scrollHeight-h),next=Math.max(0,Math.min(max,scrollY+speed));if(Math.abs(next-scrollY)>.2){window.scrollTo(0,next);document.documentElement.dataset.widgetAutoScroll=speed<0?'up':'down'}}
  autoScrollRaf=requestAnimationFrame(autoScrollStep)
}
function updateAutoScroll(e){
  if(!document.body.classList.contains('widget-drag-active')){stopAutoScroll();return}
  dragPointerY=e.clientY;
  if(!autoScrollRaf)autoScrollRaf=requestAnimationFrame(autoScrollStep)
}
document.addEventListener('pointerdown',e=>{
  if(!editing()||e.button!==0)return;
  const handle=e.target.closest?.('.widget-v2-resize');
  if(handle){const el=widgetFrom(handle);if(!el)return;resize={el,startX:e.clientX,startY:e.clientY};el.dataset.resizePressed='1';return}
  const el=widgetFrom(e.target);if(!el||e.target.closest('textarea,input,select,button,a,.widget-v2-controls'))return;
  press={el,startX:e.clientX,startY:e.clientY};el.classList.add('widget-pressing');
},{capture:true});
document.addEventListener('pointermove',e=>{
  if(resize&&Math.hypot(e.clientX-resize.startX,e.clientY-resize.startY)>4)resize.el.dataset.resizeMoving='1';
  if(press&&Math.hypot(e.clientX-press.startX,e.clientY-press.startY)>7)press.el.classList.remove('widget-pressing');
  updateAutoScroll(e)
},{capture:true,passive:true});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{stopResize();stopPress();stopAutoScroll()},{capture:true});
window.addEventListener('blur',stopAutoScroll,{passive:true});
ensureStyle();
