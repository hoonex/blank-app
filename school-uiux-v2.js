const root=document.documentElement;
root.dataset.flowSchoolUi='v2';

function attachStyle(href,key){
  if(document.querySelector(`link[${key}]`))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=href;
  link.setAttribute(key,'');
  document.head.append(link);
}

attachStyle('/school-uiux-v2.css?v=20260831-1','data-flow-school-ui-v2');
attachStyle('/school-uiux-v2-system.css?v=20260831-1','data-flow-school-ui-v2-system');