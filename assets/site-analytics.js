/* Per-tab visits grouped by a random, first-party browser code (30 days). No form data or fingerprint. */
(()=>{'use strict';if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const endpoint='https://dany-style.danystyle.workers.dev/api/analytics/event',key='dany-tab-visit-v3',page=location.pathname;
const browserKey='dany-browser-visitor-v1',browserLifetime=30*86400000;
let browserVisitor;try{browserVisitor=JSON.parse(localStorage.getItem(browserKey))}catch{}
if(!browserVisitor||!/^[-a-f0-9]{36}$/.test(browserVisitor.id||'')||!Number.isFinite(browserVisitor.createdAt)||Date.now()-browserVisitor.createdAt>=browserLifetime||browserVisitor.createdAt>Date.now())browserVisitor={id:crypto.randomUUID(),createdAt:Date.now()};
try{localStorage.setItem(browserKey,JSON.stringify(browserVisitor))}catch{}
let referrer='',internal=false,nav='';try{const u=new URL(document.referrer);internal=['dany.style','www.dany.style'].includes(u.hostname);referrer=u.origin}catch{}
try{nav=performance.getEntriesByType('navigation')[0]?.type||''}catch{}
let visit;try{visit=JSON.parse(sessionStorage.getItem(key))}catch{}
if(!visit||!/^[-a-f0-9]{36}$/.test(visit.id||'')||(!internal&&!['reload','back_forward'].includes(nav)))visit={id:crypto.randomUUID(),referrer};
try{sessionStorage.setItem(key,JSON.stringify(visit))}catch{}
const viewId=crypto.randomUUID();let activeMs=0,lastTick=performance.now(),lastActivity=lastTick,visible=!document.hidden,lastSent=0,posted=false;
function tick(){const now=performance.now();if(visible)activeMs+=Math.max(0,Math.min(now,lastActivity+30000)-lastTick);lastTick=now}
function send(event){tick();try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'visits-v3',visitorId:browserVisitor.id,visitId:visit.id,eventId:event==='pageview'?viewId:crypto.randomUUID(),viewId,event,page,referrer:visit.referrer,activeMs:Math.floor(activeMs)}),credentials:'omit',keepalive:true}).catch(()=>{})}catch{}lastSent=activeMs}
function flush(){if(activeMs!==lastSent)send('heartbeat')}
function activity(){tick();lastActivity=performance.now()}
for(const e of ['pointerdown','keydown','scroll'])document.addEventListener(e,activity,{passive:true});
document.addEventListener('visibilitychange',()=>{tick();visible=!document.hidden;lastTick=performance.now();if(visible){lastActivity=lastTick;if(!posted){posted=true;send('pageview')}}else flush()});
window.addEventListener('pagehide',()=>{tick();flush()});window.addEventListener('pageshow',e=>{if(e.persisted){lastTick=performance.now();lastActivity=lastTick;visible=!document.hidden}});
setInterval(()=>{tick();flush()},15000);
document.addEventListener('click',e=>{activity();const a=e.target.closest?.('a,button');if(!a)return;const href=a.getAttribute('href')||'',id=a.id||'';if(href.startsWith('tel:'))send('phone_click');else if(href.includes('#rezervacii')||href.includes('#booking')||id==='bk-open')send('booking_click');else if(href.includes('#home-form')||id==='home-form-toggle')send('home_click')});
if(visible){posted=true;send('pageview')}

})();
