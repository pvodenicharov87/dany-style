/* Aggregate page statistics and unlinked entry records. No browser identifiers. */
(()=>{'use strict';
if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const endpoint='https://dany-style.danystyle.workers.dev/api/analytics/event';
let referrer='',internal=false;
try{const u=new URL(document.referrer);internal=['dany.style','www.dany.style'].includes(u.hostname);referrer=u.origin}catch{}
let navigation='';try{navigation=performance.getEntriesByType('navigation')[0]?.type||''}catch{}
const entry=!internal&&!['reload','back_forward'].includes(navigation);
function send(event,isEntry=false){try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'entries-v2',event,page:location.pathname,referrer,entry:isEntry}),credentials:'omit',keepalive:true}).catch(()=>{})}catch{}}
send('pageview',entry);
document.addEventListener('click',e=>{const a=e.target.closest?.('a,button');if(!a)return;const href=a.getAttribute('href')||'',id=a.id||'';if(href.startsWith('tel:'))send('phone_click');else if(href.includes('#rezervacii')||href.includes('#booking')||id==='bk-open')send('booking_click');else if(href.includes('#home-form')||id==='home-form-toggle')send('home_click')});
const info=document.createElement('details');info.style.cssText='margin:12px auto;max-width:600px;padding:8px 12px;color:#49313d;font:normal 13px/1.5 system-ui';
const title=document.createElement('summary');title.style.cssText='font:normal 13px/1.5 system-ui;cursor:pointer';title.textContent=document.documentElement.lang==='en'?'About visit statistics':'За статистиката на посещенията';
const text=document.createElement('p');text.style.cssText='font:normal 13px/1.5 system-ui;margin:8px 0';text.textContent=document.documentElement.lang==='en'?'We count site entries and page views separately, without cookies, saved browser codes or device fingerprints. Entries are approximate, not unique people. We record entry time, initial page, referring website and approximate network location for up to 30 days. Subsequent page views are not linked to an entry. No form data is collected. Do Not Track and Global Privacy Control are respected.':'Броим влизанията в сайта отделно от отворените страници, без бисквитки, запазен код в браузъра или отпечатък на устройството. Влизанията са приблизителни, не брой уникални хора. За до 30 дни отчитаме час, начална страница, сайт източник и приблизително местоположение на мрежата. Последващите страници не се свързват с конкретно влизане. Не събираме данни от формите. Съобразяваме се с Do Not Track и Global Privacy Control.';
info.append(title,text);document.body.append(info);
})();
