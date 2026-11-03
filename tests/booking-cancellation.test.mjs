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


const setup=async(email='client@example.test')=>{const e=env();e.RESEND_API_KEY='test-key';e.MAIL_FROM='Dany Style <mail@example.test>';await call(e,`/api/calendar?from=${date}&to=${date}`);e.DB.sql.prepare("INSERT INTO slots(date,time,kind,id,name,email,service,duration_minutes) VALUES(?,?,'booked','cancel-test','Test Client',?,'Хиперкератоза — 1 бр.',30)").run(date,'11:30',email);return e};
const originalFetch=globalThis.fetch;let sent=[];globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent.push(JSON.parse(options.body));return new Response('{}',{status:200})};
try{
 let e=await setup();let r=await call(e,'/api/admin/cancel',{id:'cancel-test',reason:'Налага се промяна.\nИзберете нов час.'},true);
 assert.equal(r.status,200);assert.equal(r.data.clientEmailStatus,'sent');assert.equal(e.DB.sql.prepare('SELECT count(*) AS n FROM slots').get().n,0);assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['client@example.test']);assert(sent[0].text.includes('Налага се промяна.'));assert(sent[0].html.includes('Налага се промяна.'));assert(sent[0].html.includes('assets/home-0.png'));assert(sent[0].html.includes('Даниела Ангелова'));assert(sent[0].html.includes('Изберете нов час'));assert(sent[0].text.includes('11:30'));assert(!sent[0].text.includes('cancel-test'));assert(!sent[0].text.includes('Вашият час в Dany Style е запазен'));
 assert.equal((await call(e,'/api/admin/cancel',{id:'cancel-test'},true)).status,404);assert.equal(sent.length,1);
 e=await setup();sent=[];await call(e,'/api/admin/cancel',{id:'cancel-test',reason:'  '},true);assert(sent[0].text.includes('поради непредвидени обстоятелства'));assert(sent[0].text.includes('извиненията ми'));assert(sent[0].html.includes('https://www.dany.style/#rezervacii'));
 e=await setup();sent=[];await call(e,'/api/admin/cancel',{id:'cancel-test',reason:'<img src=x onerror=alert(1)>\nВтори ред'},true);assert(sent[0].html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(!sent[0].html.includes('<img src=x'));assert(sent[0].html.includes('white-space:pre-wrap'));
 e=await setup('');sent=[];r=await call(e,'/api/admin/cancel',{id:'cancel-test'},true);assert.equal(r.data.clientEmailStatus,'not_provided');assert.equal(sent.length,0);
 e=await setup();sent=[];globalThis.fetch=async()=>new Response('{}',{status:503});r=await call(e,'/api/admin/cancel',{id:'cancel-test'},true);assert.equal(r.status,200);assert.equal(r.data.cancelled,true);assert.equal(r.data.clientEmailStatus,'failed');assert.equal(e.DB.sql.prepare('SELECT count(*) AS n FROM slots').get().n,0);
 e=await setup();globalThis.fetch=async()=>{throw Error('network failure')};r=await call(e,'/api/admin/cancel',{id:'cancel-test'},true);assert.equal(r.data.clientEmailStatus,'failed');
 e=await setup();delete e.RESEND_API_KEY;r=await call(e,'/api/admin/cancel',{id:'cancel-test'},true);assert.equal(r.data.clientEmailStatus,'failed');
 e=await setup();assert.equal((await call(e,'/api/admin/cancel',{id:'cancel-test',reason:'x'.repeat(2001)},true)).status,400);assert.equal((await call(e,'/api/admin/cancel',{id:'cancel-test',reason:{}},true)).status,400);assert.equal((await call(e,'/api/admin/cancel',{id:'cancel-test'})).status,401);assert.equal(e.DB.sql.prepare('SELECT count(*) AS n FROM slots').get().n,1);
 e=await setup();sent=[];globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return new Response('{}',{status:200})};const race=await Promise.all([call(e,'/api/admin/cancel',{id:'cancel-test'},true),call(e,'/api/admin/cancel',{id:'cancel-test'},true)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,404]);assert.equal(sent.length,1);
 const publicData=(await call(e,`/api/calendar?from=${date}&to=${date}`)).data;assert.equal(publicData.cancellationEmailVersion,1);assert.equal(publicData.occupied.length,0);
 console.log('PASS: cancellation custom/default reason, branded HTML/plain text, HTML escaping, missing email, provider/network/config failure, authorization, invalid reason, concurrent/repeated cancellation, slot release and capability flag.');
}finally{globalThis.fetch=originalFetch}
