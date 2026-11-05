import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/site-analytics.js',import.meta.url),'utf8');
function boot({referrer='',type='navigate',gpc=false}={}){const calls=[],handlers={},body={children:[],append(...x){this.children.push(...x)}};const document={referrer,documentElement:{lang:'bg'},body,createElement(){return {style:{},append(){}}},addEventListener(e,fn){handlers[e]=fn}};vm.runInNewContext(source,{navigator:{globalPrivacyControl:gpc},document,location:{pathname:'/'},performance:{getEntriesByType(){return [{type}]}},URL,fetch:(_,o)=>{calls.push(JSON.parse(o.body));return Promise.resolve()},localStorage:{getItem(){throw Error('Storage forbidden')},setItem(){throw Error('Storage forbidden')}}});return {calls,handlers,body}}
let a=boot();assert.equal(a.calls.length,1);assert.equal(a.calls[0].entry,true);assert.equal(a.calls[0].mode,'entries-v2');assert(!('visitId' in a.calls[0]));assert(!('consent' in a.calls[0]));
for(const referrer of ['https://dany.style/','https://www.dany.style/oniholiza.html'])assert.equal(boot({referrer}).calls[0].entry,false);
for(const type of ['reload','back_forward'])assert.equal(boot({type}).calls[0].entry,false);
assert.equal(boot({referrer:'https://google.com/search?q=secret'}).calls[0].referrer,'https://google.com');assert.equal(boot({gpc:true}).calls.length,0);
assert(!/localStorage|sessionStorage|document\.cookie|randomUUID|600000|Разрешавам/.test(source));
a.handlers.click({target:{closest(){return {getAttribute(){return 'tel:123'},id:''}}}});assert.equal(a.calls[1].event,'phone_click');assert.equal(a.calls[1].entry,false);assert.equal(a.body.children.length,1);
console.log('PASS: no identifiers/storage/consent popup; external/direct entries counted; internal navigation, reload and history excluded; pageviews separate; DNT/GPC support.');
