const MEMO_KEY='flow-university-memo-v1';
const STYLE='/university/dashboard-memo-panel.css';
let widget=null,mirror=null,editor=null,dialog=null,lastFocus=null;
const $=(s,r=document)=>r.querySelector(s);
function ensureStyle(){if(document.querySelector(`link[href="${STYLE}"]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;document.head.append(link)}
function editing(){return document.querySelector('#todayView')?.classList.contains('dashboard-editing')}
function currentValue(){return String(mirror?.value??localStorage.getItem(MEMO_KEY)??'')}
function previewText(value){const line=String(value).split(/\r?\n/).map(v=>v.trim()).find(Boolean);return line||'메모 없음'}
function updatePreview(value=currentValue()){
  const title=$('#widgetMemoPreview',widget),meta=$('#widgetMemoMeta',widget),count=$('#flowMemoCount');
  if(title)title.textContent=previewText(value);
  if(meta)meta.textContent=value.trim()?`${value.length.toLocaleString('ko-KR')}자 · 눌러서 열기`:'눌러서 메모 작성';
  if(count)count.textContent=`${value.length.toLocaleString('ko-KR')} / 3000`;
}
function syncEditor(value=currentValue()){if(editor&&editor.value!==value)editor.value=value;updatePreview(value)}
function buildDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='flowMemoDialog';dialog.className='flow-memo-dialog';
  dialog.innerHTML=`<section class="flow-memo-shell" aria-label="메모 편집"><header class="flow-memo-header"><div class="flow-memo-title"><span>Flow <small>University</small></span><strong>메모</strong></div><button class="flow-memo-close" type="button" data-flow-memo-close>닫기</button></header><main class="flow-memo-main"><textarea id="flowMemoEditor" maxlength="3000" spellcheck="true" placeholder="기억할 것, 과제, 약속을 자유롭게 적어두세요."></textarea></main><footer class="flow-memo-footer"><span>이 기기에 자동 저장</span><span id="flowMemoCount">0 / 3000</span></footer></section>`;
  document.body.append(dialog);editor=$('#flowMemoEditor',dialog);
  editor.addEventListener('input',()=>{if(mirror){mirror.value=editor.value;mirror.dispatchEvent(new Event('input',{bubbles:true}))}else{try{localStorage.setItem(MEMO_KEY,editor.value)}catch{}}updatePreview(editor.value)});
  dialog.addEventListener('close',()=>{document.body.classList.remove('flow-memo-open');lastFocus?.focus?.({preventScroll:true});lastFocus=null});
  dialog.addEventListener('cancel',()=>document.body.classList.remove('flow-memo-open'));
  $('[data-flow-memo-close]',dialog).addEventListener('click',()=>dialog.close());
  return dialog
}
function openMemo(){if(editing())return;buildDialog();lastFocus=document.activeElement;syncEditor();document.body.classList.add('flow-memo-open');if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>editor?.focus({preventScroll:true}))}
function enhance(){
  widget=document.querySelector('#widgetDashboard [data-widget-id="memo"]');mirror=widget?.querySelector('#widgetMemoInput');
  if(!widget||!mirror)return false;if(widget.dataset.memoPanelUpgraded==='1')return true;
  widget.dataset.memoPanelUpgraded='1';ensureStyle();buildDialog();
  mirror.classList.add('widget-memo-mirror');
  const status=widget.querySelector('.widget-memo-status');if(status)status.classList.add('widget-memo-status-hidden');
  const content=document.createElement('div');content.className='widget-memo-summary';content.innerHTML='<strong id="widgetMemoPreview">메모 없음</strong><p id="widgetMemoMeta">눌러서 메모 작성</p><button class="widget-link widget-memo-open" type="button">메모 열기</button>';
  const controls=widget.querySelector('.widget-v2-controls');widget.insertBefore(content,controls||null);
  content.querySelector('.widget-memo-open').addEventListener('click',e=>{e.stopPropagation();openMemo()});
  widget.addEventListener('click',e=>{if(editing()||e.target.closest('.widget-v2-controls,.widget-memo-open'))return;openMemo()});
  mirror.addEventListener('input',()=>syncEditor(mirror.value));syncEditor(mirror.value);return true
}
function init(attempt=0){if(enhance())return;if(attempt<40)setTimeout(()=>init(attempt+1),80)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init(),{once:true});else init();
