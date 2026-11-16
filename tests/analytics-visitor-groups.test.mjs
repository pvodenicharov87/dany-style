import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const workerSource=readFileSync(new URL('../backend/worker.js',import.meta.url),'utf8');
const {default:worker,notifySms,smsPhone,smsMessage,analyticsScopedId}=await import('data:text/javascript;base64,'+Buffer.from(workerSource+'\nexport {notifySms,smsPhone,smsMessage,analyticsScopedId};').toString('base64'));
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

const browserA=crypto.randomUUID(),browserB=crypto.randomUUID();
async function visit(visitorId,city='Bierbeek',country='BE'){
 const visitId=crypto.randomUUID(),viewId=crypto.randomUUID();
 const response=await collect({mode:'visits-v3',visitorId,visitId,viewId,eventId:viewId,event:'pageview',page:'/',activeMs:0},'https://www.dany.style',{city,country});assert.equal(response.status,204);return visitId;
}
await visit(browserA);await visit(browserA);await visit(browserA);await visit(browserB);
await visit(undefined); // Historic/unidentified visits must not be merged by city.
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let report=await call(e,`/api/admin/visits?from=${today}&to=${today}`,null,true);
assert.equal(report.data.visits,5);assert.equal(report.data.groupVersion,1);assert.equal(report.data.groupedVisitors,3);
const group=report.data.visitorGroups.find(x=>x.total===3);assert(group);assert.equal(group.city,'Bierbeek');assert.equal(group.country,'BE');assert.equal(report.data.visitorGroups.filter(x=>x.total===1).length,2);
let members=await call(e,`/api/admin/visits?from=${today}&to=${today}&visitor=${group.visitorKey}`,null,true);assert.equal(members.data.total,3);assert.equal(members.data.items.length,3);assert.equal(new Set(members.data.items.map(x=>x.id)).size,3);
assert.equal((await call(e,`/api/admin/visits?from=${today}&to=${today}&visitor=${group.visitorKey}`)).status,401);
assert.equal((await call(e,`/api/admin/visits?from=${today}&to=${today}&visitor=invalid`,null,true)).status,400);
members=await call(e,`/api/admin/visits?from=2020-01-01&to=2020-01-01&visitor=${group.visitorKey}`,null,true);assert.equal(members.data.total,0);
assert(!JSON.stringify(report.data).includes(browserA));assert(!JSON.stringify(e.DB.sql.prepare('SELECT * FROM site_visit_visitors').all()).includes('test-ip'));
// Counts cover every visit, independently of the 100-row legacy detail list.
const groupKey=group.visitorKey;for(let i=0;i<110;i++){const id=crypto.randomUUID();e.DB.sql.prepare('INSERT INTO site_visits(id,day,started_at,last_seen,country,city,referrer) VALUES(?,?,?,?,?,?,?)').run(id,today,Date.now()+i,Date.now()+i,'BE','Bierbeek','Direct');e.DB.sql.prepare('INSERT INTO site_visit_visitors(visit_id,visitor_key) VALUES(?,?)').run(id,groupKey)}
report=await call(e,`/api/admin/visits?from=${today}&to=${today}`,null,true);assert.equal(report.data.items.length,100);assert.equal(report.data.visitorGroups.find(x=>x.visitorKey===groupKey).total,113);
console.log('PASS: repeated browser visits group; same-city browsers and legacy visits separate; selected period, auth, unknown key, exact counts beyond latest100; no raw visitor ID or IP.');
