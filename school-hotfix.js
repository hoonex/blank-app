function collapseSpecialTimetableDay(){
  const box=document.querySelector('#timetable');
  if(!box)return;
  const rows=[...box.querySelectorAll('.period-button[data-period]')];
  if(rows.length<2)return;
  const names=rows.map(row=>row.querySelector('.period-name')?.textContent?.trim()||'').filter(Boolean);
  const specials=names.filter(name=>/(공휴일|휴업|방학|개교기념|재량휴업)/.test(name));
  if(!specials.length)return;
  const counts=new Map();
  for(const name of specials)counts.set(name,(counts.get(name)||0)+1);
  const [label,count]=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]||[];
  if(!label||count<2)return;
  const ordinary=names.filter(name=>name!==label&&name!=='선택과목'&&name!=='—');
  if(ordinary.length)return;
  const state=document.createElement('div');
  state.className='timetable-state';
  const strong=document.createElement('strong');strong.textContent=label;
  const span=document.createElement('span');span.textContent='학사일정';
  state.append(strong,span);
  box.replaceChildren(state);
  const quick=document.querySelector('#quickLessons');if(quick)quick.textContent='—';
  const sub=document.querySelector('#quickLessonSub');if(sub)sub.textContent=label;
}

const timetable=document.querySelector('#timetable');
if(timetable){
  new MutationObserver(()=>requestAnimationFrame(collapseSpecialTimetableDay)).observe(timetable,{childList:true,subtree:false});
}
requestAnimationFrame(collapseSpecialTimetableDay);
