(() => {
'use strict';
let root=null,localObserver=null,queued=false;
function kindOf(name){
  const v=String(name||'').replace(/\s/g,'');
  if(/초등학교|초등부/.test(v))return 'elementary';
  if(/중학교|중등학교|중학/.test(v))return 'middle';
  if(/고등학교|고등부|고교/.test(v))return 'high';
  return 'unknown';
}
function schedule(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;update();});
}
function update(){
  const next=document.querySelector('.onboarding');
  if(root!==next){
    localObserver?.disconnect();root=next;
    localObserver=null;
    if(root){
      localObserver=new MutationObserver(schedule);
      localObserver.observe(root,{subtree:true,childList:true,characterData:true});
    }
  }
  if(!root)return;
  root.classList.add('flow-onboarding-v2');
  const form=root.querySelector('.setup-sheet'),input=form?.querySelector('#school-search');
  if(!form||!input)return;
  if(input.placeholder!=='학교 이름 검색')input.placeholder='학교 이름 검색';
  input.setAttribute('enterkeyhint','search');
  input.setAttribute('autocomplete','off');
  const heading=form.querySelector('h2');
  if(heading?.textContent!=='학교 찾기')heading.textContent='학교 찾기';
  const description=form.querySelector(':scope > p');
  const about='학교를 선택하면 시간표와 급식, 학사일정을 연결해요.';
  if(description&&description.textContent!==about)description.textContent=about;
  if(!form.querySelector('#flow-school-search-hint')){
    const hint=document.createElement('p');
    hint.id='flow-school-search-hint';
    hint.className='flow-school-search-hint';
    hint.textContent='전국 초·중·고등학교를 검색할 수 있어요.';
    form.querySelector('.search-combo')?.after(hint);
  }
  input.setAttribute('aria-describedby','flow-school-search-hint');
  form.querySelectorAll('.school-search-results .search-option').forEach(button=>{
    const strong=button.querySelector('strong'),address=button.querySelector('small');
    if(!strong)return;
    button.dataset.schoolType=kindOf(strong.textContent);
    const name=strong.textContent.trim(),region=address?.textContent.trim()||'';
    const label=name+(region?' · '+region:'')+' 선택';
    if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  });
  const summary=form.querySelector('.selection-summary');
  const fields=form.querySelector('.two-fields');
  if(!summary||!fields){root.classList.remove('flow-school-chosen');return;}
  root.classList.add('flow-school-chosen');
  if(!summary.querySelector('.flow-school-reselect')){
    const change=document.createElement('button');
    change.type='button';change.className='flow-school-reselect';change.textContent='변경';
    change.setAttribute('aria-label','선택한 학교 변경');
    summary.append(change);
  }
  const name=Array.from(summary.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()||summary.textContent.trim();
  const kind=kindOf(name),maxGrade=kind==='elementary'?6:3;
  const select=fields.querySelector('select');
  if(select){
    const desired=Array.from({length:maxGrade},(_,i)=>String(i+1));
    const actual=Array.from(select.options).map(o=>o.value);
    if(desired.join(',')!==actual.join(',')){
      const before=select.value;
      select.replaceChildren(...desired.map(value=>new Option(value+'학년',value)));
      select.value=desired.includes(before)?before:'1';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    select.setAttribute('aria-label','학년');
  }
  const classInput=fields.querySelector('input');
  if(classInput){
    if(classInput.placeholder!=='반 번호')classInput.placeholder='반 번호';
    classInput.setAttribute('aria-label','반 번호');
    classInput.setAttribute('autocomplete','off');
  }
  let note=form.querySelector('.flow-school-choice-note');
  if(!note){
    note=document.createElement('p');note.className='flow-school-choice-note';
    summary.after(note);
  }
  const label=kind==='elementary'?'초등학교':kind==='middle'?'중학교':kind==='high'?'고등학교':'학교';
  const txt=label+' · '+(maxGrade===6?'1~6학년':'1~3학년')+' 선택';
  if(note.textContent!==txt)note.textContent=txt;
  const confirm=form.querySelector('.setup-complete');
  if(confirm?.textContent!=='이 학교로 시작하기')confirm.textContent='이 학교로 시작하기';
}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('pageshow',schedule);
schedule();
})();
