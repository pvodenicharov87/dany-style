import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const times=Array.from({length:15},(_,i)=>`${String(10+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
const services=[{id:'onycholysis',bg:'Онихолиза',en:'Onycholysis',durations:[30,60]},{id:'thickened',bg:'Удебелени нокти',en:'Thickened nails',durations:[40,80]},{id:'niti',bg:'NiTi',en:'NiTi',durations:[30]},{id:'gel-polish',bg:'Гел лак',en:'Gel polish',durations:[90]},{id:'natural-gel',bg:'Гел върху естествен нокът',en:'Gel on natural nails',durations:[150]},{id:'hyperkeratosis',bg:'Хиперкератоза',en:'Hyperkeratosis',durations:[30,60]},{id:'ingrown',bg:'Впит нокът',en:'Ingrown toenail',durations:[30,60]},{id:'fungal',bg:'Гъбични изменения',en:'Fungal changes',durations:[40,60]},{id:'extensions',bg:'Изграждане с гел',en:'Extensions',durations:[165]}];
class Element{
 constructor(){this.children=[];this.options=[];this.style={};this.textContent='';this.disabled=false;this._value='';this.classList={add(){},remove(){}};this.button=null;this.dataset={};this.hidden=false}
 set value(x){this._value=String(x)}get value(){return this._value}replaceChildren(){this.children=[];this.options=[];this._value=''}append(...x){this.children.push(...x)}add(x){this.options.push(x);if(this.options.length===1)this.value=x.value}querySelector(){return this.button??=new Element()}scrollIntoView(){}reset(){}showModal(){this.open=true}close(){this.open=false}
}
async function boot(path,version='service-duration-v1',occupiedTime='11:00',cancelVersion=1){
 const map=new Map(),get=id=>{if(!map.has(id))map.set(id,new Element());return map.get(id)};get('blockLength').value='90';
 const document={getElementById:get,createElement:()=>new Element(),hidden:false,addEventListener(){}};
 const data={scheduleVersion:version,adminBlockMinutes:90,cancellationEmailVersion:cancelVersion,times,services,items:[{date,time:occupiedTime,kind:'booked',id:'one',name:'Example',duration_minutes:30}],occupied:[{date,time:occupiedTime}]};
 data.availability=times.map(time=>{const start=Number(time.slice(0,2))*60+Number(time.slice(3));return {date,time,services:services.map(s=>({id:s.id,quantities:s.durations.map((duration,i)=>({quantity:i+1,duration})).filter(q=>!(start<(Number(occupiedTime.slice(0,2))*60+Number(occupiedTime.slice(3))+30)&&(Number(occupiedTime.slice(0,2))*60+Number(occupiedTime.slice(3)))<start+q.duration))})).filter(s=>s.quantities.length)}});
 const calls=[];const fetch=async (url,options)=>{calls.push({url,options});const j=String(url).includes('/session')?{ok:true}:String(url).endsWith('/api/admin/cancel')?{ok:true,cancelled:true,clientEmailStatus:data.cancelStatus||'sent'}:data;return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>j}};
 const context={document,fetch,Date,Intl,Map,Set,Array,Number,String,Error,console,Option:class{constructor(text,value){this.text=text;this.value=String(value)}},setInterval(){},window:{addEventListener(){}},confirm:()=>true,FormData:class{get(key){return {privacy:"yes",name:"Test",phone:"123",email:"",service:"Note"}[key]}},JSON};
 const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>path==='admin.html'||m[2].includes('requestNumber=0'));
 for(const script of scripts)vm.runInNewContext(script[2],context);
 for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));return {get,data,calls};
}
for(const path of ['index.html','en/index.html']){
 const ui=await boot(path);await ui.get('bk-days').children.find(x=>x.textContent===now.getDate()).onclick();
 const slot=t=>ui.get('bk-slots').children.find(x=>x.textContent.startsWith(t));assert(!slot('10:00').disabled);assert(!slot('10:30').disabled);assert(slot('11:00').disabled);
 slot('10:00').onclick();assert(ui.get('bk-service').options.some(x=>x.value==='fungal'));assert(!ui.get('bk-service').options.some(x=>x.value==='extensions'));
 ui.get('bk-service').value='ingrown';ui.get('bk-service').onchange();assert.deepEqual(ui.get('bk-quantity').options.map(x=>x.value),['1','2']);
 ui.get('bk-quantity').value='2';ui.get('bk-quantity').onchange();assert(ui.get('bk-summary').textContent.includes('10:00–11:00'));
 slot('10:30').onclick();assert(!ui.get('bk-service').options.some(x=>x.value==='fungal'));ui.get('bk-service').value='ingrown';ui.get('bk-service').onchange();assert.deepEqual(ui.get('bk-quantity').options.map(x=>x.value),['1']);
 slot('17:00').onclick();ui.get('bk-service').value='extensions';ui.get('bk-service').onchange();assert(ui.get('bk-summary').textContent.includes('17:00–19:45'));assert(ui.get('bk-quantity-label').hidden);await ui.get('bk-form').onsubmit({preventDefault(){},currentTarget:ui.get('bk-form')});const payload=JSON.parse(ui.calls.find(c=>c.url.endsWith('/api/book')).options.body);assert.equal(payload.serviceId,'extensions');assert.equal(payload.quantity,1);assert.equal(payload.time,'17:00');

 slot('17:00').onclick();
 const prices={ingrown:['20 €','40 €'],onycholysis:['15 €','30 €'],thickened:['20 €','40 €'],fungal:['10 €','20 €'],hyperkeratosis:['20 €','40 €'],niti:['30 €'],'gel-polish':['25 €'],'natural-gel':['30–35 €'],extensions:['50 €']};
 for(const [id,expected] of Object.entries(prices)){
  assert(ui.get('bk-service').options.find(x=>x.value===id).text.endsWith(expected[0]),id);
  ui.get('bk-service').value=id;ui.get('bk-service').onchange();
  assert.equal(ui.get('bk-quantity').options.length,expected.length);
  for(let i=0;i<expected.length;i++){
   assert(ui.get('bk-quantity').options[i].text.endsWith(expected[i]),id);
   ui.get('bk-quantity').value=String(i+1);ui.get('bk-quantity').onchange();
   assert(ui.get('bk-service').options.find(x=>x.value===id).text.endsWith(expected[i]),id);
  }
 }
 assert(!ui.get('bk-service').options.some(x=>/home.visit|домашно/i.test(x.text)));
 ui.get('bk-service').value='gel-polish';ui.get('bk-service').onchange();assert(ui.get('bk-summary').textContent.includes('17:00–18:30'));
 const old=await boot(path,'half-hour-90-v1');await old.get('bk-days').children.find(x=>x.textContent===now.getDate()).onclick();assert.equal(old.get('bk-slots').children.length,15);assert(old.get('bk-service-fields').hidden);
}
const ui=await boot('admin.html');assert.equal(ui.get('slots').children.length,15);assert(ui.get('time').options.some(x=>x.value==='10:00'));
ui.get('time').value='10:00';ui.get('time').onchange();ui.get('serviceSelect').value='ingrown';ui.get('serviceSelect').onchange();assert.deepEqual(ui.get('serviceQuantity').options.map(x=>x.value),['1','2']);
ui.get('time').value='10:30';ui.get('time').onchange();ui.get('serviceSelect').value='ingrown';ui.get('serviceSelect').onchange();assert.deepEqual(ui.get('serviceQuantity').options.map(x=>x.value),['1']);
ui.get('client').value='Test';ui.get('telephone').value='123';await ui.get('add').onsubmit({preventDefault(){}});const payload=JSON.parse(ui.calls.find(c=>c.url.endsWith('/api/admin/book')).options.body);assert.equal(payload.serviceId,'ingrown');assert.equal(payload.quantity,1);assert.equal(payload.time,'10:30');ui.get('blockLength').value='30';ui.get('blockLength').onchange();const b=ui.get('slots').children.find(x=>x.textContent.startsWith('10:30'));assert(!b.disabled);await b.onclick();assert(!ui.calls.some(x=>x.url.endsWith('/api/admin/slot')));await ui.get('manualBlock').onclick();assert.equal(JSON.parse(ui.calls.find(x=>x.url.endsWith('/api/admin/slot')).options.body).duration_minutes,30);
console.log('PASS: actual BG/EN and admin scripts filter services and quantities by gap, show exact end times, allow17:00 long service, custom admin blocks and legacy Worker fallback.');

for(const quantity of [1,2]){
 const panel=await boot('admin.html','service-duration-v1','13:30');
 for(const t of ['12:30','13:00'])assert(!panel.get('slots').children.find(x=>x.textContent.startsWith(t)).disabled,'free30min cell must stay selectable despite90min manual duration');
 const clicked=panel.get('slots').children.find(x=>x.textContent.startsWith('11:30'));await clicked.onclick();assert.equal(panel.get('time').value,'11:30');assert(!panel.calls.some(c=>c.url.endsWith('/api/admin/slot')));
 panel.get('serviceSelect').value='hyperkeratosis';panel.get('serviceSelect').onchange();panel.get('serviceQuantity').value=String(quantity);panel.get('serviceQuantity').onchange();
 assert(panel.get('bookingEnd').textContent.startsWith(quantity===1?'11:30–12:00':'11:30–12:30'));
 panel.get('client').value='Test';await panel.get('add').onsubmit({preventDefault(){}});const request=JSON.parse(panel.calls.find(c=>c.url.endsWith('/api/admin/book')).options.body);assert.equal(request.time,'11:30');assert.equal(request.serviceId,'hyperkeratosis');assert.equal(request.quantity,quantity);
}
console.log('PASS regression: grid click selects exact11:30 without manual block; hyperkeratosis1/2 ends12:00/12:30; prior free cells stay enabled.');

for(const status of ['sent','failed','not_provided']){
 const panel=await boot('admin.html');panel.data.cancelStatus=status;
 await panel.get('calendar').children.find(x=>x.textContent===now.getDate()).onclick();const cancel=panel.get('items').children[0].children[0];cancel.onclick();
 assert(panel.get('cancelDialog').open);assert(!panel.calls.some(x=>x.url.endsWith('/api/admin/cancel')));panel.get('cancelReason').value='Налага се промяна.';
 await panel.get('cancelForm').onsubmit({preventDefault(){}});assert(!panel.get('cancelDialog').open);
 const body=JSON.parse(panel.calls.find(x=>x.url.endsWith('/api/admin/cancel')).options.body);assert.equal(body.id,'one');assert.equal(body.reason,'Налага се промяна.');
 assert(panel.get('msg').textContent.includes(status==='sent'?'изпратено':status==='failed'?'не е потвърдено':'Няма имейл'));
}
console.log('PASS: cancellation dialog requires confirmation, submits optional reason and displays separate sent/failed/no-email statuses.');

const pendingWorker=await boot('admin.html','service-duration-v1','11:00',0);await pendingWorker.get('calendar').children.find(x=>x.textContent===now.getDate()).onclick();pendingWorker.get('items').children[0].children[0].onclick();assert(pendingWorker.get('confirmCancellation').disabled);await pendingWorker.get('cancelForm').onsubmit({preventDefault(){}});assert(!pendingWorker.calls.some(x=>x.url.endsWith('/api/admin/cancel')));pendingWorker.get('cancelBack').onclick();assert(!pendingWorker.get('cancelDialog').open);console.log('PASS: old Worker capability gate prevents unnotified cancellation; Back closes without deleting.');
