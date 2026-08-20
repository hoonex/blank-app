/* Bridge the existing current-route geolocation call to the interactive map without a second location request. */
(function install(){
  const geo=navigator.geolocation;if(!geo||window.__flowCampusGeoBridge)return;window.__flowCampusGeoBridge=true;
  try{
    const proto=Object.getPrototypeOf(geo),original=proto?.getCurrentPosition;
    if(typeof original!=='function')return;
    proto.getCurrentPosition=function(success,error,options){
      return original.call(this,pos=>{
        try{window.dispatchEvent(new CustomEvent('flow:campus-current-position',{detail:{lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy||0)}}))}catch{}
        success?.(pos)
      },error,options)
    }
  }catch{}
})();
