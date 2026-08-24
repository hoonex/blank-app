const TARGET_HOST='eicwcohfrvhwimwevzkd.supabase.co';
const TARGET_PATHS=new Set(['/functions/v1/university-data','/functions/v1/university-campus']);
const RETRYABLE_STATUS=new Set([408,425,429,500,502,503,504]);
const DEFAULT_DELAYS=[250,900];

function aborted(signal){
  if(!signal?.aborted)return null;
  try{return signal.reason instanceof Error?signal.reason:new DOMException('The operation was aborted.','AbortError')}catch{const error=new Error('The operation was aborted.');error.name='AbortError';return error}
}
function wait(ms,signal){
  if(ms<=0)return Promise.resolve();
  const stopped=aborted(signal);if(stopped)return Promise.reject(stopped);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(done,ms);
    function done(){signal?.removeEventListener?.('abort',stop);resolve()}
    function stop(){clearTimeout(timer);signal?.removeEventListener?.('abort',stop);reject(aborted(signal)||new Error('The operation was aborted.'))}
    signal?.addEventListener?.('abort',stop,{once:true});
  });
}
function isUniversityReadRequest(request){
  try{
    const url=new URL(request.url);
    return url.hostname===TARGET_HOST&&TARGET_PATHS.has(url.pathname)&&['GET','HEAD','POST'].includes(request.method);
  }catch{return false}
}
function retryDelay(response,attempt,delays){
  const raw=response?.headers?.get?.('retry-after');
  if(raw){
    const seconds=Number(raw);
    if(Number.isFinite(seconds)&&seconds>=0)return Math.min(1500,seconds*1000);
    const date=Date.parse(raw);if(Number.isFinite(date))return Math.max(0,Math.min(1500,date-Date.now()));
  }
  return delays[Math.min(attempt-1,delays.length-1)]??0;
}

export function installUniversityFetchRetry(scope=globalThis,{delays=DEFAULT_DELAYS}={}){
  if(!scope?.fetch||scope.__flowUniversityFetchRetryInstalled)return false;
  const nativeFetch=scope.fetch.bind(scope);
  scope.fetch=async function flowUniversityFetch(input,init){
    let template;
    try{template=new Request(input,init)}catch{return nativeFetch(input,init)}
    if(!isUniversityReadRequest(template))return nativeFetch(input,init);
    const maxAttempts=1+Math.max(0,delays.length);
    let lastError=null;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      const stopped=aborted(template.signal);if(stopped)throw stopped;
      try{
        const response=await nativeFetch(template.clone());
        if(!RETRYABLE_STATUS.has(response.status)||attempt===maxAttempts)return response;
        await wait(retryDelay(response,attempt,delays),template.signal);
      }catch(error){
        if(error?.name==='AbortError'||template.signal?.aborted)throw error;
        lastError=error;
        if(attempt===maxAttempts)throw error;
        await wait(delays[Math.min(attempt-1,delays.length-1)]??0,template.signal);
      }
    }
    throw lastError||new Error('University request failed.');
  };
  scope.__flowUniversityFetchRetryInstalled=true;
  return true;
}

if(typeof window!=='undefined')installUniversityFetchRetry(window);
