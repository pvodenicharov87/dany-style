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


const configured=(limit=100)=>({...env(),SMS_ENABLED:'true',MOBICA_USER:'test-account',MOBICA_PASSWORD:'test-only-password',SMS_ADMIN_PHONE:'+359897001475',SMS_MAX_MESSAGES:String(limit)});
const booking={id:'sms-booking',date,time:'11:30',phone:'0888123456'};
const originalFetch=globalThis.fetch;let calls=[];
const provider=(status=200,code='1004')=>async(url,options)=>{assert.equal(url,'https://gate.mobica.bg/v2/multi/json/sms.php');assert(!url.includes('test-account'));assert(options.headers.Authorization.startsWith('Basic '));const body=JSON.parse(options.body);assert.equal(body.user,undefined);assert.equal(body.pass,undefined);assert.equal(body.sms.length,1);assert(body.sms[0].message.length<=67);calls.push(body.sms[0]);return new Response(JSON.stringify({code}),{status})};
try{
 globalThis.fetch=provider();let e=configured(),r=await notifySms(e,'booked',booking);assert.equal(r.client,'accepted');assert.equal(r.admin,'accepted');assert.equal(calls.length,2);assert.equal(calls[0].phone,'359888123456');assert.equal(calls[1].phone,'359897001475');assert(calls[0].message.includes('запазен'));assert(calls[1].message.includes('0888123456'));
 r=await notifySms(e,'booked',booking);assert.equal(calls.length,2);assert.equal(r.client,'accepted');
 r=await notifySms(e,'cancelled',booking);assert.equal(calls.length,3);assert(calls[2].message.includes('отменен'));assert.equal(r.admin,'not_required');
 for(const event of ['booked','cancelled'])for(const role of ['client','admin'])assert(smsMessage(event,booking,role).length<=67);
 assert.equal(smsPhone('+359 (0) 888-123-456'),'359888123456');assert.equal(smsPhone('00359888123456'),'359888123456');assert.equal(smsPhone('+32471387908'),'32471387908');assert.equal(smsPhone('02 1234567'),null);assert.equal(smsPhone('n/a'),null);
 calls=[];e=configured();r=await notifySms(e,'booked',{...booking,phone:'+32471387908'});assert.equal(r.client,'accepted');assert.equal(r.admin,'accepted');assert.equal(calls.length,2);
 calls=[];e=configured();r=await notifySms(e,'booked',{...booking,phone:e.SMS_ADMIN_PHONE});assert.equal(r.client,'accepted');assert.equal(r.admin,'same_recipient');assert.equal(calls.length,1);
 calls=[];e=configured(3);await notifySms(e,'booked',booking);r=await notifySms(e,'cancelled',booking);assert.equal(calls.length,3);assert.equal(r.client,'accepted');assert.equal(r.admin,'not_required');
 calls=[];e=configured(100);await Promise.all(Array.from({length:60},(_,i)=>notifySms(e,'booked',{...booking,id:'parallel-'+i})));assert.equal(calls.length,100);assert.equal(e.DB.sql.prepare('SELECT count(*) AS n FROM dany_sms_log').get().n,100);
 calls=[];e=configured();await Promise.all([notifySms(e,'booked',booking),notifySms(e,'booked',booking)]);assert.equal(calls.length,2);
 calls=[];e=configured();globalThis.fetch=provider(200,'1117');r=await notifySms(e,'booked',booking);assert.equal(r.client,'rejected');await notifySms(e,'booked',booking);assert.equal(calls.length,2);assert.equal(e.DB.sql.prepare('SELECT count(*) AS n FROM dany_sms_log').get().n,2);
 calls=[];e=configured();globalThis.fetch=async()=>{calls.push('network');throw Error('timeout')};r=await notifySms(e,'booked',booking);assert.equal(r.client,'unknown');await notifySms(e,'booked',booking);assert.equal(calls.length,2);
 calls=[];e=env();r=await notifySms(e,'booked',booking);assert.equal(r.enabled,false);assert.equal(calls.length,0);assert.equal(e.DB.sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='dany_sms_log'").get().n,0);
 e=configured();delete e.SMS_ADMIN_PHONE;r=await notifySms(e,'booked',booking);assert.equal(r.enabled,false);
 // Actual booking and cancellation routes must invoke SMS only after a successful mutation.
 calls=[];e=configured();globalThis.fetch=provider();const payload={date,time:'11:30',name:'Test',phone:'0888123456',serviceId:'hyperkeratosis',quantity:1,privacy:true};r=await call(e,'/api/book',payload);assert.equal(r.status,201);assert.equal(calls.length,2);const id=r.data.id;assert.equal((await call(e,'/api/book',payload)).status,409);assert.equal(calls.length,2);r=await call(e,'/api/admin/cancel',{id,reason:'Long private reason stays out of SMS'},true);assert.equal(r.status,200);assert.equal(calls.length,3);assert.equal(r.data.sms.client,'accepted');assert(calls.every(c=>!c.message.includes('private reason')));assert.equal((await call(e,'/api/admin/cancel',{id},true)).status,404);assert.equal(calls.length,3);
 calls=[];e=configured();r=await call(e,'/api/admin/book',payload,true);assert.equal(r.status,200);assert.equal(calls.length,2);
 r=await call(e,'/api/admin/sms-status',null,true);assert.equal(r.status,200);assert.equal(r.data.used,2);assert.equal(r.data.remaining,98);assert.equal((await call(e,'/api/admin/sms-status')).status,401);
 r=await call(e,'/api/schedule');assert.equal(r.data.smsEnabled,true);assert.equal(r.data.smsLimit,100);assert(!JSON.stringify(r.data).includes('test-account'));assert(!JSON.stringify(r.data).includes('897001475'));

 calls=[];e=configured();e.RESEND_API_KEY='test';e.MAIL_FROM='test@example.com';e.NOTIFY_EMAILS='admin@example.com';
 const smsFetch=provider();globalThis.fetch=async(url,options)=>String(url).includes('resend.com')?new Response(JSON.stringify({id:'mail-test'}),{status:200}):smsFetch(url,options);
 async function home(privacy='yes'){const fd=new FormData();for(const [k,v] of Object.entries({name:'Test',phone:'+32471387908',email:'client@example.com',address:'Test address',date,details:'Private medical details',privacy}))fd.set(k,v);const response=await worker.fetch(new Request('https://dany-style.danystyle.workers.dev/api/home-request',{method:'POST',headers:{Origin:'https://www.dany.style'},body:fd}),e);return {status:response.status,data:await response.json()}}
 r=await home();assert.equal(r.status,200);assert.equal(r.data.sms.client,'accepted');assert.equal(calls.length,2);assert(calls[0].message.includes('Получихме заявката'));assert(!calls[0].message.includes('запазен'));assert(!calls.some(c=>c.message.includes('medical')));await home();assert.equal(calls.length,2);assert.equal((await home('no')).status,400);assert.equal(calls.length,2);
 globalThis.fetch=async()=>new Response('{}',{status:500});e=configured();e.RESEND_API_KEY='test';e.MAIL_FROM='test@example.com';e.NOTIFY_EMAILS='admin@example.com';assert.equal((await home()).status,503);assert.equal(e.DB.sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='dany_sms_log'").get().n,0);
 console.log('PASS: home request client/admin SMS, BE mobile, retry deduplication, validation and email failure; no confirmed appointment wording or private details.');
 console.log('PASS: Mobica HTTPS/auth schema, one-part Bulgarian templates, both recipients, phone normalization, BG/BE routing, exact100-attempt atomic cap, concurrent deduplication, no auto-retries, failed/unknown states, disabled defaults, real booking/admin/cancel hooks and private quota status. No live SMS sent.');
}finally{globalThis.fetch=originalFetch}
