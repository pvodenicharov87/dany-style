import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const times=Array.from({length:15},(_,i)=>`${String(10+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
class Element{
 constructor(){this.children=[];this.options=[];this.style={};this.textContent='';this.disabled=false;this.value='';this.classList={add(){},remove(){}};this.button=null;this.dataset={}}
 replaceChildren(){this.children=[];this.options=[]}append(...x){this.children.push(...x)}add(x){this.options.push(x);if(!this.value)this.value=x.value}querySelector(){return this.button??=new Element()}scrollIntoView(){}reset(){}
}
async function boot(path,newAPI,manualBlock=false){
 const map=new Map(),get=id=>{if(!map.has(id))map.set(id,new Element());return map.get(id)};
 const document={getElementById:get,createElement:()=>new Element(),hidden:false,addEventListener(){}};
 const data=newAPI?{scheduleVersion:'half-hour-90-v1',adminBlockMinutes:90,times,items:[{date,time:'11:00',kind:'booked',id:'one',name:'Example',duration_minutes:90}],occupied:['10:00','10:30','11:00','11:30','12:00'].map(time=>({date,time}))}:{items:[{date,time:'10:00',sourceTime:'10:00',kind:'booked',id:'one'}],occupied:[{date,time:'10:00'}]};
 if(manualBlock){data.items=[{date,time:'13:00',kind:'blocked',duration_minutes:90}];data.occupied=['12:00','12:30','13:00','13:30','14:00'].map(time=>({date,time}));}
 const calls=[];const fetch=async (url,options)=>{calls.push({url,options});const j=String(url).includes('/session')?{ok:true}:String(url).includes('/login')?{token:'test'}:data;return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>j}};
 const context={document,fetch,Date,Intl,Map,Set,Array,Number,String,Error,console,Option:class{constructor(text,value){this.text=text;this.value=value}},setInterval(){},window:{addEventListener(){}},confirm:()=>true,FormData:class{},JSON};
 const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>path==='admin.html'||m[2].includes('requestNumber=0'));
 for(const script of scripts)vm.runInNewContext(script[2],context);
 for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));return {get,data,calls};
}
for(const newAPI of [false,true]){
 const admin=await boot('admin.html',newAPI);
 assert.equal(admin.get('slots').children.length,newAPI?15:6);
 if(newAPI){
  const opts=admin.get('time').options.map(x=>x.value);for(const t of ['10:00','10:30','11:00','11:30','12:00'])assert(!opts.includes(t),t);assert(opts.includes('12:30'));assert(opts.includes('17:00'));
  assert.equal(admin.get('items').children.length,1);assert(admin.get('items').children[0].textContent.startsWith('11:00–12:30'));
  assert(admin.get('slots').children.find(x=>x.textContent.startsWith('10:00')).disabled);assert(admin.get('slots').children.find(x=>x.textContent.startsWith('10:00')).textContent.includes('няма 90 мин.'));
  assert(admin.get('slots').children.find(x=>x.textContent.startsWith('11:30')).textContent.includes('резервиран'));
 }
 for(const path of ['index.html','en/index.html']){
  const ui=await boot(path,newAPI);const day=ui.get('bk-days').children.find(x=>x.textContent===now.getDate());await day.onclick();
  const slots=ui.get('bk-slots').children;assert.equal(slots.length,newAPI?15:6);
  if(newAPI){assert(slots.find(x=>x.textContent.startsWith('10:30')).disabled);assert(!slots.find(x=>x.textContent==='12:30').disabled);assert(!slots.find(x=>x.textContent==='17:00').disabled)}
 }
}
const blocked=await boot('admin.html',true,true);
for(const t of ['13:00','13:30','14:00'])assert(blocked.get('slots').children.find(x=>x.textContent.startsWith(t)).textContent.includes('блокиран'));
for(const t of ['12:00','12:30'])assert(blocked.get('slots').children.find(x=>x.textContent.startsWith(t)).disabled);
const next=blocked.get('slots').children.find(x=>x.textContent.startsWith('14:30'));assert(!next.disabled);await next.onclick();
const write=blocked.calls.find(x=>String(x.url).endsWith('/api/admin/slot'));assert.deepEqual(JSON.parse(write.options.body),{date,time:'14:30',action:'block'});
console.log('PASS: real BG/EN client and admin scripts execute against new and legacy API responses; slot grids, 90-minute phone options, booking list and rollout fallback agree.');
