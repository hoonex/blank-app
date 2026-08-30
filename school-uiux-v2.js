const root=document.documentElement;
root.dataset.flowSchoolUi='v2';

if(!document.querySelector('link[data-flow-school-ui-v2]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/school-uiux-v2.css?v=20260831-1';
  link.dataset.flowSchoolUiV2='';
  document.head.append(link);
}
