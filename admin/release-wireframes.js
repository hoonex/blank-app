(()=>{
  const releases=window.FLOW_ADMIN_RELEASES||[];
  const map=window.FLOW_ADMIN_UI_MAP||{nodes:[],edges:[],width:2400,height:1400};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const state={release:releases[0]?.version||'',search:'',status:'all',mapVersion:'all',platform:'all',selectedNode:'',scale:.62,x:24,y:24,panning:false,pointerId:null,startX:0,startY:0,originX:0,originY:0};
  let viewport=null,world=null,minimap=null,frame=0;

  function ensureStyles(){
    if(document.querySelector('link[data-admin-release-wireframes]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='/admin/release-wireframes.css';link.dataset.adminReleaseWireframes='true';document.head.append(link);
  }

  function injectNav(){
    const nav=$('.section-nav');if(!nav)return;
    const entries=[['releases','릴리즈'],['wireframes','UI/UX 맵']];
    for(const [id,label] of entries){if(nav.querySelector(`a[href="#${id}"]`))continue;const a=document.createElement('a');a.href=`#${id}`;a.textContent=label;nav.append(a)}
  }

  function injectSections(){
    const dashboard=$('#dashboard');if(!dashboard||$('#releases')||$('#wireframes'))return;
    const architecture=$('#architecture');
    const releasesSection=document.createElement('section');
    releasesSection.className='panel release-console';releasesSection.id='releases';
    releasesSection.innerHTML=`
      <div class="panel-head"><div><span class="eyebrow">RELEASE HISTORY</span><h2>버전별 패치노트</h2><p>Production과 candidate 릴리즈를 버전 단위로 보고, 변경된 화면을 UI/UX 맵에서 바로 강조합니다.</p></div><span class="panel-meta" id="releaseCount">—</span></div>
      <div class="release-toolbar">
        <input id="releaseSearch" type="search" placeholder="버전, 화면, 변경 내용 검색" aria-label="패치노트 검색">
        <select id="releaseStatusFilter" aria-label="릴리즈 상태"><option value="all">전체 상태</option><option value="production">Production</option><option value="candidate">Candidate</option></select>
      </div>
      <div class="release-layout"><div class="release-list" id="releaseList"></div><div class="release-detail" id="releaseDetail"></div></div>`;

    const wireframeSection=document.createElement('section');
    wireframeSection.className='panel wireframe-console';wireframeSection.id='wireframes';
    wireframeSection.innerHTML=`
      <div class="panel-head"><div><span class="eyebrow">UI / UX MAP</span><h2>와이어프레임 구조도</h2><p>화면 간 이동, 반응형 관계, 운영 계층을 한 캔버스에서 확대·축소하고 드래그해서 확인합니다.</p></div><span class="panel-meta">${map.nodes.length} nodes</span></div>
      <div class="wireframe-toolbar">
        <select id="wireframeVersion" aria-label="강조할 버전"><option value="all">모든 버전</option>${releases.map(r=>`<option value="${esc(r.version)}">${esc(r.version)}</option>`).join('')}</select>
        <select id="wireframePlatform" aria-label="플랫폼 필터"><option value="all">모든 플랫폼</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option><option value="system">System</option></select>
        <div class="wireframe-tools">
          <button id="wireframeZoomOut" type="button" aria-label="축소">−</button><span class="zoom-readout" id="wireframeZoomReadout">62%</span><button id="wireframeZoomIn" type="button" aria-label="확대">＋</button>
          <button id="wireframeFit" type="button">Fit</button><button id="wireframeReset" type="button">Reset</button><button id="wireframeFullscreen" type="button">전체화면</button>
        </div>
      </div>
      <div class="wireframe-layout">
        <div class="wireframe-viewport" id="wireframeViewport" tabindex="0" aria-label="Flow UI/UX 와이어프레임 캔버스">
          <div class="wireframe-world" id="wireframeWorld"><svg class="wireframe-edges" id="wireframeEdges" viewBox="0 0 ${map.width} ${map.height}" aria-hidden="true"></svg><div id="wireframeNodes"></div></div>
          <div class="wireframe-legend"><span><i></i>기본 화면</span><span class="changed"><i></i>선택 버전 변경 화면</span></div>
          <div class="wireframe-minimap" id="wireframeMinimap" aria-hidden="true"></div>
        </div>
        <aside class="wireframe-inspector" id="wireframeInspector"><div class="inspector-empty">노드를 선택하면 화면 역할과 연결된 릴리즈를 표시합니다.</div></aside>
      </div>`;

    if(architecture){dashboard.insertBefore(releasesSection,architecture);dashboard.insertBefore(wireframeSection,architecture)}else{dashboard.append(releasesSection,wireframeSection)}
  }

  function releaseMatches(release){
    if(state.status!=='all'&&release.status!==state.status)return false;
    const q=state.search.trim().toLowerCase();if(!q)return true;
    return [release.version,release.title,release.summary,...release.tags,...release.changes.flatMap(c=>[c.area,c.title,c.detail])].join(' ').toLowerCase().includes(q)
  }
  function renderReleaseList(){
    const list=$('#releaseList');if(!list)return;const items=releases.filter(releaseMatches);$('#releaseCount').textContent=`${items.length} versions`;
    if(!items.length){list.innerHTML='<div class="release-empty">검색 조건에 맞는 릴리즈가 없습니다.</div>';$('#releaseDetail').innerHTML='<div class="release-empty">릴리즈를 선택하세요.</div>';return}
    if(!items.some(r=>r.version===state.release))state.release=items[0].version;
    list.innerHTML=items.map(r=>`<button class="release-card" type="button" data-release="${esc(r.version)}" aria-selected="${r.version===state.release}"><div class="release-card-top"><span class="release-version">${esc(r.version)}</span><span class="release-state ${esc(r.status)}">${esc(r.status)}</span></div><strong>${esc(r.title)}</strong><p>${esc(r.summary)}</p><div class="release-card-meta"><span>${esc(r.date)}</span><span>PR #${esc(r.pullRequest)}</span><span>${r.changes.length} changes</span></div></button>`).join('');
    renderReleaseDetail();
  }
  function renderReleaseDetail(){
    const detail=$('#releaseDetail');if(!detail)return;const r=releases.find(item=>item.version===state.release);if(!r){detail.innerHTML='<div class="release-empty">릴리즈를 선택하세요.</div>';return}
    detail.innerHTML=`<div class="release-detail-head"><div><span class="eyebrow">${esc(r.version)} · ${esc(r.status.toUpperCase())}</span><h3>${esc(r.title)}</h3><p>${esc(r.summary)}</p><div class="release-tags">${r.tags.map(tag=>`<span class="release-tag">${esc(tag)}</span>`).join('')}</div></div><div class="release-detail-actions"><button type="button" data-map-release="${esc(r.version)}">와이어프레임에서 보기</button>${r.pullRequest?`<button type="button" data-open-pr="${r.pullRequest}">PR #${r.pullRequest}</button>`:''}</div></div><div class="change-list">${r.changes.map(c=>`<article class="change-row"><span class="change-type">${esc(c.type)}</span><span class="change-area">${esc(c.area)}</span><div class="change-copy"><strong>${esc(c.title)}</strong><p>${esc(c.detail)}</p></div></article>`).join('')}</div>`;
  }

  function nodeById(id){return map.nodes.find(n=>n.id===id)}
  function isPlatformVisible(node){return state.platform==='all'||node.platform.includes(state.platform)}
  function isVersionChanged(node){return state.mapVersion==='all'||node.releases.includes(state.mapVersion)}
  function edgePath(source,target){
    const sx=source.x+source.w/2,sy=source.y+source.h/2,tx=target.x+target.w/2,ty=target.y+target.h/2,dx=tx-sx,dy=ty-sy;
    if(Math.abs(dx)>=Math.abs(dy)){const dir=dx>=0?1:-1;const a={x:sx+dir*source.w/2,y:sy},b={x:tx-dir*target.w/2,y:ty},bend=Math.max(90,Math.abs(b.x-a.x)*.42);return{d:`M ${a.x} ${a.y} C ${a.x+dir*bend} ${a.y}, ${b.x-dir*bend} ${b.y}, ${b.x} ${b.y}`,lx:(a.x+b.x)/2,ly:(a.y+b.y)/2-8}}
    const dir=dy>=0?1:-1,a={x:sx,y:sy+dir*source.h/2},b={x:tx,y:ty-dir*target.h/2},bend=Math.max(70,Math.abs(b.y-a.y)*.42);return{d:`M ${a.x} ${a.y} C ${a.x} ${a.y+dir*bend}, ${b.x} ${b.y-dir*bend}, ${b.x} ${b.y}`,lx:(a.x+b.x)/2+8,ly:(a.y+b.y)/2}
  }
  function renderMap(){
    const nodes=$('#wireframeNodes'),edges=$('#wireframeEdges');if(!nodes||!edges)return;
    nodes.innerHTML=map.nodes.map(node=>{const visible=isPlatformVisible(node),changed=isVersionChanged(node);return`<button class="wireframe-node${node.id===state.selectedNode?' is-selected':''}${state.mapVersion!=='all'&&changed?' is-changed':''}${!visible||state.mapVersion!=='all'&&!changed?' is-dimmed':''}" type="button" data-node="${esc(node.id)}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px" aria-label="${esc(node.title)}"><span class="node-group">${esc(node.group)}</span><div><h3>${esc(node.title)}</h3><p>${esc(node.subtitle)}</p></div><div class="node-platforms">${node.platform.map(p=>`<span>${esc(p)}</span>`).join('')}</div></button>`}).join('');
    edges.innerHTML=map.edges.map(edge=>{const source=nodeById(edge.source),target=nodeById(edge.target);if(!source||!target)return'';const path=edgePath(source,target),active=(state.mapVersion==='all'||source.releases.includes(state.mapVersion)||target.releases.includes(state.mapVersion))&&isPlatformVisible(source)&&isPlatformVisible(target);return`<path class="wireframe-edge${active?' is-active':''}" d="${path.d}"/><text class="wireframe-edge-label" x="${path.lx}" y="${path.ly}">${esc(edge.label)}</text>`}).join('');
    renderInspector();renderMinimap();
  }
  function renderInspector(){
    const el=$('#wireframeInspector');if(!el)return;const node=nodeById(state.selectedNode);if(!node){el.innerHTML='<div class="inspector-empty">노드를 선택하면 화면 역할과 연결된 릴리즈를 표시합니다.</div>';return}
    const linked=map.edges.filter(e=>e.source===node.id||e.target===node.id).map(e=>({edge:e,node:nodeById(e.source===node.id?e.target:e.source)})).filter(x=>x.node);
    const rel=releases.filter(r=>node.releases.includes(r.version));
    el.innerHTML=`<span class="inspector-group">${esc(node.group)}</span><h3>${esc(node.title)}</h3><p>${esc(node.subtitle)}</p><div class="node-platforms" style="margin-top:12px">${node.platform.map(p=>`<span>${esc(p)}</span>`).join('')}</div><div class="inspector-section"><strong>연결 화면</strong><div class="inspector-links">${linked.length?linked.map(x=>`<button class="inspector-link" type="button" data-inspector-node="${esc(x.node.id)}"><span>${esc(x.node.title)}</span><small>${esc(x.edge.label)}</small></button>`).join(''):'<span class="empty">직접 연결 없음</span>'}</div></div><div class="inspector-section"><strong>관련 릴리즈</strong><div class="inspector-links">${rel.length?rel.map(r=>`<button class="inspector-link" type="button" data-inspector-release="${esc(r.version)}"><span>${esc(r.version)}</span><small>${esc(r.status)}</small></button>`).join(''):'<span class="empty">기록된 변경 없음</span>'}</div></div>`;
  }

  function applyTransform(){
    frame=0;if(!world||!viewport)return;world.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;const readout=$('#wireframeZoomReadout');if(readout)readout.textContent=`${Math.round(state.scale*100)}%`;renderMinimap()
  }
  function queueTransform(){if(frame)return;frame=requestAnimationFrame(applyTransform)}
  function setScale(next,cx=viewport?.clientWidth/2||0,cy=viewport?.clientHeight/2||0){
    const old=state.scale,newScale=clamp(next,.24,1.8);if(Math.abs(newScale-old)<.0001)return;const wx=(cx-state.x)/old,wy=(cy-state.y)/old;state.scale=newScale;state.x=cx-wx*newScale;state.y=cy-wy*newScale;queueTransform()
  }
  function fitMap(){
    if(!viewport)return;const visible=map.nodes.filter(isPlatformVisible).filter(n=>state.mapVersion==='all'||n.releases.includes(state.mapVersion));const targets=visible.length?visible:map.nodes;if(!targets.length)return;
    const minX=Math.min(...targets.map(n=>n.x)),minY=Math.min(...targets.map(n=>n.y)),maxX=Math.max(...targets.map(n=>n.x+n.w)),maxY=Math.max(...targets.map(n=>n.y+n.h)),bw=maxX-minX,bh=maxY-minY,pad=64;
    state.scale=clamp(Math.min((viewport.clientWidth-pad*2)/bw,(viewport.clientHeight-pad*2)/bh),.24,1.35);state.x=(viewport.clientWidth-bw*state.scale)/2-minX*state.scale;state.y=(viewport.clientHeight-bh*state.scale)/2-minY*state.scale;queueTransform()
  }
  function resetMap(){state.scale=.62;state.x=24;state.y=24;queueTransform()}
  function renderMinimap(){
    if(!minimap||!viewport)return;const vx=(-state.x)/state.scale,vy=(-state.y)/state.scale,vw=viewport.clientWidth/state.scale,vh=viewport.clientHeight/state.scale;
    minimap.innerHTML=`<svg viewBox="0 0 ${map.width} ${map.height}" preserveAspectRatio="none">${map.nodes.map(n=>`<rect class="minimap-node${state.mapVersion!=='all'&&n.releases.includes(state.mapVersion)?' is-changed':''}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="22"/>`).join('')}<rect class="minimap-viewport" x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="18"/></svg>`
  }

  function openReleaseOnMap(version){state.mapVersion=version;const select=$('#wireframeVersion');if(select)select.value=version;renderMap();location.hash='wireframes';setTimeout(fitMap,80)}
  function bindEvents(){
    $('#releaseSearch')?.addEventListener('input',event=>{state.search=event.target.value;renderReleaseList()});
    $('#releaseStatusFilter')?.addEventListener('change',event=>{state.status=event.target.value;renderReleaseList()});
    $('#releaseList')?.addEventListener('click',event=>{const card=event.target.closest('[data-release]');if(!card)return;state.release=card.dataset.release;renderReleaseList()});
    $('#releaseDetail')?.addEventListener('click',event=>{const mapButton=event.target.closest('[data-map-release]');if(mapButton)return openReleaseOnMap(mapButton.dataset.mapRelease);const pr=event.target.closest('[data-open-pr]');if(pr)window.open(`https://github.com/hoonex/blank-app/pull/${encodeURIComponent(pr.dataset.openPr)}`,'_blank','noopener')});
    $('#wireframeVersion')?.addEventListener('change',event=>{state.mapVersion=event.target.value;renderMap();setTimeout(fitMap,30)});
    $('#wireframePlatform')?.addEventListener('change',event=>{state.platform=event.target.value;renderMap();setTimeout(fitMap,30)});
    $('#wireframeZoomIn')?.addEventListener('click',()=>setScale(state.scale*1.18));
    $('#wireframeZoomOut')?.addEventListener('click',()=>setScale(state.scale/1.18));
    $('#wireframeFit')?.addEventListener('click',fitMap);$('#wireframeReset')?.addEventListener('click',resetMap);
    $('#wireframeFullscreen')?.addEventListener('click',async()=>{const panel=$('#wireframes');try{if(document.fullscreenElement)await document.exitFullscreen();else await panel?.requestFullscreen?.()}catch{}});
    document.addEventListener('fullscreenchange',()=>setTimeout(fitMap,80));
    $('#wireframeNodes')?.addEventListener('click',event=>{const node=event.target.closest('[data-node]');if(!node)return;state.selectedNode=node.dataset.node;renderMap()});
    $('#wireframeInspector')?.addEventListener('click',event=>{const n=event.target.closest('[data-inspector-node]');if(n){state.selectedNode=n.dataset.inspectorNode;renderMap();return}const r=event.target.closest('[data-inspector-release]');if(r){state.release=r.dataset.inspectorRelease;renderReleaseList();location.hash='releases'}});
    if(viewport){
      viewport.addEventListener('wheel',event=>{event.preventDefault();const rect=viewport.getBoundingClientRect();setScale(state.scale*Math.exp(-event.deltaY*.0012),event.clientX-rect.left,event.clientY-rect.top)},{passive:false});
      viewport.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('.wireframe-node,button,select'))return;state.panning=true;state.pointerId=event.pointerId;state.startX=event.clientX;state.startY=event.clientY;state.originX=state.x;state.originY=state.y;viewport.dataset.panning='true';viewport.setPointerCapture?.(event.pointerId)});
      viewport.addEventListener('pointermove',event=>{if(!state.panning||event.pointerId!==state.pointerId)return;state.x=state.originX+(event.clientX-state.startX);state.y=state.originY+(event.clientY-state.startY);queueTransform()});
      const end=event=>{if(!state.panning||event.pointerId!==state.pointerId)return;state.panning=false;delete viewport.dataset.panning;try{viewport.releasePointerCapture?.(event.pointerId)}catch{}};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
      viewport.addEventListener('keydown',event=>{if(event.key==='+'||event.key==='='){event.preventDefault();setScale(state.scale*1.18)}else if(event.key==='-'){event.preventDefault();setScale(state.scale/1.18)}else if(event.key==='0'){event.preventDefault();fitMap()}})
    }
    addEventListener('resize',()=>{renderMinimap()},{passive:true})
  }

  function boot(){
    ensureStyles();injectNav();injectSections();viewport=$('#wireframeViewport');world=$('#wireframeWorld');minimap=$('#wireframeMinimap');renderReleaseList();renderMap();bindEvents();setTimeout(fitMap,60);document.documentElement.dataset.flowAdminReleaseWireframes='ready'
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
