const BRAND_RULES=[
  {key:'cu',types:['stores'],label:'CU',match:(v)=>v.startsWith('cu')||v.includes('씨유'),style:{background:'#7b2cbf',color:'#fff',border:'#7b2cbf'}},
  {key:'gs25',types:['stores'],label:'GS25',match:(v)=>v.includes('gs25'),style:{background:'#1477d4',color:'#fff',border:'#1477d4',width:38}},
  {key:'seven',types:['stores'],label:'7',match:(v)=>v.includes('세븐일레븐')||v.includes('7eleven')||v.includes('7-eleven'),style:{background:'#14824a',color:'#fff',border:'#14824a'}},
  {key:'emart24',types:['stores'],label:'emart24',match:(v)=>v.includes('이마트24')||v.includes('emart24'),style:{background:'#f6c900',color:'#171717',border:'#e7bc00',width:46}},
  {key:'storyway',types:['stores'],label:'StoryWay',match:(v)=>v.includes('스토리웨이')||v.includes('storyway'),style:{background:'#2773c8',color:'#fff',border:'#2773c8',width:50}},
  {key:'starbucks',types:['cafes'],label:'STARBUCKS',match:(v)=>v.includes('스타벅스')||v.includes('starbucks'),style:{background:'#00754a',color:'#fff',border:'#00754a',width:58}},
  {key:'mega',types:['cafes'],label:'MEGA',match:(v)=>v.includes('메가mgc')||v.includes('메가커피')||v.includes('megamgc')||v.includes('megacoffee'),style:{background:'#ffd400',color:'#151515',border:'#e6bf00',width:42}},
  {key:'compose',types:['cafes'],label:'COMPOSE',match:(v)=>v.includes('컴포즈커피')||v.includes('컴포즈')||v.includes('composecoffee'),style:{background:'#f4cf00',color:'#161616',border:'#dbb900',width:55}},
  {key:'ediya',types:['cafes'],label:'EDIYA',match:(v)=>v.includes('이디야')||v.includes('ediya'),style:{background:'#173f8a',color:'#fff',border:'#173f8a',width:44}},
  {key:'paik',types:['cafes'],label:'PAIK',match:(v)=>v.includes('빽다방')||v.includes('paik')||v.includes('paikscoffee'),style:{background:'#1769aa',color:'#ffe442',border:'#1769aa',width:40}},
  {key:'twosome',types:['cafes'],label:'TWOSOME',match:(v)=>v.includes('투썸플레이스')||v.includes('투썸')||v.includes('atwosomeplace')||v.includes('twosome'),style:{background:'#8b1538',color:'#fff',border:'#8b1538',width:56}},
];

export function poiBrand(name='',type='stores'){
  const compact=String(name).replace(/\s+/g,'').toLowerCase();
  return BRAND_RULES.find((rule)=>rule.types.includes(type)&&rule.match(compact))||null;
}

export function poiIconSvg(type='stores'){
  const common='viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  if(type==='cafes')return `<svg ${common}><path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 5h5"/></svg>`;
  if(type==='dining')return `<svg ${common}><path d="M4 17h16M6 15a6 6 0 0 1 12 0M12 9V6M10 6h4"/></svg>`;
  if(type==='food')return `<svg ${common}><path d="M7 4v7M4.5 4v4.5A2.5 2.5 0 0 0 7 11M9.5 4v4.5A2.5 2.5 0 0 1 7 11v9M16 4v16M16 4c2 1.6 3 3.6 3 6h-3"/></svg>`;
  return `<svg ${common}><path d="M4 10v9h16v-9M3 10l2-5h14l2 5M8 19v-5h5v5M3 10h18"/></svg>`;
}

function brandStyleString(brand){
  if(!brand?.style)return'';
  const s=brand.style;
  return `background:${s.background};color:${s.color};border-color:${s.border};${s.width?`width:${s.width}px;`:''}`;
}

function applyBrandStyle(node,brand){
  const s=brand?.style;
  if(!s)return;
  node.style.background=s.background;
  node.style.color=s.color;
  node.style.borderColor=s.border;
  if(s.width)node.style.width=`${s.width}px`;
}

export function poiBadgeMarkup(type,item={}){
  const brand=poiBrand(item?.name,type);
  if(brand)return `<span class="campus-poi-badge brand-${brand.key}" data-poi-brand="${brand.key}" style="${brandStyleString(brand)}" aria-hidden="true"><span>${brand.label}</span></span>`;
  return `<span class="campus-poi-badge kind-${type}" data-poi-kind="${type}" aria-hidden="true">${poiIconSvg(type)}</span>`;
}

export function decoratePoiNode(node,type,item={}){
  const brand=poiBrand(item?.name,type);
  node.title=String(item?.name||'');
  node.setAttribute('aria-label',String(item?.name||'주변 장소'));
  if(brand){
    node.classList.add(`brand-${brand.key}`);
    node.dataset.poiBrand=brand.key;
    applyBrandStyle(node,brand);
    const text=document.createElement('span');
    text.className='flow-poi-brand-text';
    text.textContent=brand.label;
    node.replaceChildren(text);
    return brand;
  }
  node.classList.add(`kind-${type}`);
  node.dataset.poiKind=type;
  node.innerHTML=poiIconSvg(type);
  return null;
}
