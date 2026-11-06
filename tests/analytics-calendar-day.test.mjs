import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const workerSource=readFileSync(new URL('../backend/worker.js',import.meta.url),'utf8');
const {default:worker,notifySms,smsPhone,smsMessage,analyticsScopedId,ensureAnalytics,ensureVisits,ensureAnalyticsReady,analyticsReady}=await import('data:text/javascript;base64,'+Buffer.from(workerSource+'\nexport {notifySms,smsPhone,smsMessage,analyticsScopedId,ensureAnalytics,ensureVisits,ensureAnalyticsReady,analyticsReady};').toString('base64'));
const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(`CREATE TABLE slots(date TEXT NOT NULL,time TEXT NOT NULL,kind TEXT NOT NULL,id TEXT,name TEXT,phone TEXT,email TEXT,service TEXT,PRIMARY KEY(date,time));`)}
 prepare(sql){const db=this;let args=[];return {bind(...v){args=v;return this},async all(){return {results:db.sql.prepare(sql).all(...args)}},async first(){return db.sql.prepare(sql).get(...args)||null},async run(){const x=db.sql.prepare(sql).run(...args);return {success:true,meta:{changes:Number(x.changes)},results:[]}}}}
 async batch(statements){this.sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.sql.exec('COMMIT');return out}catch(e){this.sql.exec('ROLLBACK');throw e}}
}
const secret='test-only-key';
const msg=Buffer.from(JSON.stringify({exp:Date.now()+600000})).toString('base64');
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg))).toString('base64url');
const token=msg+'.'+sig;
const env=()=>({DB:new D1(),SESSION_SECRET:secret});
async function call(e,path,body,admin=false){
 const response=await worker.fetch(new Request('https://dany-style.danystyle.workers.dev'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:'https://www.dany.style',...(admin?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),e);
 return {status:response.status,data:await response.json()};
}



const originalNow=Date.now;let clock=Date.parse('2026-11-05T21:59:50Z');Date.now=()=>clock;
const e=env(),visitId=crypto.randomUUID(),viewId=crypto.randomUUID();
async function event(event,activeMs=0,extras={}){return worker.fetch(new Request('https://dany-style.danystyle.workers.dev/api/analytics/event',{method:'POST',headers:{Origin:'https://www.dany.style','Content-Type':'application/json','CF-Connecting-IP':'calendar-test'},body:JSON.stringify({mode:'visits-v3',visitId,viewId,eventId:crypto.randomUUID(),event,page:'/',referrer:'https://google.com/search?q=private',activeMs,day:'1999-01-01',...extras})}),e)}
async function report(day,to=day){return (await call(e,`/api/admin/visits?from=${day}&to=${to}`,null,true)).data}
assert.equal((await event('pageview')).status,204);clock=Date.parse('2026-11-05T21:59:59Z');await event('heartbeat',9000);
clock=Date.parse('2026-11-05T22:00:00Z');await event('heartbeat',10000);clock+=10000;await event('heartbeat',20000);
const before=await report('2026-11-05'),after=await report('2026-11-06');assert.equal(before.visits,1);assert.equal(after.visits,1);assert.notEqual(before.items[0].id,after.items[0].id);assert.equal(before.summary.activeMs,9000);assert.equal(after.summary.activeMs,10000);assert.equal(after.items[0].started_at,Date.parse('2026-11-05T22:00:00Z'));assert.equal(after.items[0].referrer,'google.com');
const nextView=crypto.randomUUID();await event('pageview',0,{page:'/oniholiza.html',viewId:nextView,referrer:'https://www.dany.style/'});
const sameDay=await report('2026-11-06');assert.equal(sameDay.visits,1);assert.equal(sameDay.summary.pages.length,2);assert.equal(sameDay.items[0].referrer,'google.com');assert.equal((await report('2026-11-05','2026-11-06')).visits,2);assert.equal((await report('2026-11-07')).visits,0);
// Spring and autumn changes still use calendar dates, not fixed 24-hour windows.
for(const [last,next,day,tomorrow]of [['2026-03-29T20:59:59Z','2026-03-29T21:00:00Z','2026-03-29','2026-03-30'],['2026-10-25T21:59:59Z','2026-10-25T22:00:00Z','2026-10-25','2026-10-26']]){clock=Date.parse(last);await event('pageview',0,{visitId:crypto.randomUUID(),viewId:crypto.randomUUID()});clock=Date.parse(next);await event('pageview',0,{visitId:crypto.randomUUID(),viewId:crypto.randomUUID()});assert.equal((await report(day)).visits,1);assert.equal((await report(tomorrow)).visits,1)}
// Authorized reset clears only analytics, exactly once even across concurrent requests/cold starts.
const reset=env();await ensureAnalytics(reset.DB);await ensureVisits(reset.DB);
reset.DB.sql.exec("INSERT INTO slots(date,time,kind,id,name) VALUES('2026-11-12','10:00','booking','keep-booking','Keep Client'); CREATE TABLE unrelated_data(value TEXT); INSERT INTO unrelated_data VALUES('keep');");
reset.DB.sql.prepare('INSERT INTO site_analytics VALUES(?,?,?,?,?,?,?,?)').run('2026-11-05',12,'pageview','/','BE','Bierbeek','google.com',3);
const old=crypto.randomUUID();reset.DB.sql.prepare('INSERT INTO site_visits VALUES(?,?,?,?,?,?,?)').run(old,'2026-11-05',0,0,'BE','Bierbeek','google.com');reset.DB.sql.prepare('INSERT INTO site_visit_daily VALUES(?,?)').run('2026-11-05',1);reset.DB.sql.prepare('INSERT INTO site_visit_events VALUES(?,?,?,?,?)').run(old,old,0,'pageview','/');reset.DB.sql.prepare('INSERT INTO site_visit_pages VALUES(?,?,?,?,?,?)').run(old,old,'/',0,0,1000);reset.DB.sql.prepare('INSERT INTO site_visit_page_bases VALUES(?,?)').run(old,0);
await Promise.all([ensureAnalyticsReady(reset.DB),ensureAnalyticsReady(reset.DB)]);
for(const table of ['site_analytics','site_visits','site_visit_daily','site_visit_events','site_visit_pages','site_visit_page_bases'])assert.equal(reset.DB.sql.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
assert.equal(reset.DB.sql.prepare('SELECT name FROM slots').get().name,'Keep Client');assert.equal(reset.DB.sql.prepare('SELECT value FROM unrelated_data').get().value,'keep');
reset.DB.sql.prepare('INSERT INTO site_analytics VALUES(?,?,?,?,?,?,?,?)').run('2026-11-06',1,'pageview','/','BE','Bierbeek','google.com',1);analyticsReady.delete(reset.DB);await ensureAnalyticsReady(reset.DB);assert.equal(reset.DB.sql.prepare('SELECT total FROM site_analytics').get().total,1);assert.equal(reset.DB.sql.prepare('SELECT COUNT(*) AS n FROM site_analytics_meta').get().n,1);
Date.now=originalNow;
console.log('PASS: Sofia midnight separates same-tab visits and active time; initial source retained; today/ranges correct; DST 23/25-hour days; reset is analytics-only, atomic, concurrent-safe and one-time across cold starts; bookings preserved.');
