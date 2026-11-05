import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const workerSource=readFileSync(new URL('../backend/worker.js',import.meta.url),'utf8');
const {default:worker,notifySms,smsPhone,smsMessage}=await import('data:text/javascript;base64,'+Buffer.from(workerSource+'\nexport {notifySms,smsPhone,smsMessage};').toString('base64'));
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



const e=env();
async function collect(body,origin='https://www.dany.style',cf={country:'BG',city:'Plovdiv'}){const req=new Request('https://dany-style.danystyle.workers.dev/api/analytics/event',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'test-browser','CF-Connecting-IP':'test-ip'},body:JSON.stringify(body)});Object.defineProperty(req,'cf',{value:cf});return worker.fetch(req,e)}
assert.equal((await collect({event:'pageview',page:'/',referrer:'https://google.com/search?q=private'})).status,204);
assert.equal((await collect({event:'pageview',page:'/',referrer:'https://google.com/search?q=other'})).status,204);
assert.equal((await collect({event:'phone_click',page:'/'})).status,204);
assert.equal((await collect({event:'pageview',page:'/admin.html'})).status,400);
assert.equal((await collect({event:'pageview',page:'/?email=secret'})).status,400);
assert.equal((await collect({event:'pageview',page:'/'},'https://evil.example')).status,403);
assert.equal((await call(e,'/api/admin/analytics?from=2026-01-01&to=2026-12-31')).status,401);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());let r=await call(e,`/api/admin/analytics?from=${today}&to=${today}`,null,true);assert.equal(r.status,200);assert.equal(r.data.pageviews,2);assert.equal(r.data.events.phone_click,1);assert.equal(r.data.cities[0].label,'Plovdiv');assert.equal(r.data.sources[0].label,'google.com');assert.equal(r.data.uniqueVisitors,null);assert.equal(r.data.demographicsAvailable,false);
assert.equal((await call(e,'/api/admin/analytics?from=2027-01-01&to=2026-01-01',null,true)).status,400);
assert.equal((await call(e,'/api/admin/analytics?from=2020-01-01&to=2026-01-01',null,true)).status,400);
const cols=e.DB.sql.prepare('PRAGMA table_info(site_analytics)').all().map(x=>x.name);assert(!cols.some(x=>/ip|email|phone|visitor|useragent/.test(x)));const rows=e.DB.sql.prepare('SELECT * FROM site_analytics').all();assert(!JSON.stringify(rows).includes('private'));assert.equal(rows.filter(x=>x.event==='pageview').length,1);assert.equal(rows.find(x=>x.event==='pageview').total,2);


await collect({mode:'entries-v2',event:'pageview',page:'/',entry:true,referrer:'https://google.com/search?q=private'});
await collect({mode:'entries-v2',event:'pageview',page:'/oniholiza.html',entry:false,referrer:'https://www.dany.style/'});
await collect({mode:'entries-v2',event:'pageview',page:'/niti.html',entry:true,referrer:'https://www.dany.style/'});
await collect({mode:'entries-v2',event:'pageview',page:'/',entry:true});
r=await call(e,`/api/admin/visits?from=${today}&to=${today}`,null,true);
assert.equal(r.data.visitVersion,2);assert.equal(r.data.visits,2);assert.equal(r.data.inactivityMinutes,null);assert.equal(r.data.items.length,2);assert(r.data.items.every(x=>x.pageviews===1));
const id=r.data.items[0].id;
let detail=await call(e,'/api/admin/visit-details?id='+id,null,true);assert.equal(detail.data.events.length,1);assert.equal((await call(e,'/api/admin/visit-details?id='+id)).status,401);
// Cached old trackers must not reintroduce linked histories.
await collect({event:'pageview',page:'/',visitId:crypto.randomUUID(),eventId:crypto.randomUUID(),consent:true});
r=await call(e,`/api/admin/visits?from=${today}&to=${today}`,null,true);assert.equal(r.data.visits,2);
assert(!JSON.stringify(e.DB.sql.prepare('SELECT * FROM site_visits').all()).includes('test-ip'));
console.log('PASS: separate entry counts, internal pages do not create entries, no browser IDs accepted, private unlinked details, raw IP excluded.');
