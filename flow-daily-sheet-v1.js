(() => {
  'use strict';
  /*
   * FLOW DAILY SHEET / optional, event-driven enhancer.
   * Data contract: summarize only text already present in the current Today
   * view. Never call school/NEIS APIs or guess subjects, school hours or meals.
   * No new MutationObserver, polling loop, or persistent network request.
   */
  let pending=false;

  function create(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function getView(){
    const scene=document.querySelector('.flow-shell .scene[data-scene="today"]');
    if(!scene)return null;
    const date=clean(scene.querySelector('.hero-numeral')?.textContent);
    const weekday=clean(scene.querySelector('.hero-weekday')?.textContent);
    const school=clean(scene.querySelector('.hero-school')?.textContent);
    const subjects=[...scene.querySelectorAll('.class-rows .class-row')]
      .filter(x=>!x.closest('[hidden]'))
      .map(x=>({
        period:clean(x.querySelector('.class-period')?.textContent),
        name:clean(x.querySelector('strong')?.textContent)
      })).filter(x=>x.name);
    const mealDate=clean(scene.querySelector('.flow-meal-detail-heading span')?.textContent);
    const dishes=[...scene.querySelectorAll('.flow-meal-main .flow-meal-chip')]
      .map(x=>clean(x.textContent)).filter(Boolean);
    return {date,weekday,school,subjects,mealDate,dishes};
  }
  function toText(v){
    const lines=['Flow School · 선택한 날짜 요약',v.school,v.date+' '+v.weekday,''];
    lines.push('수업 ('+v.subjects.length+'개)');
    if(v.subjects.length)for(const x of v.subjects)lines.push(x.period+'교시 · '+x.name);
    else lines.push('표시된 수업 정보가 없습니다.');
    lines.push('',v.mealDate||'급식');
    if(v.dishes.length)for(const item of v.dishes)lines.push('· '+item);
    else lines.push('표시된 급식 정보가 없습니다.');
    lines.push('','※ 화면에 표시된 정보 기준. 학교 공지 및 실제 급식은 변경될 수 있습니다.');
    return lines.join('\n');
  }
  function section(title,count){
    const wrap=create('section','flow-brief-section');
    const h=create('h3','',title);
    h.append(create('small','',count));
    wrap.append(h);
    return wrap;
  }
  function open(trigger){
    const view=getView();
    if(!view)return;
    const previous=document.querySelector('.flow-brief-dialog');
    if(previous){try{previous.close()}catch(_){}previous.remove()}
    const dialog=create('dialog','flow-brief-dialog');
    dialog.setAttribute('aria-label','선택한 날짜 하루 요약');
    const inner=create('div','flow-brief-inner');
    const head=create('header','flow-brief-header');
    const intro=create('div','');
    intro.append(create('span','flow-brief-kicker','FLOW / DAY SHEET'));
    intro.append(create('h2','',view.date+' '+view.weekday));
    intro.append(create('p','flow-brief-school',view.school||'선택한 학교'));
    const close=create('button','flow-brief-close','×');close.type='button';
    close.setAttribute('aria-label','요약 닫기');
    close.addEventListener('click',()=>dialog.close());
    head.append(intro,close);
    inner.append(head);

    const classes=section('시간표',view.subjects.length+'개 수업');
    if(view.subjects.length){
      const list=create('ul','flow-brief-subjects');
      for(const entry of view.subjects){
        const li=create('li','');
        li.append(create('small','',entry.period),create('strong','',entry.name));
        list.append(li);
      }
      classes.append(list);
    }else classes.append(create('p','flow-brief-empty','표시된 하루 수업이 없어요.'));
    inner.append(classes);

    const meals=section('급식',view.mealDate||'선택한 날짜');
    if(view.dishes.length){
      const list=create('ul','flow-brief-meals');
      for(const dish of view.dishes)list.append(create('li','',dish));
      meals.append(list);
    }else meals.append(create('p','flow-brief-empty','표시된 급식 메뉴가 없어요.'));
    inner.append(meals);

    const actions=create('div','flow-brief-actions');
    const copy=create('button','','텍스트 복사');copy.type='button';
    const share=create('button','','기기로 공유');share.type='button';
    if(typeof navigator.share!=='function')share.hidden=true;
    actions.append(copy,share);
    inner.append(actions);
    const status=create('p','flow-brief-status');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    inner.append(status);
    inner.append(create('p','flow-brief-disclaimer',
      '이 요약은 현재 화면에 표시된 데이터만 사용합니다. 학교 공지와 실제 급식 정보가 우선입니다.'));
    const payload=toText(view);

    copy.addEventListener('click',async()=>{
      let ok=false;
      try{
        if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(payload);ok=true;
        }
      }catch(_){}
      if(!ok){
        const field=create('textarea','');
        field.value=payload;
        field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.append(field);field.select();
        try{ok=document.execCommand('copy')}catch(_){}
        field.remove();
      }
      status.textContent=ok?'요약을 복사했어요.':'복사가 허용되지 않았어요. 다시 시도해 주세요.';
    });
    share.addEventListener('click',async()=>{
      if(typeof navigator.share!=='function')return;
      try{
        await navigator.share({title:'Flow School · 하루 요약',text:payload});
        status.textContent='공유가 완료됐어요.';
      }catch(e){
        if(e?.name!=='AbortError')status.textContent='기기 공유에 실패했어요. 텍스트 복사를 이용해 주세요.';
      }
    });
    dialog.append(inner);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{
      dialog.remove();
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    },{once:true});
    try{dialog.showModal()}
    catch(_){dialog.remove()}
  }

  function mount(){
    const controls=document.querySelector('.flow-shell .scene[data-scene="today"] .timetable-sheet .module-controls');
    if(!controls || controls.querySelector('.flow-brief-open'))return;
    const button=create('button','flow-brief-open','공유');
    button.type='button';
    button.setAttribute('aria-label','선택 날짜 수업과 급식을 한 장으로 공유');
    button.addEventListener('click',()=>open(button));
    controls.insertBefore(button,controls.querySelector('.switch-track')||null);
  }
  function queueMount(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;mount()});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('.mobile-bottom,.rail-navigation,.day-strip,.switch-track')){
      setTimeout(queueMount,60);
    }
  },{capture:true,passive:true});
  addEventListener('TrunkApplicationStarted',()=>setTimeout(queueMount,70));
  addEventListener('pageshow',queueMount);
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',queueMount,{once:true});
  else queueMount();
  // Bounded boot-only retries: Rust/Wasm can initialize after DOM readiness.
  setTimeout(queueMount,350);
  setTimeout(queueMount,1100);
})();
