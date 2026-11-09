import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const workerSource=readFileSync(new URL('../backend/worker.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
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

const book=(e,time,serviceId='ingrown',quantity=1,admin=false,extra={})=>call(e,admin?'/api/admin/book':'/api/book',{date,time,name:'Test',phone:'123',privacy:true,serviceId,quantity,...extra},admin);
const calendar=e=>call(e,`/api/calendar?from=${date}&to=${date}`);
const adminCalendar=e=>call(e,`/api/admin/calendar?from=${date}&to=${date}`,null,true);
const choice=(r,time,id)=>r.data.availability.find(x=>x.time===time).services.find(x=>x.id===id)?.quantities||[];
let e=env(),r=await calendar(e);
assert.equal(r.status,200);assert.equal(r.data.scheduleVersion,'service-duration-v1');assert.equal(r.data.times.length,15);assert.equal(r.data.times.at(-1),'17:00');
for(const s of r.data.services)for(let i=0;i<s.durations.length;i++){
 const test=env();assert.equal((await book(test,'17:00',s.id,i+1)).status,201);
 const rows=(await adminCalendar(test)).data.items;assert.equal(rows[0].duration_minutes,s.durations[i]);assert(rows[0].service.includes(s.bg));
}
assert.equal((await book(e,'10:30')).status,201);r=await calendar(e);
assert.deepEqual(choice(r,'10:00','ingrown').map(x=>x.quantity),[1]);assert.equal(choice(r,'10:00','fungal').length,0);
assert.equal(choice(r,'10:30','ingrown').length,0);assert.equal(choice(r,'11:00','extensions').length,1);
assert.equal((await book(e,'10:00','ingrown',2)).status,409);assert.equal((await book(e,'10:00')).status,201);
e=env();await book(e,'11:00');r=await calendar(e);
assert.deepEqual(choice(r,'10:00','ingrown').map(x=>x.quantity),[1,2]);assert.deepEqual(choice(r,'10:30','ingrown').map(x=>x.quantity),[1]);assert.equal(choice(r,'10:30','gel-polish').length,0);
assert.deepEqual(choice(r,'10:00','fungal').map(x=>x.duration),[40,60]);
e=env();await book(e,'10:00','fungal');r=await calendar(e);assert.equal(choice(r,'10:30','ingrown').length,0);assert.equal(choice(r,'11:00','ingrown').length,2);
assert.equal((await book(e,'11:00','fungal',2,true)).status,200);assert.equal((await adminCalendar(e)).data.items[1].duration_minutes,60);
e=env();const race=await Promise.all([book(e,'10:00','gel-polish'),book(e,'10:30','ingrown',1,true)]);assert.equal(race.filter(x=>[200,201].includes(x.status)).length,1);assert.equal(race.filter(x=>x.status===409).length,1);
assert.equal((await book(env(),'10:00','unknown')).status,400);assert.equal((await book(env(),'10:00','niti',2)).status,400);assert.equal((await book(env(),'10:00','ingrown',0)).status,400);
e=env();await book(e,'10:00','extensions',1,false,{duration_minutes:1});assert.equal((await adminCalendar(e)).data.items[0].duration_minutes,165);
e=env();await book(e,'11:00');assert.equal((await call(e,'/api/admin/slot',{date,time:'10:00',action:'block',duration_minutes:60},true)).status,200);assert.equal((await call(e,'/api/admin/slot',{date,time:'10:00',action:'unblock'},true)).status,200);
assert.equal((await call(e,'/api/admin/slot',{date,time:'10:00',action:'block',duration_minutes:90},true)).status,409);
assert.equal((await call(e,'/api/admin/slot',{date,time:'12:00',action:'block',duration_minutes:-30},true)).status,400);
await call(e,'/api/admin/day',{date,action:'block'},true);r=await calendar(e);assert(r.data.availability.every(x=>x.services.length===0));
await call(e,'/api/admin/day',{date,action:'unblock'},true);assert.equal((await adminCalendar(e)).data.items.length,1);
const id=(await adminCalendar(e)).data.items[0].id;await call(e,'/api/admin/cancel',{id},true);assert.equal((await adminCalendar(e)).data.items.length,0);
// Existing records and old-client bookings retain their original90min duration.
e=env();e.DB.sql.prepare("INSERT INTO slots(date,time,kind,id,name) VALUES(?,?,'booked','old','Legacy')").run(date,'17:30');
r=await calendar(e);assert.equal(choice(r,'17:00','ingrown').length,1);assert.equal(choice(r,'17:00','gel-polish').length,0);assert.equal((await adminCalendar(e)).data.items[0].duration_minutes,90);
assert.equal((await call(e,'/api/book',{date,time:'10:00',name:'Old client',phone:'123',privacy:true,service:'Old form'})).status,201);assert.equal((await adminCalendar(e)).data.items[0].duration_minutes,90);
const publicJSON=JSON.stringify((await calendar(e)).data);for(const privateField of ['Legacy','Old client','phone','email','sourceTime'])assert(!publicJSON.includes(privateField));
assert.equal((await call(e,'/api/admin/book',{date,time:'14:00',name:'Unauthorized'})).status,401);
console.log('PASS: service durations/quantities, gap filtering, exact40min, all17:00 starts, atomic overlap rejection, forged selections, custom blocks, day unblock, cancellation, legacy data and privacy.');

for(const quantity of [1,2]){
 e=env();assert.equal((await book(e,'11:30','hyperkeratosis',quantity,true)).status,200);
 const row=(await adminCalendar(e)).data.items[0];assert.equal(row.time,'11:30');assert.equal(row.duration_minutes,quantity*30);
 r=await calendar(e);for(const t of ['10:00','10:30','11:00'])assert.equal(choice(r,t,'hyperkeratosis')[0].duration,30);
 assert.equal(choice(r,'11:30','hyperkeratosis').length,0);assert.equal(choice(r,quantity===1?'12:00':'12:30','hyperkeratosis').length,2);
}
console.log('PASS regression: admin hyperkeratosis11:30 stores forward30/60min; earlier30min starts remain bookable.');

const metadataEnv=env();await book(metadataEnv,'10:00','ingrown',1,false,{source:'admin',created_at:1});await book(metadataEnv,'12:00','ingrown',1,true,{source:'website',created_at:1});const metadataRows=(await adminCalendar(metadataEnv)).data.items;assert.equal(metadataRows[0].source,'website');assert.equal(metadataRows[1].source,'admin');assert(metadataRows.every(x=>x.created_at>1));const publicRows=await calendar(metadataEnv);assert(!JSON.stringify(publicRows.data).includes('created_at'));assert(!JSON.stringify(publicRows.data).includes('source'));console.log('PASS: server-owned creation timestamp/source, forged metadata ignored, admin-only visibility.');

for(const [service,quantity,label]of [['medical-pedicure',1,'мъже — 40 €'],['medical-pedicure-women',1,'жени — 35 €'],['natural-gel',1,'30 €'],['pedicure-gel-polish',1,'30 €']]){
 const test=env();assert.equal((await book(test,'10:00',service,quantity,false,{duration_minutes:1,price:1})).status,201);
 const row=(await adminCalendar(test)).data.items[0];assert.equal(row.duration_minutes,90);assert(row.service.includes(label));
 assert.equal((await book(test,'11:00')).status,409);assert.equal((await book(test,'11:30')).status,201);
}
assert.equal((await book(env(),'10:00','medical-pedicure',3)).status,400);
