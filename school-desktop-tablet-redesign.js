const root=document.documentElement;
const STYLE_ID='flow-school-desktop-tablet-redesign-v2';

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* Desktop/tablet v2 is a fresh composition over the existing School data/components.
   Mobile <=520px intentionally remains owned by the phone contracts. */
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"],
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"]{
  --flow-dt-card-radius:24px;
  --flow-dt-control-radius:14px;
  --flow-dt-border:color-mix(in srgb,var(--text) 7%,transparent);
  --flow-dt-shadow:0 12px 34px rgba(38,50,72,.075);
  --flow-dt-shell:color-mix(in srgb,var(--surface) 92%,transparent);
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body{
  overflow-x:hidden!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView #schoolHero{
  display:none!important;
}
html[data-flow-school-ui="v2"] body #dashboard :where(.status-card:not(.flow-home-noise),.content-card,.calendar-card,.week-card,.flow-settings-card){
  corner-shape:round!important;
}

/* ---------- Tablet ---------- */
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden){
  display:block!important;
  width:min(1320px,calc(100% - 28px))!important;
  max-width:none!important;
  margin:0 auto!important;
  padding:14px 0 calc(112px + env(safe-area-inset-bottom))!important;
  grid-template-columns:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .desktop-sidebar{
  display:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .product-main{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-topbar{
  position:sticky!important;
  z-index:80!important;
  top:12px!important;
  display:grid!important;
  grid-template-columns:minmax(84px,auto) minmax(300px,1fr) minmax(126px,176px)!important;
  align-items:center!important;
  width:100%!important;
  min-height:68px!important;
  height:68px!important;
  margin:0 0 14px!important;
  padding:8px 10px!important;
  gap:10px!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:22px!important;
  corner-shape:round!important;
  background:var(--flow-dt-shell)!important;
  box-shadow:var(--flow-dt-shadow)!important;
  backdrop-filter:blur(20px) saturate(1.08)!important;
  -webkit-backdrop-filter:blur(20px) saturate(1.08)!important;
  overflow:visible!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-topbar .flow-logo{
  display:inline-flex!important;
  min-width:84px!important;
  min-height:44px!important;
  align-items:center!important;
  padding:0 4px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-topbar .flow-logo-copy strong{
  font-size:1.08rem!important;
  font-weight:850!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-topbar .flow-logo-copy small{
  display:inline!important;
  font-size:.55rem!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-school-button{
  position:relative!important;
  inset:auto!important;
  justify-self:end!important;
  display:grid!important;
  align-content:center!important;
  justify-items:end!important;
  width:100%!important;
  min-width:126px!important;
  max-width:176px!important;
  height:48px!important;
  min-height:48px!important;
  margin:0!important;
  padding:5px 10px!important;
  border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
  border-radius:14px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 78%,transparent)!important;
  box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 62%,transparent)!important;
  overflow:hidden!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-school-button span{
  max-width:100%!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  font-size:.69rem!important;
  font-weight:820!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard .mobile-school-button small{
  max-width:100%!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  margin-top:2px!important;
  font-size:.52rem!important;
  color:var(--muted)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #flowTodayDateDock{
  --flow-date-count:5;
  position:relative!important;
  z-index:1!important;
  left:auto!important;
  top:auto!important;
  transform:none!important;
  justify-self:center!important;
  display:grid!important;
  grid-template-columns:44px minmax(0,1fr) 44px!important;
  align-items:center!important;
  width:min(100%,660px)!important;
  min-width:300px!important;
  max-width:660px!important;
  height:50px!important;
  min-height:50px!important;
  margin:0!important;
  padding:3px 0!important;
  border:0!important;
  border-radius:16px!important;
  background:color-mix(in srgb,var(--surface-2) 58%,transparent)!important;
  box-shadow:none!important;
  overflow:hidden!important;
  touch-action:pan-y!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-edge{
  display:grid!important;
  place-items:center!important;
  width:44px!important;
  min-width:44px!important;
  height:44px!important;
  min-height:44px!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  border-radius:13px!important;
  corner-shape:round!important;
  background:transparent!important;
  color:var(--muted)!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-viewport{
  position:relative!important;
  grid-column:2!important;
  width:100%!important;
  min-width:0!important;
  height:44px!important;
  border-radius:13px!important;
  overflow:hidden!important;
  background:transparent!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-focus{
  position:absolute!important;
  z-index:0!important;
  inset-block:0!important;
  left:50%!important;
  width:calc((100% / 5) - 6px)!important;
  transform:translateX(-50%)!important;
  border:1px solid color-mix(in srgb,var(--accent) 14%,transparent)!important;
  border-radius:12px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface) 96%,var(--accent) 4%)!important;
  box-shadow:0 4px 12px rgba(43,57,78,.06)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-rail{
  position:absolute!important;
  z-index:1!important;
  inset:0!important;
  width:100%!important;
  height:44px!important;
  transform:translate3d(var(--flow-date-x,0px),0,0)!important;
  will-change:transform!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock :is(.flow-date-day,.flow-date-buffer-day){
  --flow-date-base:0px;
  --flow-date-scale:.88;
  position:absolute!important;
  left:50%!important;
  top:0!important;
  display:grid!important;
  grid-template-rows:11px 18px 8px!important;
  place-content:center!important;
  align-items:center!important;
  justify-items:center!important;
  width:calc((100% / 5) - 6px)!important;
  height:44px!important;
  min-height:44px!important;
  margin:0!important;
  padding:4px 2px 2px!important;
  border:0!important;
  border-radius:12px!important;
  background:transparent!important;
  color:var(--muted)!important;
  box-shadow:none!important;
  opacity:var(--flow-date-opacity,.5)!important;
  transform:translate3d(var(--flow-date-base),0,0) translateX(-50%) scale(var(--flow-date-scale))!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-day[data-preview="true"]{
  color:var(--accent)!important;
  font-weight:850!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-week{font-size:.53rem!important;font-weight:760!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-num{font-size:.94rem!important;font-weight:880!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #flowTodayDateDock .flow-date-today{font-size:.42rem!important;font-weight:820!important;color:var(--accent)!important}

html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #bottomNav.mobile-bottom-nav{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  z-index:90!important;
  left:50%!important;
  right:auto!important;
  bottom:max(12px,env(safe-area-inset-bottom))!important;
  width:min(720px,calc(100% - 34px))!important;
  min-height:64px!important;
  height:64px!important;
  max-height:64px!important;
  padding:6px!important;
  transform:translateX(-50%)!important;
  grid-template-rows:52px!important;
  gap:2px!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:9999px!important;
  corner-shape:round!important;
  background:var(--flow-dt-shell)!important;
  box-shadow:0 16px 40px rgba(32,43,65,.14)!important;
  backdrop-filter:blur(20px) saturate(1.08)!important;
  -webkit-backdrop-filter:blur(20px) saturate(1.08)!important;
  overflow:hidden!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"][data-flow-transit-surface="dormant"] body #bottomNav.mobile-bottom-nav{
  --flow-tab-count:4!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"]:not([data-flow-transit-surface="dormant"]) body #bottomNav.mobile-bottom-nav{
  --flow-tab-count:5!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #bottomNav.mobile-bottom-nav>.mobile-tab,
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #bottomNav.mobile-bottom-nav>#mobileSettingsBtn{
  width:100%!important;
  min-width:0!important;
  height:52px!important;
  min-height:52px!important;
  padding:0 10px!important;
  border:0!important;
  border-radius:9999px!important;
  corner-shape:round!important;
  background:transparent!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #bottomNav.mobile-bottom-nav::before,
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
  border-radius:9999px!important;
  corner-shape:round!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView,
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body :is(#weekView,#scheduleView,#schoolView,#flowSchoolSettingsView){
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  padding-inline:2px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView .status-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:12px!important;
  margin:0 0 14px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView .status-card:not(.flow-home-noise){
  min-height:104px!important;
  padding:16px 18px!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:20px!important;
  background:var(--surface)!important;
  box-shadow:0 8px 24px rgba(38,50,72,.055)!important;
}
/* Tablet chrome stays tablet-specific, but content proportions are the desktop proportions. */
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView .today-grid{
  display:grid!important;
  grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr)!important;
  align-items:start!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView .right-stack{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView :is(.timetable-card,.meal-card,.upcoming-card),
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body :is(#weekView,#scheduleView,#schoolView,#flowSchoolSettingsView) .content-card{
  border:1px solid var(--flow-dt-border)!important;
  border-radius:var(--flow-dt-card-radius)!important;
  background:var(--surface)!important;
  box-shadow:var(--flow-dt-shadow)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body .schedule-layout{
  display:grid!important;
  grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr)!important;
  align-items:start!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body .view-header{
  margin:4px 2px 14px!important;
}
@media(min-width:900px){
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #todayView .status-grid{
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
  }
}

/* ---------- Desktop ---------- */
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden){
  display:block!important;
  width:min(1540px,calc(100% - 44px))!important;
  max-width:none!important;
  margin:0 auto!important;
  padding:16px 0 56px!important;
  grid-template-columns:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .desktop-sidebar{
  position:sticky!important;
  z-index:85!important;
  top:14px!important;
  display:grid!important;
  grid-template-columns:auto minmax(420px,1fr) auto auto auto!important;
  align-items:center!important;
  width:100%!important;
  height:72px!important;
  min-height:72px!important;
  margin:0 0 16px!important;
  padding:10px 12px!important;
  gap:10px!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:22px!important;
  corner-shape:round!important;
  background:var(--flow-dt-shell)!important;
  box-shadow:var(--flow-dt-shadow)!important;
  backdrop-filter:blur(20px) saturate(1.08)!important;
  -webkit-backdrop-filter:blur(20px) saturate(1.08)!important;
  overflow:hidden!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .sidebar-logo{
  display:inline-flex!important;
  min-width:86px!important;
  margin:0!important;
  padding:0 4px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .side-nav{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(92px,1fr))!important;
  align-items:center!important;
  justify-self:center!important;
  width:min(620px,100%)!important;
  height:50px!important;
  padding:4px!important;
  gap:3px!important;
  border-radius:16px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 74%,transparent)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .side-nav .nav-item{
  display:grid!important;
  place-items:center!important;
  align-content:center!important;
  width:100%!important;
  min-height:42px!important;
  height:42px!important;
  padding:0 10px!important;
  border:0!important;
  border-radius:12px!important;
  corner-shape:round!important;
  text-align:center!important;
  background:transparent!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .side-nav .nav-item span{
  font-size:.69rem!important;
  font-weight:790!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .side-nav .nav-item small{display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .side-nav .nav-item.active{
  background:var(--surface)!important;
  color:var(--accent)!important;
  box-shadow:0 3px 10px rgba(43,57,78,.07)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .sidebar-spacer{display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .countdown-pill{
  width:88px!important;
  min-width:88px!important;
  height:50px!important;
  margin:0!important;
  padding:7px 10px!important;
  border-radius:14px!important;
  corner-shape:round!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .countdown-pill span{font-size:.48rem!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .countdown-pill strong{font-size:.77rem!important;margin-top:1px!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .school-identity{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 14px!important;
  align-items:center!important;
  width:176px!important;
  min-width:176px!important;
  height:50px!important;
  margin:0!important;
  padding:6px 10px!important;
  gap:6px!important;
  border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
  border-radius:14px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 70%,transparent)!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .school-identity .school-badge{display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .school-identity-copy strong{font-size:.67rem!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .school-identity-copy small{font-size:.52rem!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .settings-trigger{
  display:grid!important;
  place-items:center!important;
  width:64px!important;
  min-width:64px!important;
  height:50px!important;
  margin:0!important;
  padding:0!important;
  border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
  border-radius:14px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 70%,transparent)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .settings-trigger small{display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .settings-trigger span{font-size:.65rem!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .product-main{
  width:100%!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .mobile-topbar,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #bottomNav.mobile-bottom-nav{
  display:none!important;
}

/* Desktop Today header: reuse the old hero DOM as a restrained date/header strip,
   not the legacy blue masthead. */
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero{
  display:block!important;
  position:relative!important;
  min-height:92px!important;
  height:92px!important;
  margin:0 0 14px!important;
  padding:0!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:24px!important;
  corner-shape:round!important;
  background:var(--surface)!important;
  box-shadow:var(--flow-dt-shadow)!important;
  overflow:hidden!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero :is(.school-hero-image,.school-hero-shade,.school-badge){display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .school-hero-content{
  position:relative!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  align-items:center!important;
  min-height:92px!important;
  height:92px!important;
  padding:14px 16px 14px 20px!important;
  gap:16px!important;
  color:var(--text)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .school-hero-copy{
  min-width:0!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .school-hero-copy .eyebrow{display:none!important}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .school-hero-copy h1{
  margin:0!important;
  color:var(--text)!important;
  font-size:1.22rem!important;
  line-height:1.1!important;
  letter-spacing:-.045em!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .school-hero-copy p{
  margin:5px 0 0!important;
  color:var(--muted)!important;
  font-size:.62rem!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .hero-right{
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:8px!important;
  margin:0!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .date-controller{
  min-height:50px!important;
  margin:0!important;
  padding:5px!important;
  border:1px solid color-mix(in srgb,var(--text) 6%,transparent)!important;
  border-radius:15px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--surface-2) 68%,transparent)!important;
  color:var(--text)!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .date-controller button{
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  border:0!important;
  border-radius:11px!important;
  background:var(--surface)!important;
  color:var(--muted)!important;
  box-shadow:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .date-label{
  min-width:132px!important;
  color:var(--text)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView #schoolHero .today-jump{
  min-height:50px!important;
  height:50px!important;
  padding:0 14px!important;
  border:0!important;
  border-radius:14px!important;
  corner-shape:round!important;
  background:color-mix(in srgb,var(--accent) 10%,var(--surface))!important;
  color:var(--accent)!important;
  box-shadow:none!important;
  font-weight:800!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView .status-grid{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:12px!important;
  margin:0 0 14px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView .status-card:not(.flow-home-noise){
  min-height:116px!important;
  padding:17px 18px!important;
  border:1px solid var(--flow-dt-border)!important;
  border-radius:20px!important;
  background:var(--surface)!important;
  box-shadow:0 8px 24px rgba(38,50,72,.05)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView .today-grid{
  display:grid!important;
  grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr)!important;
  align-items:start!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView .right-stack{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #todayView :is(.timetable-card,.meal-card,.upcoming-card),
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body :is(#weekView,#scheduleView,#schoolView,#flowSchoolSettingsView) .content-card{
  border:1px solid var(--flow-dt-border)!important;
  border-radius:var(--flow-dt-card-radius)!important;
  background:var(--surface)!important;
  box-shadow:var(--flow-dt-shadow)!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body .view-header{
  margin:2px 2px 14px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body .schedule-layout{
  grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr)!important;
  gap:16px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body .school-info-grid{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:12px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body .school-actions{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:10px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body .flow-adfit-rail--school-top{
  width:100%!important;
  max-width:none!important;
  margin:0 0 14px!important;
  border-radius:24px!important;
  corner-shape:round!important;
}

@media(min-width:1181px) and (max-width:1360px){
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .desktop-sidebar{
    grid-template-columns:auto minmax(360px,1fr) auto auto!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard .countdown-pill{display:none!important}
}

html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard{
  --flow-desktop-tablet-ui:2;
}
`;
  document.head.append(style);
}
root.dataset.flowSchoolDesktopTabletUi='v2';
