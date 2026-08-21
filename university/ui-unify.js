const THEME_KEY='flow-university-theme-v1';
const UI_BUILD='20260821-1';
const STYLES=['/university/ui-unify.css','/university/ui-unify-v2.css'].map(x=>`${x}?v=${UI_BUILD}`);
const media=matchMedia('(prefers-color-scheme: dark)');
function ensureStyles(){for(const href of STYLES){if(document.querySelector(`link[href="${href}"]`))continue;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l)}}
function refreshServiceWorker(){navigator.serviceWorker?.getRegistration?.().then(r=>r?.update()).catch(()=>{})}
function pref(){const v=localStorage.getItem(THEME_KEY)||'light';return['light','system','dark'].includes(v)?v:'light'}
function effective(value){return value==='system'?(media.matches?'dark':'light'):value}
function label(value){return value==='light'?'Light':value==='dark'?'Dark':'System'}
function apply(value=pref()){
  const p=['light','system','dark'].includes(value)?value:'light',e=effective(p),root=document.documentElement;
  localStorage.setItem(THEME_KEY,p);root.dataset.theme=e;root.dataset.themeMode=p;
  const colorScheme=e==='dark'?'dark':'only light';
  root.style.colorScheme=colorScheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',colorScheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',e==='dark'?'#202833':'#f5f7fa');
  document.querySelectorAll('[data-university-theme]').forEach(b=>b.classList.toggle('active',b.dataset.universityTheme===p));
  document.querySelectorAll('.flow-theme-cycle').forEach(b=>b.textContent=label(p));
}
function cycle(){const order=['light','system','dark'],p=pref();apply(order[(order.indexOf(p)+1)%order.length])}
function makeCycle(){const b=document.createElement('button');b.className='flow-theme-cycle';b.type='button';b.setAttribute('aria-label','테마 변경');b.addEventListener('click',cycle);return b}
function ensureBrandModes(){document.querySelectorAll('.brand').forEach(brand=>{if(brand.querySelector('.brand-mode'))return;const word=brand.querySelector('.brand-word');if(!word)return;const mode=document.createElement('span');mode.className='brand-mode';mode.textContent='University';word.after(mode)})}
function installControls(){
  ensureBrandModes();
  const setup=document.querySelector('.setup-header');if(setup&&!setup.querySelector('.setup-header-actions')){const quiet=setup.querySelector('.quiet-link');const actions=document.createElement('div');actions.className='setup-header-actions';if(quiet)actions.append(quiet);actions.append(makeCycle());setup.append(actions)}
  const mobile=document.querySelector('.mobile-header');if(mobile&&!mobile.querySelector('.flow-theme-cycle')){const b=makeCycle(),school=mobile.querySelector('.mobile-school');mobile.insertBefore(b,school||null)}
  const bottom=document.querySelector('.sidebar-bottom');if(bottom&&!bottom.querySelector('.flow-theme-segment')){const seg=document.createElement('div');seg.className='flow-theme-segment';seg.setAttribute('aria-label','화면 테마');seg.innerHTML='<button type="button" data-university-theme="light">Light</button><button type="button" data-university-theme="system">System</button><button type="button" data-university-theme="dark">Dark</button>';seg.addEventListener('click',e=>{const b=e.target.closest('[data-university-theme]');if(b)apply(b.dataset.universityTheme)});bottom.prepend(seg)}
  apply(pref())
}
function init(){ensureStyles();installControls();refreshServiceWorker()}
media.addEventListener?.('change',()=>{if(pref()==='system')apply('system')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
