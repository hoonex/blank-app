import '/university/dashboard-home-editing.js';
import '/university/dashboard-memo-panel.js';
const STYLE='/university/dashboard-editor-feedback.css';
let resize=null,press=null;
function ensureStyle(){if(document.querySelector(`link[href="${STYLE}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=STYLE;document.head.append(l)}
function editing(){return document.querySelector('#todayView')?.classList.contains('dashboard-editing')}
function widgetFrom(target){return target?.closest?.('#widgetDashboard [data-widget-id]')||target?.closest?.('.widget-direct-floating[data-widget-id]')||null}
function stopResize(){if(!resize)return;const el=resize.el;el.removeAttribute('data-resize-pressed');el.removeAttribute('data-resize-moving');resize=null}
function stopPress(){if(!press)return;press.el.classList.remove('widget-pressing');press=null}
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
},{capture:true,passive:true});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{stopResize();stopPress()},{capture:true});
window.addEventListener('blur',()=>{stopResize();stopPress()},{passive:true});
ensureStyle();
