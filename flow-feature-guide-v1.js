(() => {
  'use strict';
  const KEY='flow-school-guide-v1';
  const slides=[
    {k:'오늘',title:'학교생활을\n한눈에',detail:'시간표와 급식, 학사일정까지.\n오늘 필요한 정보부터 바로 확인해요.',layout:0},
    {k:'날짜 이동',title:'당길수록\n빠르게',detail:'손잡이를 오른쪽으로 당기면 날짜 줄은 왼쪽으로 이동해요.\n놓으면 선택될 날짜가 자연스럽게 중앙으로 와요.',layout:1},
    {k:'일정',title:'달력과\n이번 달 일정',detail:'달력을 좌우로 넘기고, 아래에서 이번 달의 모든 학사일정을 날짜순으로 확인해요.',layout:2},
    {k:'버스',title:'가까운 정류장\n3곳을 바로',detail:'대구 버스 기준. 내 위치를 사용하면 가까운 정류장 3곳을 보여줘요.\n선택하면 도착정보와 정류장 지도가 열려요.',layout:3}
  ];
  const node=(tag,cls,content)=>{
    const e=document.createElement(tag);if(cls)e.className=cls;
    if(content!==undefined)e.textContent=content;return e;
  };
  let modal=null,index=0,before=null,oldOverflow='',scheduled=false,firstChecked=false;
  function preview(id){
    const p=node('div','flow-guide-visual flow-guide-visual-'+id);
    if(id===0){
      p.append(node('small','','오늘의 학교생활'),node('strong','flow-guide-big-date','11.15'));
      const days=node('div','flow-guide-demo-days');
      for(const day of ['12','13','14','15','16']){
        days.append(node('span',day==='15'?'active':'',day));
      }
      p.append(days,node('div','flow-guide-demo-item','오늘의 수업 · 급식 · 일정'));
    } else if(id===1){
      p.append(node('small','','날짜 스크롤'));
      const days=node('div','flow-guide-demo-days');
      for(const day of ['12','13','14','15','16'])days.append(node('span',day==='15'?'active':'',day));
      p.append(days,node('div','flow-guide-demo-drag','← 날짜 줄　　　 손잡이 →'));
    } else if(id===2){
      p.append(node('small','','2026년 11월'));
      const grid=node('div','flow-guide-demo-calendar');
      for(const t of ['일','월','화','수','목','금','토'])grid.append(node('span','day',t));
      for(let i=1;i<=21;i++)grid.append(node('span',i===15?'active':'',String(i).padStart(2,'0')));
      p.append(grid,node('div','flow-guide-demo-item','07 · 학사일정   /   14 · 학교행사'));
    } else {
      p.append(node('small','','근처 정류장 · 대구 버스'));
      for(let i=1;i<=3;i++){
        const r=node('div','flow-guide-demo-stop');
        r.append(node('span','',String(i).padStart(2,'0')),node('strong','','정류장 '+i),node('span','','선택'));
        p.append(r);
      }
      p.append(node('div','flow-guide-demo-item','내 위치는 허용할 때만 사용돼요'));
    }
    return p;
  }
  function draw(n){
    if(!modal)return;
    index=Math.max(0,Math.min(n,slides.length-1));
    const data=slides[index];
    [...modal.querySelector('.flow-guide-progress').children].forEach((bar,i)=>{
      bar.classList.toggle('current',i===index);bar.classList.toggle('done',i<index);
    });
    modal.querySelector('.flow-guide-preview').replaceChildren(preview(data.layout));
    modal.querySelector('.flow-guide-step').textContent=String(index+1).padStart(2,'0')+' / 04 · '+data.k;
    modal.querySelector('.flow-guide-title').textContent=data.title;
    modal.querySelector('.flow-guide-detail').textContent=data.detail;
    modal.querySelector('.flow-guide-next').textContent=index===3?'시작하기':'다음';
    modal.querySelector('.flow-guide-prev').hidden=index===0;
  }
  function close(){
    if(!modal)return;
    try{localStorage.setItem(KEY,'done');}catch(_){}
    modal.remove();modal=null;
    document.documentElement.classList.remove('flow-guide-active');
    document.body.style.overflow=oldOverflow;
    if(before?.isConnected)before.focus({preventScroll:true});
  }
  function open(){
    if(modal||!document.querySelector('.flow-shell'))return;
    before=document.activeElement;oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    document.documentElement.classList.add('flow-guide-active');
    const overlay=node('section','flow-guide');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Flow School 사용 가이드');
    const head=node('header','flow-guide-head');
    const dismiss=node('button','flow-guide-close');
    dismiss.append(window.FlowActionIcons.create('close'));
    dismiss.type='button';dismiss.setAttribute('aria-label','가이드 닫기');
    dismiss.addEventListener('click',close);
    const progress=node('div','flow-guide-progress');
    for(let i=0;i<slides.length;i++)progress.append(node('i'));
    head.append(dismiss,progress);
    const body=node('div','flow-guide-body');
    const number=node('div','flow-guide-step');
    const visual=node('div','flow-guide-preview');
    const copy=node('div','flow-guide-copy');
    const title=node('h2','flow-guide-title');
    const detail=node('p','flow-guide-detail');
    copy.append(title,detail);
    const controls=node('footer','flow-guide-controls');
    const prev=node('button','flow-guide-prev','이전');
    prev.type='button';prev.addEventListener('click',()=>draw(index-1));
    const next=node('button','flow-guide-next','다음');
    next.type='button';next.addEventListener('click',()=>index===3?close():draw(index+1));
    controls.append(prev,next);
    body.append(number,visual,copy,controls);overlay.append(head,body);
    document.body.append(overlay);modal=overlay;draw(0);
    dismiss.focus({preventScroll:true});
    overlay.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();}
      if(e.key==='ArrowRight'){e.preventDefault();draw(index+1);}
      if(e.key==='ArrowLeft'){e.preventDefault();draw(index-1);}
      if(e.key==='Tab'){
        const available=[dismiss,prev,next].filter(b=>!b.hidden);
        if(e.shiftKey&&document.activeElement===available[0]){
          e.preventDefault();available[available.length-1].focus();
        }else if(!e.shiftKey&&document.activeElement===available[available.length-1]){
          e.preventDefault();available[0].focus();
        }
      }
    });
  }
  function addLaunchers(){
    const settings=document.querySelector('.scene[data-scene="settings"] .settings-sheet');
    if(settings&&!settings.querySelector('.flow-guide-setting')){
      const row=node('div','setting-row flow-guide-setting');
      const title=node('div');
      title.append(node('strong','','사용 방법'),node('small','','처음 사용 가이드를 다시 볼 수 있어요.'));
      const button=node('button','setting-toggle','가이드 보기');
      button.type='button';button.addEventListener('click',open);
      row.append(title,button);settings.append(row);
    }
    const nearby=document.querySelector('.scene[data-scene="school"] .flow-nearby-heading');
    if(nearby&&!nearby.querySelector('.flow-guide-help')){
      const button=node('button','flow-guide-help');
      button.append(window.FlowActionIcons.create('help'));
      button.type='button';button.setAttribute('aria-label','버스 기능 도움말');
      button.addEventListener('click',()=>{open();draw(3);});
      nearby.append(button);
    }
  }
  function reconcile(){
    addLaunchers();
    if(firstChecked||!document.querySelector('.flow-shell .scene'))return;
    firstChecked=true;
    try{if(localStorage.getItem(KEY)==='done')return;}catch(_){}
    setTimeout(()=>{if(document.querySelector('.flow-shell .scene'))open();},850);
  }
  new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;reconcile();});
  }).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',reconcile);
  reconcile();
})();
