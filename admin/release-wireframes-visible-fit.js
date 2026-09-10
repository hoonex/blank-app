(()=>{
  let fitted=false;
  let dashboard=null;
  let observer=null;

  function markHidden(){
    if(dashboard?.classList.contains('hidden'))fitted=false;
  }

  function fitWhenVisible(){
    dashboard=document.querySelector('#dashboard');
    const viewport=document.querySelector('#wireframeViewport');
    const fit=document.querySelector('#wireframeFit');
    if(!dashboard||dashboard.classList.contains('hidden')||!viewport||!fit)return false;
    if(viewport.clientWidth<320||viewport.clientHeight<220)return false;
    if(fitted)return true;
    fitted=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fit.click();
      document.documentElement.dataset.flowAdminWireframeVisibleFit='v1';
    }));
    return true;
  }

  function bindDashboard(){
    dashboard=document.querySelector('#dashboard');
    if(!dashboard)return false;
    observer?.disconnect();
    observer=new MutationObserver(()=>{
      if(dashboard.classList.contains('hidden'))markHidden();
      else fitWhenVisible();
    });
    observer.observe(dashboard,{attributes:true,attributeFilter:['class']});
    fitWhenVisible();
    return true;
  }

  if(!bindDashboard()){
    const bodyObserver=new MutationObserver(()=>{if(bindDashboard())bodyObserver.disconnect()});
    bodyObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  addEventListener('load',fitWhenVisible,{once:true});
  setTimeout(fitWhenVisible,120);
  setTimeout(fitWhenVisible,500);
})();
