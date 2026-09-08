const STYLE_ID='flow-school-desktop-workspace-v1';

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* Desktop is a workspace, not a stretched tablet. Keep short landscape on the
   compact fallback; normal desktop heights get a persistent left rail. */
@media (min-width:1181px) and (min-height:681px){
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden){
    display:grid!important;
    grid-template-columns:216px minmax(0,1fr)!important;
    align-items:start!important;
    gap:18px!important;
    width:min(1720px,calc(100% - 32px))!important;
    max-width:none!important;
    margin:0 auto!important;
    padding:16px 0 42px!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) #desktopSidebar.desktop-sidebar{
    position:sticky!important;
    top:16px!important;
    z-index:85!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    width:216px!important;
    min-width:216px!important;
    height:calc(100vh - 32px)!important;
    min-height:0!important;
    margin:0!important;
    padding:16px!important;
    gap:0!important;
    border:1px solid var(--flow-dt-border)!important;
    border-radius:24px!important;
    corner-shape:round!important;
    background:var(--flow-dt-shell)!important;
    box-shadow:0 18px 46px rgba(32,43,65,.09)!important;
    overflow:hidden!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .sidebar-logo{
    display:inline-flex!important;
    width:max-content!important;
    min-width:0!important;
    min-height:44px!important;
    margin:0 0 14px!important;
    padding:2px 4px!important;
    align-items:center!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .flow-logo-copy small{
    display:inline!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .school-identity{
    display:grid!important;
    grid-template-columns:38px minmax(0,1fr) 14px!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    height:68px!important;
    min-height:68px!important;
    margin:0 0 18px!important;
    padding:8px 10px!important;
    gap:9px!important;
    border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
    border-radius:16px!important;
    background:color-mix(in srgb,var(--surface-2) 70%,transparent)!important;
    box-shadow:none!important;
    text-align:left!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .school-identity .school-badge{
    display:grid!important;
    width:38px!important;
    height:38px!important;
    border-radius:12px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .school-identity-copy{
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .school-identity-copy strong{
    display:block!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
    font-size:.72rem!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .school-identity-copy small{
    display:block!important;
    margin-top:3px!important;
    font-size:.53rem!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-auto-rows:54px!important;
    align-items:stretch!important;
    justify-items:stretch!important;
    width:100%!important;
    height:auto!important;
    margin:0!important;
    padding:0!important;
    gap:6px!important;
    border-radius:0!important;
    background:transparent!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav .nav-item{
    position:relative!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    align-content:center!important;
    justify-items:start!important;
    width:100%!important;
    min-width:0!important;
    height:54px!important;
    min-height:54px!important;
    margin:0!important;
    padding:8px 12px 8px 14px!important;
    gap:2px!important;
    border:0!important;
    border-radius:14px!important;
    background:transparent!important;
    box-shadow:none!important;
    text-align:left!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav .nav-item span{
    font-size:.72rem!important;
    font-weight:830!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav .nav-item small{
    display:block!important;
    color:var(--muted)!important;
    font-size:.49rem!important;
    font-weight:690!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav .nav-item.active{
    background:color-mix(in srgb,var(--accent) 9%,var(--surface))!important;
    color:var(--accent)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .side-nav .nav-item.active::before{
    content:"";
    position:absolute;
    left:5px;
    top:14px;
    bottom:14px;
    width:3px;
    border-radius:999px;
    background:var(--accent);
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .sidebar-spacer{
    display:block!important;
    flex:1 1 auto!important;
    min-height:16px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .countdown-pill{
    width:100%!important;
    min-width:0!important;
    height:auto!important;
    min-height:54px!important;
    margin:0 0 8px!important;
    padding:9px 12px!important;
    border:1px solid color-mix(in srgb,var(--accent) 14%,transparent)!important;
    border-radius:14px!important;
    background:color-mix(in srgb,var(--accent) 6%,var(--surface))!important;
    box-shadow:none!important;
    text-align:left!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .countdown-pill span{
    display:block!important;
    font-size:.48rem!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar .countdown-pill strong{
    display:block!important;
    margin-top:3px!important;
    font-size:.82rem!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar #settingsBtn.settings-trigger{
    display:grid!important;
    justify-items:start!important;
    align-content:center!important;
    width:100%!important;
    min-width:0!important;
    height:58px!important;
    min-height:58px!important;
    margin:0!important;
    padding:8px 12px!important;
    gap:2px!important;
    border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
    border-radius:14px!important;
    background:color-mix(in srgb,var(--surface-2) 66%,transparent)!important;
    box-shadow:none!important;
    text-align:left!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar #settingsBtn span{
    font-size:.7rem!important;
    font-weight:820!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #desktopSidebar #settingsBtn small{
    display:block!important;
    color:var(--muted)!important;
    font-size:.48rem!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) .product-main{
    grid-column:2!important;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) #todayView#todayView,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) :is(#weekView,#scheduleView,#schoolView){
    width:100%!important;
    max-width:none!important;
    margin:0!important;
  }

  /* Today: sidebar already owns identity. The top surface is now a compact command
     bar for context/date instead of repeating the school name a second time. */
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero{
    min-height:76px!important;
    height:76px!important;
    margin:0 0 12px!important;
    border-radius:20px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .school-hero-content{
    min-height:76px!important;
    height:76px!important;
    padding:10px 12px 10px 18px!important;
    grid-template-columns:minmax(0,1fr) auto!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero :is(.school-badge,.school-hero-image,.school-hero-shade,.school-hero-copy .eyebrow,.school-hero-copy h1,.school-hero-copy p){
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .school-hero-copy{
    display:grid!important;
    align-content:center!important;
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .school-hero-copy::before{
    content:"오늘";
    color:var(--text);
    font-size:1.05rem;
    line-height:1.1;
    font-weight:870;
    letter-spacing:-.04em;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .school-hero-copy::after{
    content:"시간표 · 급식 · 시험";
    margin-top:4px;
    color:var(--muted);
    font-size:.55rem;
    font-weight:680;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .hero-right{
    gap:7px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .date-controller{
    min-height:48px!important;
    height:48px!important;
    padding:4px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .date-controller button{
    width:38px!important;
    min-width:38px!important;
    height:38px!important;
    min-height:38px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView #schoolHero .today-jump{
    min-height:48px!important;
    height:48px!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .status-grid{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:12px!important;
    margin:0 0 12px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .status-card:not(.flow-home-noise){
    min-height:88px!important;
    padding:13px 16px!important;
    border-radius:18px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .today-grid{
    gap:14px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .right-stack{
    gap:14px!important;
  }

  /* Week mode should not drag Today-only status chrome through the page. */
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body.flow-inline-week-active #dashboard #todayView #schoolHero,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body.flow-inline-week-active #dashboard #todayView .status-grid{
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body.flow-inline-week-active #dashboard #todayView .today-grid{
    margin-top:0!important;
  }

  /* Destination headers are contextual headings, not full-width hero cards. */
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard :is(#weekView,#scheduleView,#schoolView)>.view-header{
    display:flex!important;
    align-items:flex-end!important;
    justify-content:space-between!important;
    min-height:66px!important;
    margin:0 0 12px!important;
    padding:4px 4px 10px!important;
    gap:16px!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard :is(#weekView,#scheduleView,#schoolView)>.view-header h1{
    margin:3px 0 0!important;
    font-size:1.7rem!important;
    line-height:1!important;
    letter-spacing:-.055em!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard :is(#weekView,#scheduleView,#schoolView)>.view-header p{
    margin:6px 0 0!important;
    font-size:.6rem!important;
    color:var(--muted)!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #scheduleView .schedule-layout{
    grid-template-columns:minmax(0,1.42fr) minmax(320px,.72fr)!important;
    gap:14px!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .profile-hero{
    height:180px!important;
    min-height:180px!important;
    margin:0 0 14px!important;
    border-radius:22px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .profile-content{
    height:180px!important;
    min-height:180px!important;
    padding:22px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .profile-content h2{
    font-size:2rem!important;
    line-height:1!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid{
    gap:10px!important;
    margin-top:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-actions{
    gap:8px!important;
    margin-top:12px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .public-data-note{
    margin-top:10px!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .source-note{
    margin-top:20px!important;
    padding-bottom:4px!important;
  }
}
`;
  document.head.append(style);
}

document.documentElement.dataset.flowSchoolDesktopWorkspace='v1';
