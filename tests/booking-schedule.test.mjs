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
const book=(e,time,admin=false)=>call(e,admin?'/api/admin/book':'/api/book',{date,time,name:'Test',phone:'123',email:'',service:'Test',privacy:true},admin);
const calendar=e=>call(e,`/api/calendar?from=${date}&to=${date}`);
const adminCalendar=e=>call(e,`/api/admin/calendar?from=${date}&to=${date}`,null,true);
const occupied=r=>new Set(r.data.occupied.map(x=>x.time));
let e=env(),r=await calendar(e);
assert.equal(r.status,200);assert.equal(r.data.scheduleVersion,'half-hour-90-v1');assert.equal(r.data.times.length,15);assert.equal(r.data.times[0],'10:00');assert.equal(r.data.times.at(-1),'17:00');
assert.equal((await book(e,'10:00')).status,201);
let o=occupied(await calendar(e));for(const t of ['10:00','10:30','11:00'])assert(o.has(t));assert(!o.has('11:30'));
assert.equal((await book(e,'11:00',true)).status,409);assert.equal((await book(e,'11:30',true)).status,200);
e=env();assert.equal((await book(e,'11:00')).status,201);
for(const t of ['10:00','10:30','11:30','12:00'])assert.equal((await book(e,t)).status,409,t);
assert.equal((await book(e,'12:30')).status,201);
e=env();const race=await Promise.all([book(e,'10:00'),book(e,'10:30',true)]);assert.equal(race.filter(x=>[200,201].includes(x.status)).length,1);assert.equal(race.filter(x=>x.status===409).length,1);
e=env();assert.equal((await call(e,'/api/admin/slot',{date,time:'10:30',action:'block'},true)).status,200);
o=occupied(await calendar(e));assert(o.has('10:00'));assert(o.has('10:30'));assert(!o.has('11:00'));
let rows=(await adminCalendar(e)).data.items;assert.equal(rows[0].duration_minutes,30);
assert.equal((await book(e,'10:00')).status,409);assert.equal((await book(e,'11:00')).status,201);
assert.equal((await call(e,'/api/admin/slot',{date,time:'11:30',action:'block'},true)).status,409);
assert.equal((await call(e,'/api/admin/slot',{date,time:'10:30',action:'unblock'},true)).status,200);
assert.equal((await call(e,'/api/admin/day',{date,action:'block'},true)).status,200);
assert.equal(occupied(await calendar(e)).size,15);
rows=(await adminCalendar(e)).data.items;assert.equal(rows.filter(x=>x.kind==='booked').length,1);
assert.equal((await call(e,'/api/admin/day',{date,action:'unblock'},true)).status,200);
rows=(await adminCalendar(e)).data.items;assert.equal(rows.length,1);assert.equal(rows[0].kind,'booked');
assert.equal((await call(e,'/api/admin/cancel',{id:rows[0].id},true)).status,200);assert.equal(occupied(await calendar(e)).size,0);
// Existing reservations, including the previous 17:30 last start, survive migration.
e=env();e.DB.sql.prepare("INSERT INTO slots(date,time,kind,id,name) VALUES(?,?,'booked','legacy','Existing')").run(date,'17:30');
r=await adminCalendar(e);assert.equal(r.data.items[0].id,'legacy');assert.equal(r.data.items[0].time,'17:30');assert.equal(r.data.items[0].duration_minutes,90);
assert.equal((await book(e,'17:00')).status,409);assert.equal((await book(e,'16:00')).status,201);
e=env();assert.equal((await book(e,'17:00')).status,201);assert.equal((await book(e,'17:30')).status,400);
e=env();e.DB.sql.prepare("INSERT INTO slots(date,time,kind) VALUES(?,?,'blocked')").run(date,'11:00');
rows=(await adminCalendar(e)).data.items;assert.equal(rows[0].duration_minutes,60);assert.equal((await book(e,'12:00')).status,201);
e=env();assert.equal((await call(e,'/api/admin/book',{date,time:'10:00',name:'Test'},false)).status,401);
assert.equal((await call(e,'/api/admin/slot',{date,time:'10:00',action:'block'},false)).status,401);
assert.equal((await calendar(e)).data.occupied.some(x=>x.name||x.phone||x.email),false);
// Every changed inline script must parse, and server-version fallback remains present.
for(const path of ['index.html','en/index.html','admin.html']){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 for(const m of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('application/ld+json'))new Function(m[2]);
 assert(source.includes('half-hour-90-v1'));assert(source.includes('legacyTimes'));
}
console.log('PASS: 15 half-hour starts; 90-minute intervals; both overlap directions; exact boundaries; concurrent public/admin bookings; 30-minute blocks; day block/unblock/cancel; legacy migration; last start 17:00; auth; public privacy; inline scripts and rollout fallback.');
