/* Per-tab visit statistics. No persistent identity, form fields or device fingerprint. */
(()=>{'use strict';if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const endpoint='https://dany-style.danystyle.workers.dev/api/analytics/event',key='dany-tab-visit-v3',page=location.pathname;
let referrer='',internal=false,nav='';try{const u=new URL(document.referrer);internal=['dany.style','www.dany.style'].includes(u.hostname);referrer=u.origin}catch{}
try{nav=performance.getEntriesByType('navigation')[0]?.type||''}catch{}
let visit;try{visit=JSON.parse(sessionStorage.getItem(key))}catch{}
if(!visit||!/^[-a-f0-9]{36}$/.test(visit.id||'')||(!internal&&!['reload','back_forward'].includes(nav)))visit={id:crypto.randomUUID(),referrer};
try{sessionStorage.setItem(key,JSON.stringify(visit))}catch{}
const viewId=crypto.randomUUID();let activeMs=0,lastTick=performance.now(),lastActivity=lastTick,visible=!document.hidden,lastSent=0,posted=false;
function tick(){const now=performance.now();if(visible)activeMs+=Math.max(0,Math.min(now,lastActivity+30000)-lastTick);lastTick=now}
function send(event){tick();try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'visits-v3',visitId:visit.id,eventId:event==='pageview'?viewId:crypto.randomUUID(),viewId,event,page,referrer:visit.referrer,activeMs:Math.floor(activeMs)}),credentials:'omit',keepalive:true}).catch(()=>{})}catch{}lastSent=activeMs}
function flush(){if(activeMs!==lastSent)send('heartbeat')}
function activity(){tick();lastActivity=performance.now()}
for(const e of ['pointerdown','keydown','scroll'])document.addEventListener(e,activity,{passive:true});
document.addEventListener('visibilitychange',()=>{tick();visible=!document.hidden;lastTick=performance.now();if(visible){lastActivity=lastTick;if(!posted){posted=true;send('pageview')}}else flush()});
window.addEventListener('pagehide',()=>{tick();flush()});window.addEventListener('pageshow',e=>{if(e.persisted){lastTick=performance.now();lastActivity=lastTick;visible=!document.hidden}});
setInterval(()=>{tick();flush()},15000);
document.addEventListener('click',e=>{activity();const a=e.target.closest?.('a,button');if(!a)return;const href=a.getAttribute('href')||'',id=a.id||'';if(href.startsWith('tel:'))send('phone_click');else if(href.includes('#rezervacii')||href.includes('#booking')||id==='bk-open')send('booking_click');else if(href.includes('#home-form')||id==='home-form-toggle')send('home_click')});
if(visible){posted=true;send('pageview')}
const info=document.createElement('details');info.style.cssText='margin:12px auto;max-width:600px;padding:8px 12px;color:#49313d;font:normal 13px/1.5 system-ui';
const title=document.createElement('summary');title.style.cssText='font:normal 13px/1.5 system-ui;cursor:pointer';title.textContent=document.documentElement.lang==='en'?'About visit statistics':'За статистиката на посещенията';
const text=document.createElement('p');text.style.cssText='font:normal 13px/1.5 system-ui;margin:8px 0';text.textContent=document.documentElement.lang==='en'?'A temporary code in this browser tab groups viewed pages, selected clicks and approximate active time into a visit. No names, form data, raw IP addresses or device fingerprints are stored in visit records. Approximate network country/city and referring website are recorded. Detailed history is kept for 30 days. Do Not Track and Global Privacy Control are respected.':'Временен код в този раздел на браузъра обединява разгледаните страници, избрани кликове и приблизително активно време в едно посещение. В записите не пазим имена, данни от формите, самия IP адрес или отпечатък на устройството. Отчитаме приблизителни държава и град на мрежата и сайта източник. Подробната история се пази 30 дни. Съобразяваме се с Do Not Track и Global Privacy Control.';info.append(title,text);document.body.append(info);
})();
