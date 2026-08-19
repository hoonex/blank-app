const BRAND_RULES=[
  {key:'cu',label:'CU',match:(v)=>v.startsWith('cu')||v.includes('씨유')},
  {key:'gs25',label:'GS25',match:(v)=>v.includes('gs25')},
  {key:'seven',label:'7',match:(v)=>v.includes('세븐일레븐')||v.includes('7eleven')||v.includes('7-eleven')},
  {key:'emart24',label:'emart24',match:(v)=>v.includes('이마트24')||v.includes('emart24')},
  {key:'storyway',label:'StoryWay',match:(v)=>v.includes('스토리웨이')||v.includes('storyway')},
];

export function poiBrand(name=''){
  const compact=String(name).replace(/\s+/g,'').toLowerCase();
  return BRAND_RULES.find((rule)=>rule.match(compact))||null;
}

export function poiIconSvg(type='stores'){
  const common='viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  if(type==='cafes')return `<svg ${common}><path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 5h5"/></svg>`;
  if(type==='dining')return `<svg ${common}><path d="M4 17h16M6 15a6 6 0 0 1 12 0M12 9V6M10 6h4"/></svg>`;
  if(type==='food')return `<svg ${common}><path d="M7 4v7M4.5 4v4.5A2.5 2.5 0 0 0 7 11M9.5 4v4.5A2.5 2.5 0 0 1 7 11v9M16 4v16M16 4c2 1.6 3 3.6 3 6h-3"/></svg>`;
  return `<svg ${common}><path d="M4 10v9h16v-9M3 10l2-5h14l2 5M8 19v-5h5v5M3 10h18"/></svg>`;
}

export function poiBadgeMarkup(type,item={}){
  const brand=type==='stores'?poiBrand(item?.name):null;
  if(brand)return `<span class="campus-poi-badge brand-${brand.key}" data-poi-brand="${brand.key}" aria-hidden="true"><span>${brand.label}</span></span>`;
  return `<span class="campus-poi-badge kind-${type}" data-poi-kind="${type}" aria-hidden="true">${poiIconSvg(type)}</span>`;
}

export function decoratePoiNode(node,type,item={}){
  const brand=type==='stores'?poiBrand(item?.name):null;
  node.title=String(item?.name||'');
  node.setAttribute('aria-label',String(item?.name||'주변 장소'));
  if(brand){
    node.classList.add(`brand-${brand.key}`);
    node.dataset.poiBrand=brand.key;
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
