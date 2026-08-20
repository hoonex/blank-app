const STYLE='/university/dashboard-editor-feedback.css';
let resize=null,press=null,raf=0;
function ensureStyle(){if(document.querySelector(`link[href="${STYLE}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=STYLE;document.head.append(l)}
function editing(){return document.querySelector('#todayView')?.classList.contains('dashboard-editing')}
function widgetFrom(target){return target?.closest?.('#widgetDashboard [data-widget-id]')||null}
function pulse(el,cls,duration=170){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),duration)}
function stopResize(){if(!resize)return;const el=resize.el;el.removeAttribute('data-resize-pressed');el.removeAttribute('data-resize-moving');document.body.classList.remove('dashboard-resize-active');pulse(el,'widget-resize-settled',230);resize=null;cancelAnimationFrame(raf);raf=0}
function stopPress(){if(!press)return;press.el.classList.remove('widget-pressing');press=null}
document.addEventListener('pointerdown',e=>{
  if(!editing()||e.button!==0)return;
  const handle=e.target.closest?.('.widget-v2-resize');
  if(handle){const el=widgetFrom(handle);if(!el)return;resize={el,startX:e.clientX,startY:e.clientY,lastSize:el.dataset.size||'',moved:false};el.dataset.resizePressed='1';document.body.classList.add('dashboard-resize-active');return}
  const el=widgetFrom(e.target);if(!el||e.target.closest('textarea,input,select,button,a,.widget-v2-controls'))return;
  press={el,startX:e.clientX,startY:e.clientY};el.classList.add('widget-pressing');
},{capture:true});
document.addEventListener('pointermove',e=>{
  if(resize){const d=Math.hypot(e.clientX-resize.startX,e.clientY-resize.startY);if(d>4){resize.moved=true;resize.el.dataset.resizeMoving='1'}cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!resize)return;const size=resize.el.dataset.size||'';if(size&&size!==resize.lastSize){resize.lastSize=size;pulse(resize.el,'widget-size-step',170)}})}
  if(press&&Math.hypot(e.clientX-press.startX,e.clientY-press.startY)>7)press.el.classList.remove('widget-pressing');
},{capture:true,passive:true});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{stopResize();stopPress()},{capture:true});
document.addEventListener('lostpointercapture',()=>{stopResize();stopPress()},true);
ensureStyle();
