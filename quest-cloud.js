import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://eicwcohfrvhwimwevzkd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9Cf0yVjLWf88pcvAqQ-EQ_YN9v3Obz';
const SESSION_KEY = 'flow-cloud-active-session-v1';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const readActive = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const writeActive = (value) => value ? localStorage.setItem(SESSION_KEY, JSON.stringify(value)) : localStorage.removeItem(SESSION_KEY);

async function getUser(){const {data}=await supabase.auth.getSession();return data.session?.user||null}

async function startCloudSession(){
  const user=await getUser();
  if(!user)return;
  const timer=document.querySelector('#timerValue')?.textContent||'25:00';
  const minutes=Math.max(5,Math.min(120,Number(timer.split(':')[0])||25));
  const title=(document.querySelector('#timerTitle')?.textContent||'집중 원정').trim().slice(0,80);
  const {data,error}=await supabase.functions.invoke('quest-session',{body:{action:'start',minutes,title}});
  if(!error&&data?.session?.id)writeActive({id:data.session.id,minutes,startedAt:data.session.started_at});
}

async function finishCloudSession(){
  const active=readActive();
  if(!active?.id)return;
  const user=await getUser();
  if(!user){writeActive(null);return}
  const {data,error}=await supabase.functions.invoke('quest-session',{body:{action:'finish',sessionId:active.id}});
  if(!error&&data?.ok){writeActive(null);window.dispatchEvent(new CustomEvent('flow-cloud-score',{detail:data.score||null}));return}
  if(data?.error==='session_already_closed'||data?.error==='session_expired')writeActive(null);
}

function bind(){
  const start=document.querySelector('#startBtn');
  if(start)start.addEventListener('click',()=>{setTimeout(startCloudSession,0)},{passive:true});
  const reward=document.querySelector('#rewardDialog');
  if(reward){
    const observer=new MutationObserver(()=>{if(reward.hasAttribute('open'))finishCloudSession()});
    observer.observe(reward,{attributes:true,attributeFilter:['open']});
  }
}

bind();
window.FlowCloud={getUser,startCloudSession,finishCloudSession};
