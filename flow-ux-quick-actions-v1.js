(() => {
  'use strict';
  // Uses the existing Leptos school-search endpoint, search result buttons,
  // and timetable override editor; never bypasses reactive state or persistence.
  let currentSetup=null,currentTimetable=null,scheduled=false;
  const getText=e=>e?.textContent?.trim()||'';
  function setup(next){
    if(!next||currentSetup===next)return;
    currentSetup=next;
    const input=next.querySelector('#school-search');
    const form=next.querySelector('.setup-sheet');
    const button=form?.querySelector('.search-combo button');
    const results=form?.querySelector('.school-search-results');
    if(!input||!button||!results)return;
    input.placeholder='학교 이름 검색';
    input.setAttribute('autocomplete','off');
    input.removeAttribute('aria-autocomplete');
    input.setAttribute('aria-label','학교 이름 검색');
    results.id='flow-school-autocomplete';
    input.setAttribute('aria-controls',results.id);
    button.setAttribute('aria-label','학교 검색');
    let timeout=0,composing=false;
    const visible=()=>next.classList.contains('flow-picker-editing')&&input.value.trim().length>=2;
    function sync(){
      const show=visible();
      results.setAttribute('aria-hidden',String(!show));
      input.removeAttribute('aria-expanded');
      results.querySelectorAll('button.search-option').forEach(b=>b.tabIndex=show?0:-1);
    }
    function run(){
      clearTimeout(timeout);
      if(composing)return;
      const q=input.value.trim();
      next.classList.add('flow-picker-editing');
      if(q.length<2){
        next.classList.remove('flow-has-query');
        sync();
        return;
      }
      next.classList.add('flow-has-query');
      sync();
      timeout=setTimeout(()=>{
        if(input.isConnected && input.value.trim()===q && q.length>=2){
          button.click(); // calls the original school search with live query
        }
      },280);
    }
    input.addEventListener('input',run);
    input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timeout);});
    input.addEventListener('compositionend',()=>{composing=false;run();});
    input.addEventListener('focus',()=>{
      next.classList.add('flow-picker-editing');
      next.classList.toggle('flow-has-query',input.value.trim().length>=2);
      sync();
    });
    input.addEventListener('keydown',e=>{
      if(e.isComposing||composing)return;
      if(e.key==='Enter'){clearTimeout(timeout);if(input.value.trim().length>=2){e.preventDefault();button.click();}}
      if(e.key==='ArrowDown'&&visible()){
        const first=results.querySelector('button.search-option');if(first){e.preventDefault();first.focus();}
      }
      if(e.key==='Escape'){
        clearTimeout(timeout);next.classList.remove('flow-picker-editing');
        sync();
      }
    });
    results.addEventListener('click',e=>{
      const option=e.target.closest('button.search-option');
      if(!option)return;
      clearTimeout(timeout);
      next.classList.remove('flow-picker-editing');
      input.blur();
      sync();
      requestAnimationFrame(()=>form.querySelector('.two-fields select')?.focus({preventScroll:true}));
    },true);
    results.addEventListener('keydown',e=>{
      const items=[...results.querySelectorAll('button.search-option')],i=items.indexOf(e.target);
      if(i<0)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();(items[i+(e.key==='ArrowDown'?1:-1)]||input).focus();
      }else if(e.key==='Escape'){e.preventDefault();input.focus();next.classList.remove('flow-picker-editing');sync();}
    });
    form.addEventListener('click',e=>{
      if(e.target.closest('.flow-school-reselect')){
        next.classList.add('flow-picker-editing');
        input.focus();
        input.select();
        sync();
      }
    });
    const observer=new MutationObserver(sync);
    observer.observe(results,{childList:true,subtree:false});
    sync();
  }
  function timetable(next){
    if(!next||currentTimetable===next)return;
    currentTimetable=next;
    const trigger=next.querySelector('.edit-timetable-trigger');
    if(!trigger)return;
    next.addEventListener('click',e=>{
      const row=e.target.closest('.class-row');
      if(!row||!next.contains(row))return;
      const period=Number(row.querySelector('.class-period')?.textContent);
      if(!Number.isInteger(period)||period<1||period>9)return;
      const open=next.querySelector('.timetable-editor');
      if(!open)trigger.click();
      requestAnimationFrame(()=>{
        const editor=next.querySelector('.timetable-editor');
        const target=editor?.querySelectorAll('.editor-periods button')[period-1];
        if(!target)return;
        target.click(); // original edit state and validation remain intact
        const scroll=editor.querySelector('.editor-periods');
        if(scroll)target.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
      });
    });
    next.addEventListener('keydown',e=>{
      const row=e.target.closest('.class-row');
      if(!row)return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}
    });
    const observer=new MutationObserver(()=>{
      for(const row of next.querySelectorAll('.class-row')){
        if(row.getAttribute('tabindex')!=='0')row.tabIndex=0;
        if(row.getAttribute('role')!=='button')row.setAttribute('role','button');
        const n=getText(row.querySelector('.class-period'));
        const subject=getText(row.querySelector('strong'));
        const label=n+'교시 '+subject+' 과목 수정';
        if(row.getAttribute('aria-label')!==label)row.setAttribute('aria-label',label);
      }
    });
    observer.observe(next,{childList:true,subtree:true});
    // Initial accessibility bindings.
    for(const row of next.querySelectorAll('.class-row')){
      row.tabIndex=0;row.setAttribute('role','button');
      row.setAttribute('aria-label',
        getText(row.querySelector('.class-period'))+'교시 '+
        getText(row.querySelector('strong'))+' 과목 수정');
    }
  }
  function reconcile(){
    setup(document.querySelector('.onboarding'));
    timetable(document.querySelector('.scene[data-scene="today"] .timetable-sheet'));
  }
  const observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;reconcile();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',reconcile);
  reconcile();
})();
