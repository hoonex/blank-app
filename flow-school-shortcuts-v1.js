(() => {
  "use strict";
  // School-specific destinations must never appear for unrelated schools.
  // Links verified against official school navigation / supplied campus URL.
  const SCHOOL="정동고등학교";
  const LINKS=[
    {label:"학교 홈페이지",description:"정동고 공식 홈페이지",url:"https://jungdong.dge.hs.kr/"},
    {label:"리로스쿨",description:"정동고 리로스쿨",url:"https://jungdong.riroschool.kr/"},
    {label:"정동위키",description:"정동고 비공식 위키",url:"https://jungdong.wiki/"},
    {label:"3D 캠퍼스 지도",description:"정동 길찾기",url:"https://jungdong-campus-map.agfvrd.workers.dev/"}
  ];
  let pending=false;
  function build(){
    const school=document.querySelector('.flow-shell .scene[data-scene="school"] .school-sheet');
    if(!school)return;
    const heading=school.querySelector('h2');
    const name=heading?.textContent?.trim()||"";
    const existing=school.querySelector(':scope > .flow-school-shortcuts');
    if(name!==SCHOOL){existing?.remove();return;}
    if(existing)return;
    const section=document.createElement('section');
    section.className="flow-school-shortcuts";
    section.setAttribute("aria-label","정동고 바로가기");
    const title=document.createElement("h3");
    title.textContent="바로가기";
    const grid=document.createElement("div");
    grid.className="flow-school-shortcut-grid";
    for(const item of LINKS){
      const link=document.createElement("a");
      link.className="flow-school-shortcut";
      link.href=item.url;
      link.target="_blank";
      link.rel="noopener noreferrer";
      link.title=item.description;
      link.setAttribute("aria-label",item.description+" 새 탭에서 열기");
      const label=document.createElement("span");label.textContent=item.label;
      const arrow=document.createElement("span");
      arrow.className="flow-shortcut-arrow";
      arrow.textContent="↗";arrow.setAttribute("aria-hidden","true");
      link.append(label,arrow);
      grid.append(link);
    }
    section.append(title,grid);
    school.append(section);
  }
  const observer=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;build();});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  addEventListener("pageshow",build);
  build();
})();