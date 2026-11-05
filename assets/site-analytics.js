/* Aggregate traffic only: no cookies, identifiers, form fields or URL queries. */
(()=>{'use strict';if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
const endpoint='https://dany-style.danystyle.workers.dev/api/analytics/event';
let referrer='';try{referrer=new URL(document.referrer).origin}catch{}
const send=event=>{try{fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,page:location.pathname==='/'?'/':location.pathname,referrer}),credentials:'omit',keepalive:true}).catch(()=>{})}catch{}};
let sent=false;const view=()=>{if(!sent&&!document.hidden){sent=true;send('pageview')}};view();document.addEventListener('visibilitychange',view);
document.addEventListener('click',e=>{const a=e.target.closest?.('a,button');if(!a)return;const href=a.getAttribute('href')||'',id=a.id||'';if(href.startsWith('tel:'))send('phone_click');else if(href.includes('#rezervacii')||href.includes('#booking')||id==='bk-open')send('booking_click');else if(href.includes('#home-form')||id==='home-form-toggle')send('home_click')});
})();
