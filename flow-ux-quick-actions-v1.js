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
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-label','학교 이름 검색');
    results.id='flow-school-autocomplete';
    input.setAttribute('aria-controls',results.id);
    button.setAttribute('aria-label','학교 검색');
    let timeout=0,latest='';
    function run(){
      clearTimeout(timeout);
      const q=input.value.trim();
      latest=q;
      next.classList.add('flow-picker-editing');
      if(q.length<2){
        next.classList.remove('flow-has-query');
        results.setAttribute('aria-hidden','true');
        return;
      }
      next.classList.add('flow-has-query');
      results.removeAttribute('aria-hidden');
      timeout=setTimeout(()=>{
        if(input.isConnected && input.value.trim()===q && q.length>=2){
          button.click(); // calls the original school search with live query
        }
      },280);
    }
    input.addEventListener('input',run);
    input.addEventListener('focus',()=>{
      next.classList.add('flow-picker-editing');
      next.classList.toggle('flow-has-query',input.value.trim().length>=2);
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){clearTimeout(timeout);}
      if(e.key==='Escape'){
        clearTimeout(timeout);next.classList.remove('flow-picker-editing');
        input.blur();
      }
    });
    results.addEventListener('click',e=>{
      const option=e.target.closest('button.search-option');
      if(!option)return;
      clearTimeout(timeout);
      next.classList.remove('flow-picker-editing');
      input.blur();
    },true);
    form.addEventListener('click',e=>{
      if(e.target.closest('.selection-summary')){
        next.classList.add('flow-picker-editing');
        input.focus();
      }
    });
    const observer=new MutationObserver(()=>{
      const total=results.querySelectorAll('.search-option').length;
      input.setAttribute('aria-expanded',String(total>0&&next.classList.contains('flow-picker-editing')));
    });
    observer.observe(results,{childList:true,subtree:false});
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