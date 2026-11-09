var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
// src/worker.js
var TIMES = Array.from({length:15},(_,i)=>{const m=600+i*30;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")});
const SCHEDULE_VERSION = "service-duration-v1";
const SERVICES = [{"id": "ingrown", "bg": "Впит нокът", "en": "Ingrown toenail", "durations": [30, 60]}, {"id": "onycholysis", "bg": "Онихолиза", "en": "Onycholysis", "durations": [30, 60]}, {"id": "thickened", "bg": "Удебелени и деформирани нокти", "en": "Thickened and deformed nails", "durations": [40, 80]}, {"id": "fungal", "bg": "Гъбични изменения по ноктите", "en": "Fungal nail changes", "durations": [40, 60]}, {"id": "hyperkeratosis", "bg": "Хиперкератоза", "en": "Hyperkeratosis", "durations": [30, 60]}, {"id": "niti", "bg": "Корекция с NiTi", "en": "NiTi nail correction", "durations": [30]}, {"id": "gel-polish", "bg": "Гел лак", "en": "Gel polish", "durations": [90]}, {"id": "natural-gel", "bg": "Гел лак върху естествен нокът", "en": "Gel polish on natural nails", "durations": [90], "price": 30}, {"id": "extensions", "bg": "Изграждане с гел", "en": "Gel nail extensions", "durations": [165]}, {"id": "medical-pedicure", "bg": "Медицински педикюр мъже", "en": "Medical pedicure for men", "durations": [90], "price": 40}, {"id": "medical-pedicure-women", "bg": "Медицински педикюр жени", "en": "Medical pedicure for women", "durations": [90], "price": 35}, {"id": "pedicure-gel-polish", "bg": "Педикюр с гел лак", "en": "Pedicure with gel polish", "durations": [90], "price": 30}];
const LEGACY_TIMES = ["10:00","11:30","13:00","14:30","16:00","17:30"];
const APPOINTMENT_MINUTES = 90;
var json =  __name((v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } }), "json");
var err =  __name((message, status = 400) => json({ error: message }, status), "err");
var safe =  __name((s, max = 2e3) => String(s ?? "").trim().slice(0, max), "safe");
var validDate =  __name((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z")) && ( new Date(s + "T12:00:00Z")).toISOString().slice(0, 10) === s, "validDate");
var validTime =  __name((s) => TIMES.includes(s), "validTime");
var validEmail =  __name((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 160, "validEmail");
var localDate =  __name(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).format( new Date()), "localDate");
var future =  __name((s) => validDate(s) && s >= localDate() && s <= new Date(Date.now() + 370 * 864e5).toISOString().slice(0, 10), "future");
var b64 =  __name((u) => btoa(String.fromCharCode(...u)), "b64");
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const msg = b64(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return msg + "." + b64(new Uint8Array(sig)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
__name(sign, "sign");
async function verify(token, secret) {
  try {
    const [msg, sig] = token.split(".");
    if (!msg || !sig) return false;
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(msg), (c) => c.charCodeAt(0))));
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return false;
    return (await sign(payload, secret)).split(".")[1] === sig;
  } catch {
    return false;
  }
}
__name(verify, "verify");
async function sendMail(env, subject, body, clientEmail, attachments = [], cancellation = null) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  const recipients = [...new Set((env.NOTIFY_EMAILS || "").split(",").map(x => x.trim()).filter(Boolean))];
  if (!recipients.length && !cancellation) return false;
  const text = body.split("\n").filter(line => !/^Номер:/.test(line)).join("\n");
  const fields = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2];
  }
  const booking = subject.startsWith("Резервация") || Boolean(cancellation);
  const date = fields[booking ? "Дата" : "Предпочитана дата"] || "";
  const prettyDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join(".") : date;
  const clientSubject = cancellation ? "Dany Style — отмяна на Вашия час" : booking ? "Dany Style — потвърждение на Вашия час" : "Dany Style — получихме Вашата заявка";
  const greeting = fields["Име"] ? "Здравейте, " + fields["Име"] + "," : "Здравейте,";
  const intro = cancellation ? "Уведомяваме Ви, че Вашата резервация в Dany Style е отменена." : booking
    ? "Благодарим Ви за доверието. Вашият час в Dany Style е запазен."
    : "Благодарим Ви за заявката за домашно посещение. Ще се свържа с Вас, за да уточним подробностите и да потвърдим удобен час. Това писмо не е потвърждение на резервация.";
  const rows = booking
    ? [["Дата", prettyDate], ["Час", fields["Час"]], ["Продължителност", fields["Продължителност"]], ["Услуга / бележка", fields["Услуга"]]]
    : [["Предпочитана дата", prettyDate], ["Адрес", fields["Адрес"]]];
  const details = rows.filter(([, value]) => value);
  const closing = cancellation ? "Моля, приемете извиненията ми за причиненото неудобство. Ще се радвам да изберете нов удобен час през сайта или да се свържете с мен на 0897 001 475." : booking
    ? "Очаквам Ви! Ако се налага промяна или отмяна на часа, моля свържете се с мен на 0897 001 475."
    : "Ако имате допълнителни въпроси, можете да се свържете с мен на 0897 001 475.";
  const reason = cancellation ? (cancellation.reason || "За съжаление, поради непредвидени обстоятелства се налага да отменим Вашата резервация.") : "";
  const signature = "Поздрави,\nДаниела Ангелова\nПодолог | Dany Style";
  const clientText = ["Dany Style", "", greeting, "", intro, "", ...details.map(([label,value]) => label + ": " + value), ...(booking ? ["Адрес: гр. Пловдив, ж.к. Тракия, ул. Съединение 45"] : []), ...(cancellation ? ["", reason] : []), "", closing, "", signature, "https://www.dany.style/"].join("\n");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#fbf5f7;color:#493641;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf5f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #eedde4;border-radius:16px"><tr><td style="padding:28px 24px 20px;border-bottom:1px solid #eedde4"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="https://www.dany.style/assets/home-0.png" width="72" height="72" alt="Лого Dany Style" style="display:block;width:72px;height:72px;border:0"></td><td style="padding-left:16px"><strong style="font-family:Georgia,serif;font-size:27px;color:#8b526c">Dany Style</strong><br><span style="font-size:13px;color:#77616d">Подологична грижа · Даниела Ангелова</span></td></tr></table></td></tr><tr><td style="padding:26px 24px;font-size:16px;line-height:1.65"><p style="margin:0 0 18px">${escape(greeting)}</p><p style="margin:0 0 22px">${escape(intro)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf4f7;border-radius:10px">${details.map(([label,value]) => `<tr><td style="padding:10px 14px;vertical-align:top;font-size:14px;color:#765368;width:34%">${escape(label)}</td><td style="padding:10px 14px;font-size:15px;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join("")}</table>${booking ? '<p style="font-size:14px;color:#77616d;margin:18px 0">гр. Пловдив, ж.к. Тракия<br>ул. Съединение 45</p>' : ''}${cancellation ? `<p style="margin:22px 0;white-space:pre-wrap;overflow-wrap:anywhere">${escape(reason)}</p>` : ""}<p style="margin:22px 0">${escape(closing)}</p>${cancellation ? '<p style="margin:22px 0"><a href="https://www.dany.style/#rezervacii" style="display:inline-block;background:#8b526c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Изберете нов час</a></p>' : ""}<p style="margin:0">Поздрави,<br><strong style="color:#8b526c">Даниела Ангелова</strong><br><span style="font-size:14px;color:#77616d">Подолог | Dany Style</span></p></td></tr><tr><td style="padding:18px 24px;border-top:1px solid #eedde4;font-size:13px;color:#77616d"><a href="tel:+359897001475" style="color:#8b526c">0897 001 475</a> &nbsp;·&nbsp; <a href="https://www.dany.style/" style="color:#8b526c">www.dany.style</a></td></tr></table></td></tr></table></body></html>`;
  const send = async (to, sub, plain, files = [], markup) => {
    try {
      const payload = {from: env.MAIL_FROM, to: [to], subject: sub, text: plain};
      if (files.length) payload.attachments = files;
      if (markup) payload.html = markup;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      if (!response.ok) console.error("Email provider error", response.status);
      return response.ok;
    } catch {
      console.error("Email delivery request failed");
      return false;
    }
  };
  const results = cancellation ? [] : await Promise.all(recipients.map(to => send(to, subject, text, attachments)));
  const clientSent = clientEmail ? await send(clientEmail, clientSubject, clientText, [], html) : true;
  return results.every(Boolean) && clientSent;
}
__name(sendMail, "sendMail");

const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3));
const durationOf = row => Number(row.duration_minutes) > 0 ? Number(row.duration_minutes) : (row.kind === "booked" || LEGACY_TIMES.includes(row.time) ? 90 : 60);
const overlaps = (time,row,duration=APPOINTMENT_MINUTES) => minutes(time) < minutes(row.time)+durationOf(row) && minutes(row.time) < minutes(time)+duration;
const scheduleInfo = {scheduleVersion:SCHEDULE_VERSION,times:TIMES,appointmentMinutes:APPOINTMENT_MINUTES,stepMinutes:30,adminBlockMinutes:90,services:SERVICES,cancellationEmailVersion:1,bookingDetailsVersion:1};
const expandSlots = rows => rows.flatMap(row => TIMES.filter(time=>overlaps(time,row,30)).map(time=>({date:row.date,time})));
const schemaChecks = new WeakMap();
async function ensureScheduleSchema(db) {
  if (!schemaChecks.has(db)) schemaChecks.set(db,(async()=>{
    const columns = await db.prepare("PRAGMA table_info(slots)").all();
    for(const [name,type] of [['duration_minutes','INTEGER'],['created_at','INTEGER'],['source','TEXT']]){
      if(!columns.results.some(c=>c.name===name)){
        try{await db.prepare('ALTER TABLE slots ADD COLUMN '+name+' '+type).run()}
        catch(e){const current=await db.prepare('PRAGMA table_info(slots)').all();if(!current.results.some(c=>c.name===name))throw e}
      }
    }
  })().catch(e=>{schemaChecks.delete(db);throw e}));
  await schemaChecks.get(db);
}
// The overlap predicate and insertion run in ONE SQLite statement. Different
// start times therefore cannot race past a separate JavaScript availability check.
const SQL_MINUTES = "(CAST(substr(time,1,2) AS INTEGER)*60+CAST(substr(time,4,2) AS INTEGER))";
const SQL_DURATION = "COALESCE(duration_minutes,CASE WHEN kind='booked' OR time IN ('10:00','11:30','13:00','14:30','16:00','17:30') THEN 90 ELSE 60 END)";
const CONFLICT_SQL = `SELECT 1 FROM slots WHERE date=? AND ${SQL_MINUTES}<? AND ${SQL_MINUTES}+${SQL_DURATION}>?`;
async function insertBooking(env,date,time,booking) {
  const result=await env.DB.prepare(`INSERT INTO slots(date,time,kind,id,name,phone,email,service,duration_minutes,created_at,source) SELECT ?,?,'booked',?,?,?,?,?,?,?,? WHERE NOT EXISTS (${CONFLICT_SQL})`)
    .bind(date,time,booking.id,booking.name,booking.phone||"",booking.email||"",booking.service||"",booking.duration||90,Date.now(),booking.source||"website",date,minutes(time)+(booking.duration||90),minutes(time)).run();
  return result.meta.changes === 1;
}
function selection(b) {
  if (!b.serviceId) {
    if (b.quantity !== undefined || b.duration_minutes !== undefined) return null;
    return {service:safe(b.service,1000),duration:90};
  }
  const item=SERVICES.find(s=>s.id===b.serviceId), quantity=Number(b.quantity ?? 1);
  if (!item || !Number.isInteger(quantity) || quantity<1 || quantity>item.durations.length) return null;
  return {service:item.bg+(item.variants?` — ${item.variants[quantity-1].bg} — ${item.variants[quantity-1].price} €`:item.price?` — ${item.price} €`:item.durations.length>1?` — ${quantity} бр.`:"")+(safe(b.notes,700)?" • "+safe(b.notes,700):""),duration:item.durations[quantity-1]};
}
function publicAvailability(rows,from,to) {
  const out=[];
  for(let date=from;date<=to;date=new Date(Date.parse(date+"T12:00:00Z")+86400000).toISOString().slice(0,10)) {
    for(const time of TIMES) out.push({date,time,services:SERVICES.map(s=>({id:s.id,quantities:s.durations.map((duration,i)=>({quantity:i+1,duration})).filter(q=>!rows.some(x=>x.date===date&&overlaps(time,x,q.duration)))})).filter(s=>s.quantities.length)});
  }
  return out;
}
function blockStatement(db,date,time,duration=30) {
  return db.prepare(`INSERT INTO slots(date,time,kind,duration_minutes) SELECT ?,?,'blocked',? WHERE NOT EXISTS (${CONFLICT_SQL})`)
    .bind(date,time,duration,date,minutes(time)+duration,minutes(time));
}

// Transactional SMS: Mobica v2, one short Unicode message per recipient.
// Secrets live only in Worker environment variables; SMS stays off until configured.
function smsPhone(value) {
  let phone=String(value||"").replace(/[\s().-]/g,"");
  if(phone.startsWith("+"))phone=phone.slice(1);
  if(phone.startsWith("00"))phone=phone.slice(2);
  if(/^0[789]\d{8}$/.test(phone))phone="359"+phone.slice(1);
  if(/^3590[789]\d{8}$/.test(phone))phone="359"+phone.slice(4);
  if(/^3204\d{8}$/.test(phone))phone="32"+phone.slice(3);
  return /^(?:359(?:87|88|89|98|99)\d{7}|324\d{8})$/.test(phone)?phone:null;
}
const smsLimit=env=>{const n=Number(env.SMS_MAX_MESSAGES||100);return Number.isInteger(n)&&n>=1&&n<=10000?n:100};
const smsConfigured=env=>env.SMS_ENABLED==="true"&&Boolean(env.MOBICA_USER)&&Boolean(env.MOBICA_PASSWORD)&&Boolean(smsPhone(env.SMS_ADMIN_PHONE));
const smsSchema=new WeakMap();
async function ensureSmsSchema(db){
  if(!smsSchema.has(db))smsSchema.set(db,db.prepare("CREATE TABLE IF NOT EXISTS dany_sms_log (message_key TEXT PRIMARY KEY,event TEXT NOT NULL,recipient_role TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,provider_code TEXT)").run().catch(e=>{smsSchema.delete(db);throw e}));
  await smsSchema.get(db);
}
function smsMessage(event,booking,role){
  if(event==="request")return role==="client"?"Dany Style: Получихме заявката Ви. Ще се свържем с Вас.":"Dany Style: Нова заявка. Проверете имейла си.";
  const date=String(booking.date).split("-").reverse().join("."),when=date+", "+booking.time;
  if(role==="client")return event==="booked"?"Dany Style: Часът Ви е запазен за "+when+".":"Dany Style: Часът Ви на "+when+" е отменен.";
  const phone=smsPhone(booking.phone),contact=phone?"0"+phone.slice(3):"няма";
  return event==="booked"?"Dany Style: Нов час "+when+". Тел. "+contact:"Dany Style: Отменен час "+when+".";
}
async function sendSmsOnce(env,event,booking,role,phone){
  if(!phone)return "unsupported_phone";
  const message=smsMessage(event,booking,role);
  // Mobica documents67 Unicode characters per part. Never allow a paid second part.
  if(message.length>67)return "too_long";
  const key=booking.id+":"+event+":"+role;
  try{
    await ensureSmsSchema(env.DB);
    // Reservation of quota and deduplication happen atomically, including across isolates.
    const claimed=await env.DB.prepare("INSERT INTO dany_sms_log(message_key,event,recipient_role,created_at,status) SELECT ?,?,?,?, 'reserved' WHERE NOT EXISTS(SELECT 1 FROM dany_sms_log WHERE message_key=?) AND (SELECT COUNT(*) FROM dany_sms_log)<?").bind(key,event,role,Date.now(),key,smsLimit(env)).run();
    if(!claimed.meta.changes){const prior=await env.DB.prepare("SELECT status FROM dany_sms_log WHERE message_key=?").bind(key).first();return prior?prior.status:"quota_reached"}
    let status="unknown",providerCode="";
    try{
      const bytes=new TextEncoder().encode(String(env.MOBICA_USER)+":"+String(env.MOBICA_PASSWORD));
      const response=await fetch("https://gate.mobica.bg/v2/multi/json/sms.php",{method:"POST",headers:{Authorization:"Basic "+b64(bytes),Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({sms:[{idd:key,phone,message}]}),signal:AbortSignal.timeout(10000)});
      const result=await response.json().catch(()=>null);
      providerCode=String(result?.code||response.status).slice(0,20);
      status=response.ok&&Number(result?.code)===1004?"accepted":(result?.code?"rejected":"unknown");
    }catch{status="unknown"}
    await env.DB.prepare("UPDATE dany_sms_log SET status=?,provider_code=? WHERE message_key=?").bind(status,providerCode,key).run();
    return status;
  }catch{console.error("SMS notification processing failed");return "unconfirmed"}
}
async function notifySms(env,event,booking){
  if(!smsConfigured(env))return {enabled:false};
  const clientPhone=smsPhone(booking.phone),adminPhone=smsPhone(env.SMS_ADMIN_PHONE);
  // The client has priority when only one message remains in the100-message limit.
  const client=await sendSmsOnce(env,event,booking,"client",clientPhone);
  const admin=event==="cancelled"?"not_required":clientPhone===adminPhone?"same_recipient":await sendSmsOnce(env,event,booking,"admin",adminPhone);
  const extraPhone=smsPhone(env.SMS_ADMIN_PHONE_EXTRA);
  const adminExtra=event==="cancelled"?"not_required":!extraPhone?"not_configured":extraPhone===clientPhone||extraPhone===adminPhone?"same_recipient":await sendSmsOnce(env,event,booking,"admin_extra",extraPhone);
  return {enabled:true,client,admin,adminExtra};
}
async function smsOverview(env){
  await ensureSmsSchema(env.DB);
  const row=await env.DB.prepare("SELECT COUNT(*) AS used FROM dany_sms_log").first();
  const used=Number(row?.used||0),limit=smsLimit(env);
  return {enabled:smsConfigured(env),provider:"mobica",limit,used,remaining:Math.max(0,limit-used)};
}

const ANALYTICS_PAGES=new Set(["/","/index.html","/en/index.html","/za-daniela.html","/en/about-daniela.html","/medicinski-pedikyur-po-domovete-plovdiv.html","/en/home-visit-medical-pedicure-plovdiv.html","/vpit-nokat.html","/en/ingrown-toenail.html","/gabichni-izmenenia.html","/en/nail-changes.html","/oniholiza.html","/en/onycholysis.html","/udebeleni-nokti.html","/en/thickened-toenails.html","/niti.html","/en/niti-nail-correction.html","/gel-estestven-nokat.html","/en/gel-natural-nails.html","/izgrazhdane-gel.html","/en/gel-nail-extensions.html","/gellak.html","/en/gel-polish.html","/hiperkeratoza.html","/en/hyperkeratosis.html"]);
const analyticsSchema=new WeakMap();
async function ensureAnalytics(db){
 if(!analyticsSchema.has(db))analyticsSchema.set(db,db.prepare('CREATE TABLE IF NOT EXISTS site_analytics (day TEXT NOT NULL,hour INTEGER NOT NULL,event TEXT NOT NULL,page TEXT NOT NULL,country TEXT NOT NULL,city TEXT NOT NULL,referrer TEXT NOT NULL,total INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,hour,event,page,country,city,referrer))').run().catch(e=>{analyticsSchema.delete(db);throw e}));
 await analyticsSchema.get(db);
}
const analyticsRate=new Map();
function analyticsAllowed(request){
 const ua=request.headers.get('user-agent')||'';if(/bot|crawler|spider|headless|preview/i.test(ua))return false;
 const ip=request.headers.get('CF-Connecting-IP')||'unknown',now=Date.now(),prior=analyticsRate.get(ip);
 if(prior&&now-prior.at<60000){if(prior.count>=40)return false;prior.count++}else analyticsRate.set(ip,{at:now,count:1});
 if(analyticsRate.size>2000)analyticsRate.clear();return true;
}
const visitSchema=new WeakMap();
async function ensureVisits(db){
 if(!visitSchema.has(db))visitSchema.set(db,(async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS site_visits (id TEXT PRIMARY KEY,day TEXT NOT NULL,started_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,country TEXT NOT NULL,city TEXT NOT NULL,referrer TEXT NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS site_visits_day ON site_visits(day)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_daily (day TEXT PRIMARY KEY,total INTEGER NOT NULL)').run();
 await db.prepare('INSERT OR IGNORE INTO site_visit_daily(day,total) SELECT day,COUNT(*) FROM site_visits GROUP BY day').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_events (id TEXT PRIMARY KEY,visit_id TEXT NOT NULL,at INTEGER NOT NULL,event TEXT NOT NULL,page TEXT NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS site_visit_events_visit ON site_visit_events(visit_id,at)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_pages(id TEXT PRIMARY KEY,visit_id TEXT NOT NULL,page TEXT NOT NULL,opened_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,active_ms INTEGER NOT NULL DEFAULT 0)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS site_visit_pages_visit ON site_visit_pages(visit_id,opened_at)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS site_visit_page_bases(id TEXT PRIMARY KEY,base_ms INTEGER NOT NULL)').run();
 })().catch(e=>{visitSchema.delete(db);throw e}));await visitSchema.get(db);
}
// Entry records cannot be joined to subsequent browsing: no client identifier is received.
async function recordEntry(env,body,geo,day){
 if(body.mode!=='entries-v2'||body.event!=='pageview'||body.entry!==true||geo.referrer==='Вътрешна страница')return;
 await ensureVisits(env.DB);const now=Date.now(),id=crypto.randomUUID();
 await env.DB.batch([
 env.DB.prepare('INSERT INTO site_visits(id,day,started_at,last_seen,country,city,referrer) VALUES(?,?,?,?,?,?,?)').bind(id,day,now,now,geo.country,geo.city,geo.referrer),
 env.DB.prepare('INSERT INTO site_visit_daily(day,total) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET total=total+1').bind(day),
 env.DB.prepare('INSERT INTO site_visit_events(id,visit_id,at,event,page) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,now,'pageview',body.page)
 ]);
 await env.DB.prepare('DELETE FROM site_visit_events WHERE at<?').bind(now-30*864e5).run();
 await env.DB.prepare('DELETE FROM site_visits WHERE last_seen<?').bind(now-30*864e5).run();
}
const visitUuid=value=>/^[-a-f0-9]{36}$/.test(value||'');
const ANALYTICS_RESET='visits-reset-2026-11-06-v6';
const analyticsReady=new WeakMap();
async function ensureAnalyticsReady(db){
 if(!analyticsReady.has(db))analyticsReady.set(db,(async()=>{
 await ensureAnalytics(db);await ensureVisits(db);
 await db.prepare('CREATE TABLE IF NOT EXISTS site_analytics_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
 // Explicitly authorized reset, once per database, atomic across analytics tables only.
 const statements=['site_visit_page_bases','site_visit_pages','site_visit_events','site_visits','site_visit_daily','site_analytics'].map(table=>db.prepare('DELETE FROM '+table+' WHERE NOT EXISTS (SELECT 1 FROM site_analytics_meta WHERE key=?)').bind(ANALYTICS_RESET));
 statements.push(db.prepare('INSERT OR IGNORE INTO site_analytics_meta(key,value) VALUES(?,?)').bind(ANALYTICS_RESET,String(Date.now())));
 await db.batch(statements);
 })().catch(e=>{analyticsReady.delete(db);throw e}));await analyticsReady.get(db);
}
async function analyticsScopedId(kind,id,day){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ANALYTICS_RESET+':'+kind+':'+day+':'+id));const h=Array.from(new Uint8Array(bytes)).slice(0,16).map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
async function recordLinkedVisit(env,body,geo,day){
 if(!visitUuid(body.visitId)||!visitUuid(body.viewId)||!visitUuid(body.eventId)||!Number.isInteger(body.activeMs)||body.activeMs<0||body.activeMs>86400000)return false;
 await ensureAnalyticsReady(env.DB);const now=Date.now(),visitId=await analyticsScopedId('visit',body.visitId,day),viewId=await analyticsScopedId('view',body.viewId,day);
 const statements=[
 env.DB.prepare('INSERT OR IGNORE INTO site_visits(id,day,started_at,last_seen,country,city,referrer) VALUES(?,?,?,?,?,?,?)').bind(visitId,day,now,now,geo.country,geo.city,geo.referrer),
 env.DB.prepare('INSERT INTO site_visit_daily(day,total) SELECT ?,1 WHERE changes()=1 ON CONFLICT(day) DO UPDATE SET total=total+1').bind(day),
 env.DB.prepare('UPDATE site_visits SET last_seen=MAX(last_seen,?) WHERE id=?').bind(now,visitId),
 env.DB.prepare('INSERT OR IGNORE INTO site_visit_page_bases(id,base_ms) VALUES(?,?)').bind(viewId,body.event==='pageview'?0:body.activeMs),
 env.DB.prepare('INSERT OR IGNORE INTO site_visit_pages(id,visit_id,page,opened_at,last_seen,active_ms) SELECT ?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM site_visit_pages WHERE visit_id=?)<500').bind(viewId,visitId,body.page,now,now,visitId),
 // Also establishes the visible page when a tab continues into a new calendar day.
 env.DB.prepare("INSERT OR IGNORE INTO site_visit_events(id,visit_id,at,event,page) SELECT ?,?,?,'pageview',? WHERE (SELECT COUNT(*) FROM site_visit_events WHERE visit_id=?)<500").bind(viewId,visitId,now,body.page,visitId),
 env.DB.prepare('UPDATE site_visit_pages SET active_ms=MAX(active_ms,MIN(MAX(0,?-(SELECT base_ms FROM site_visit_page_bases WHERE id=?)),MAX(0,?-opened_at))),last_seen=MAX(last_seen,?) WHERE id=? AND visit_id=? AND page=?').bind(body.activeMs,viewId,now,now,viewId,visitId,body.page)
 ];
 if(!['pageview','heartbeat'].includes(body.event))statements.push(env.DB.prepare('INSERT OR IGNORE INTO site_visit_events(id,visit_id,at,event,page) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM site_visit_events WHERE visit_id=?)<500').bind(await analyticsScopedId('event',body.eventId,day),visitId,now,body.event,body.page,visitId));
 await env.DB.batch(statements);
 await env.DB.prepare('DELETE FROM site_visit_pages WHERE last_seen<?').bind(now-30*864e5).run();
 await env.DB.prepare('DELETE FROM site_visit_page_bases WHERE NOT EXISTS (SELECT 1 FROM site_visit_pages WHERE site_visit_pages.id=site_visit_page_bases.id)').run();
 await env.DB.prepare('DELETE FROM site_visit_events WHERE at<?').bind(now-30*864e5).run();
 await env.DB.prepare('DELETE FROM site_visits WHERE last_seen<?').bind(now-30*864e5).run();return true;
}
async function visitPeriodSummary(db,from,to,total){
 const recorded=await db.prepare('SELECT COUNT(*) AS total FROM site_visits WHERE day BETWEEN ? AND ?').bind(from,to).first();
 const timed=await db.prepare('SELECT COUNT(DISTINCT p.visit_id) AS visits,COALESCE(SUM(p.active_ms),0) AS activeMs FROM site_visit_pages p JOIN site_visits v ON p.visit_id=v.id WHERE v.day BETWEEN ? AND ?').bind(from,to).first();
 const pages=(await db.prepare("SELECT CASE WHEN e.page='/index.html' THEN '/' ELSE e.page END AS page,COUNT(*) AS views FROM site_visit_events e JOIN site_visits v ON e.visit_id=v.id WHERE v.day BETWEEN ? AND ? AND e.event='pageview' GROUP BY CASE WHEN e.page='/index.html' THEN '/' ELSE e.page END ORDER BY MIN(e.at),page").bind(from,to).all()).results;
 const group=async key=>(await db.prepare('SELECT '+key+' AS label,COUNT(*) AS total FROM site_visits WHERE day BETWEEN ? AND ? GROUP BY '+key+' ORDER BY total DESC,label').bind(from,to).all()).results;
 return {summaryVersion:1,pages,activeMs:Number(timed?.visits||0)?Number(timed.activeMs):null,timedVisits:Number(timed?.visits||0),recordedVisits:Number(recorded?.total||0),partial:Number(recorded?.total||0)<total||Number(timed?.visits||0)<Number(recorded?.total||0),sources:await group('referrer'),countries:await group('country'),cities:await group('city')};
}
async function visitReport(url,env){
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*864e5)return err('Изберете валиден период до 367 дни.');
 await ensureAnalyticsReady(env.DB);
 const count=await env.DB.prepare('SELECT COALESCE(SUM(total),0) AS total FROM site_visit_daily WHERE day BETWEEN ? AND ?').bind(from,to).first();
 const visits=(await env.DB.prepare('SELECT v.*, (SELECT COUNT(*) FROM site_visit_events e WHERE e.visit_id=v.id AND e.event=\'pageview\') AS pageviews FROM site_visits v WHERE day BETWEEN ? AND ? ORDER BY started_at DESC LIMIT 100').bind(from,to).all()).results;
 const summary=await visitPeriodSummary(env.DB,from,to,Number(count?.total||0));
 return json({summary,visitVersion:3,measurement:'tab-visits',visits:Number(count?.total||0),items:visits,shown:visits.length,retentionDays:30,inactivityMinutes:null,timeZone:'Europe/Sofia'});
}
async function visitDetails(url,env){
 const id=url.searchParams.get('id');if(!/^[-a-f0-9]{36}$/.test(id||''))return err('Невалидно посещение.');await ensureAnalyticsReady(env.DB);
 const events=(await env.DB.prepare('SELECT at,event,page FROM site_visit_events WHERE visit_id=? ORDER BY at,rowid LIMIT 500').bind(id).all()).results;const pages=(await env.DB.prepare('SELECT page,COUNT(*) AS views,SUM(active_ms) AS activeMs,MIN(opened_at) AS firstAt,MAX(last_seen) AS lastAt FROM site_visit_pages WHERE visit_id=? GROUP BY page ORDER BY firstAt').bind(id).all()).results;const pageHistory=(await env.DB.prepare('SELECT page,opened_at AS at,active_ms AS activeMs FROM site_visit_pages WHERE visit_id=? ORDER BY opened_at,rowid LIMIT 500').bind(id).all()).results;return json({detailVersion:4,events,pages,pageHistory,activeMs:pages.reduce((n,p)=>n+Number(p.activeMs),0)});
}

async function collectAnalytics(request,env){
 if(!ALLOWED_ORIGINS.has(request.headers.get('Origin')))return err('Origin required',403);
 if(Number(request.headers.get('content-length')||0)>2048)return err('Too large',413);
 if(!analyticsAllowed(request))return new Response(null,{status:204});
 const raw=await request.text();if(raw.length>2048)return err('Too large',413);
 let body;try{body=JSON.parse(raw)}catch{return err('Invalid event')}
 if(!['pageview','phone_click','booking_click','home_click','heartbeat'].includes(body.event)||!ANALYTICS_PAGES.has(body.page))return err('Invalid event');
 let ref='Директно / неизвестно';try{const u=new URL(String(body.referrer||''));if(['http:','https:'].includes(u.protocol)&&!['www.dany.style','dany.style'].includes(u.hostname))ref=u.hostname.toLowerCase().slice(0,120);else if(['www.dany.style','dany.style'].includes(u.hostname))ref='Вътрешна страница'}catch{}
 await ensureAnalyticsReady(env.DB);
 const cf=request.cf||{},country=/^[A-Z]{2}$/.test(cf.country||'')?cf.country:'Неизвестно',city=safe(cf.city||'Неизвестно',80);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(Date.now()));const part=t=>parts.find(x=>x.type===t).value,day=part('year')+'-'+part('month')+'-'+part('day'),hour=Number(part('hour'));
 if(body.mode==='visits-v3'){if(!await recordLinkedVisit(env,body,{country,city,referrer:ref},day))return err('Invalid visit');}else await recordEntry(env,body,{country,city,referrer:ref},day);
 if(body.event==='heartbeat')return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 await ensureAnalytics(env.DB);
 await env.DB.prepare('INSERT INTO site_analytics(day,hour,event,page,country,city,referrer,total) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(day,hour,event,page,country,city,referrer) DO UPDATE SET total=MIN(total+1,1000000)').bind(day,hour,body.event,body.page,country,city,ref).run();
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
async function analyticsReport(url,env){
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*864e5)return err('Изберете валиден период до 367 дни.');
 await ensureAnalyticsReady(env.DB);
 const rows=(await env.DB.prepare('SELECT day,hour,event,page,country,city,referrer,total FROM site_analytics WHERE day BETWEEN ? AND ?').bind(from,to).all()).results;
 const groups=(key,event='pageview')=>{const map=new Map();for(const row of rows)if(row.event===event){const label=String(row[key]);map.set(label,(map.get(label)||0)+Number(row.total))}return [...map].map(([label,total])=>({label,total})).sort((a,b)=>key==='day'?a.label.localeCompare(b.label):key==='hour'?Number(a.label)-Number(b.label):b.total-a.total).slice(0,key==='day'?367:30)};
 const events={};for(const row of rows)events[row.event]=(events[row.event]||0)+Number(row.total);
 return json({analyticsVersion:1,from,to,timeZone:'Europe/Sofia',pageviews:events.pageview||0,events,pages:groups('page'),countries:groups('country'),cities:groups('city'),sources:groups('referrer'),days:groups('day'),hours:groups('hour'),uniqueVisitors:null,demographicsAvailable:false});
}

async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method, ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!env.DB) return err("\u041B\u0438\u043F\u0441\u0432\u0430 D1 \u0431\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u0438", 503);
  if(method==="POST"&&path==="/api/analytics/event")return collectAnalytics(request,env);
  if (method === "GET" && path === "/api/schedule") {await ensureAnalyticsReady(env.DB);return json({...scheduleInfo,smsVersion:3,analyticsVisitVersion:6,analyticsDayTimeZone:"Europe/Sofia",analyticsReset:ANALYTICS_RESET,smsEnabled:smsConfigured(env),smsLimit:smsLimit(env)});}
  if (method === "GET" && path === "/api/calendar") {
    await ensureScheduleSchema(env.DB);
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 35 * 864e5) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0435\u0440\u0438\u043E\u0434");
    const rows = await env.DB.prepare("SELECT date,time,kind,duration_minutes FROM slots WHERE date BETWEEN ? AND ?").bind(from, to).all();
    return json({ ...scheduleInfo, occupied: expandSlots(rows.results), availability:publicAvailability(rows.results,from,to) });
  }
  if (method === "POST" && path === "/api/book") {
    const b = await request.json();
    const date = safe(b.date, 10), time = safe(b.time, 5), name = safe(b.name, 100), phone = safe(b.phone, 30), email = safe(b.email, 160), service = safe(b.service, 1e3);
    if (!future(date) || !validTime(time) || !name || !phone || !validEmail(email) || b.privacy !== true) return err("\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u0442\u0435 \u043F\u043E\u043F\u044A\u043B\u043D\u0435\u043D\u0438\u0442\u0435 \u0434\u0430\u043D\u043D\u0438 \u0438 \u0441\u044A\u0433\u043B\u0430\u0441\u0438\u0435\u0442\u043E.");
    const selected=selection(b);
    if(!selected)return err("Изберете валидна услуга и брой.");
    const id = crypto.randomUUID();
    try {
      await ensureScheduleSchema(env.DB);
      if (!await insertBooking(env,date,time,{id,name,phone,email,...selected})) return err("Този час вече е зает. Моля, изберете друг.",409);
    } catch {
      return err("\u0422\u043E\u0437\u0438 \u0447\u0430\u0441 \u0432\u0435\u0447\u0435 \u0435 \u0437\u0430\u0435\u0442. \u041C\u043E\u043B\u044F, \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0434\u0440\u0443\u0433.", 409);
    }
    const sent = await sendMail(env, "\u0420\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u044F Dany Style \u2014 " + date + " " + time, `\u041D\u043E\u043C\u0435\u0440: ${id}
\u0418\u043C\u0435: ${name}
\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phone}
\u0418\u043C\u0435\u0439\u043B: ${email}
\u0414\u0430\u0442\u0430: ${date}
\u0427\u0430\u0441: ${time}
\u0423\u0441\u043B\u0443\u0433\u0430: ${selected.service}
Продължителност: ${selected.duration} мин.`, email);
    const sms=await notifySms(env,"booked",{id,date,time,phone});
    return json({ id, emailSent: sent, sms }, 201);
  }
  if (method === "POST" && path === "/api/home-request") {
    const fd = await request.formData();
    const name = safe(fd.get("name"), 100), phone = safe(fd.get("phone"), 30), email = safe(fd.get("email"), 160), address = safe(fd.get("address"), 250), date = safe(fd.get("date"), 10), details = safe(fd.get("details"), 2e3);
    if (!name || !phone || !address || !future(date) || !validEmail(email) || fd.get("privacy") !== "yes") return err("\u041F\u043E\u043F\u044A\u043B\u043D\u0435\u0442\u0435 \u0437\u0430\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u0438\u0442\u0435 \u043F\u043E\u043B\u0435\u0442\u0430 \u0438 \u0441\u044A\u0433\u043B\u0430\u0441\u0438\u0435\u0442\u043E.");
    const photo = fd.get("photo"), attachments = [];
    if (photo && typeof photo === "object" && photo.size) {
      if (photo.size > 5 * 1024 * 1024) return err("\u0421\u043D\u0438\u043C\u043A\u0430\u0442\u0430 \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0435 \u0434\u043E 5 MB.");
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return err("\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0438 \u0444\u043E\u0440\u043C\u0430\u0442\u0438: JPG, PNG \u0438 WEBP.");
      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      attachments.push({ filename: photo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "photo.jpg", content: btoa(binary) });
    }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return err("\u0418\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435\u0442\u043E \u043D\u0430 \u0438\u043C\u0435\u0439\u043B\u0438 \u043E\u0449\u0435 \u043D\u0435 \u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043E. \u041E\u043F\u0438\u0442\u0430\u0439\u0442\u0435 \u043F\u043E-\u043A\u044A\u0441\u043D\u043E.", 503);
    const sent = await sendMail(env, "\u0417\u0430\u044F\u0432\u043A\u0430 \u0437\u0430 \u0434\u043E\u043C\u0430\u0448\u043D\u043E \u043F\u043E\u0441\u0435\u0449\u0435\u043D\u0438\u0435 Dany Style", `\u0418\u043C\u0435: ${name}
\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phone}
\u0418\u043C\u0435\u0439\u043B: ${email}
\u0410\u0434\u0440\u0435\u0441: ${address}
\u041F\u0440\u0435\u0434\u043F\u043E\u0447\u0438\u0442\u0430\u043D\u0430 \u0434\u0430\u0442\u0430: ${date}
\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435: ${details}
\u0421\u043D\u0438\u043C\u043A\u0438: ${attachments.length}`, email, attachments);
    if (!sent) return err("\u041D\u0435\u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0438\u0437\u043F\u0440\u0430\u0449\u0430\u043D\u0435. \u041E\u043F\u0438\u0442\u0430\u0439\u0442\u0435 \u043E\u0442\u043D\u043E\u0432\u043E.", 503);
    // Same request data within a day shares a key: retries cannot spend SMS twice.
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([name,smsPhone(phone)||phone,email,address,date,details,new Date().toISOString().slice(0,10)])));
    const id="request-"+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
    const sms=await notifySms(env,"request",{id,date,phone});
    return json({ ok: true, sms });
  }
  if (path === "/api/admin/login" && method === "POST") {
    const attempt = await env.DB.prepare("SELECT failures,last_failure FROM login_attempts WHERE ip=?").bind(ip).first();
    const now = Math.floor(Date.now() / 1e3);
    if (attempt && attempt.failures >= 5 && now - attempt.last_failure < 900) return err("\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u043D\u043E\u0433\u043E \u043E\u043F\u0438\u0442\u0438. \u041E\u043F\u0438\u0442\u0430\u0439\u0442\u0435 \u0441\u043B\u0435\u0434 15 \u043C\u0438\u043D\u0443\u0442\u0438.", 429);
    const body = await request.json();
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return err("\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0441\u043A\u0438\u044F\u0442 \u0434\u043E\u0441\u0442\u044A\u043F \u043D\u0435 \u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D", 503);
    if (body.password !== env.ADMIN_PASSWORD) {
      await env.DB.prepare("INSERT INTO login_attempts(ip,failures,last_failure) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET failures=CASE WHEN ?-last_failure>900 THEN 1 ELSE failures+1 END,last_failure=?").bind(ip, now, now, now).run();
      return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043F\u0430\u0440\u043E\u043B\u0430", 401);
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip=?").bind(ip).run();
    return json({ token: await sign({ exp: Date.now() + 8 * 36e5, nonce: crypto.randomUUID() }, env.SESSION_SECRET) });
  }
  if (path.startsWith("/api/admin/")) {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!env.SESSION_SECRET || !await verify(token, env.SESSION_SECRET)) return err("\u041C\u043E\u043B\u044F, \u0432\u043B\u0435\u0437\u0442\u0435 \u043E\u0442\u043D\u043E\u0432\u043E \u0432 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0441\u043A\u0438\u044F \u043F\u0430\u043D\u0435\u043B.", 401);
    if(method==="GET"&&path==="/api/admin/visits")return visitReport(url,env);
    if(method==="GET"&&path==="/api/admin/visit-details")return visitDetails(url,env);
    if(method==="GET"&&path==="/api/admin/analytics")return analyticsReport(url,env);
    await ensureScheduleSchema(env.DB);
    if(method==="GET"&&path==="/api/admin/sms-status")return json(await smsOverview(env));
    if (method === "GET" && path === "/api/admin/calendar") {
      const from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 35 * 864e5) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0435\u0440\u0438\u043E\u0434");
      const rows = await env.DB.prepare("SELECT date,time,kind,id,name,phone,email,service,duration_minutes,created_at,source FROM slots WHERE date BETWEEN ? AND ? ORDER BY date,time").bind(from, to).all();
      return json({ ...scheduleInfo, items: rows.results.map(row=>({...row,duration_minutes:durationOf(row)})), occupied:expandSlots(rows.results) });
    }
    if (method === "POST") {
      const b = await request.json(), date = safe(b.date, 10), time = safe(b.time, 5);
      if (path === "/api/admin/cancel") {
        if (!b.id) return err("\u041B\u0438\u043F\u0441\u0432\u0430 \u043D\u043E\u043C\u0435\u0440");
        if (b.reason !== undefined && (typeof b.reason !== "string" || b.reason.length > 2000)) return err("Причината трябва да е текст до 2000 знака.");
        const reason = safe(b.reason,2000);
        // Delete and return the original booking in one atomic statement. A repeated
        // or concurrent cancellation cannot delete a new booking or send twice.
        const booking = await env.DB.prepare("DELETE FROM slots WHERE id=? AND kind='booked' RETURNING id,date,time,name,phone,email,service,duration_minutes").bind(safe(b.id,100)).first();
        if (!booking) return err("Резервацията вече е отменена или не съществува.",404);
        let clientEmailStatus = "not_provided";
        if (booking.email) {
          const sent = await sendMail(env,"Отменена резервация Dany Style — "+booking.date+" "+booking.time,
            `Име: ${booking.name || ""}\nДата: ${booking.date}\nЧас: ${booking.time}\nПродължителност: ${durationOf(booking)} мин.\nУслуга: ${booking.service || ""}`,booking.email,[],{reason});
          clientEmailStatus = sent ? "sent" : "failed";
        }
        const sms=await notifySms(env,"cancelled",booking);
        return json({ ok: true, cancelled:true, clientEmailStatus, sms });
      }
      if (!validDate(date)) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0434\u0430\u0442\u0430");
      if (path === "/api/admin/slot") {
        if (!validTime(time) && !(b.action === "unblock" && /^1[0-8]:[03]0$/.test(time))) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0447\u0430\u0441");
        if (b.action === "block") {
          const duration=Number(b.duration_minutes ?? 90);
          if(![30,40,60,80,90,120,150,165,180].includes(duration))return err("Невалидна продължителност.");
          const result = await blockStatement(env.DB,date,time,duration).run();
          if (!result.meta.changes) return err("Периодът вече е зает. Обновете календара.",409);
          return json({ ok: true });
        }
        if (b.action === "unblock") {
          await env.DB.prepare("DELETE FROM slots WHERE date=? AND time=? AND kind='blocked'").bind(date, time).run();
          return json({ ok: true });
        }
      }
      if (path === "/api/admin/day") {
        if (b.action === "block") {
          await env.DB.batch(TIMES.map(t=>blockStatement(env.DB,date,t)));
          return json({ ok: true });
        }
        if (b.action === "unblock") {
          await env.DB.prepare("DELETE FROM slots WHERE date=? AND kind='blocked'").bind(date).run();
          return json({ ok: true });
        }
      }
      if (path === "/api/admin/book") {
        const name = safe(b.name, 100), phone = safe(b.phone, 30), service = safe(b.service, 1e3);
        const selected=selection(b);
        if(!selected)return err("Изберете валидна услуга и брой.");
        if (!validTime(time) || !name) return err("\u041B\u0438\u043F\u0441\u0432\u0430\u0442 \u0434\u0430\u043D\u043D\u0438");
        try {
          const id=crypto.randomUUID();
          if (!await insertBooking(env,date,time,{id,name,phone,...selected,source:"admin"})) return err("Този час вече е зает.",409);
          // Manual admin bookings do not send SMS or consume the SMS quota.
          const sms={enabled:false,reason:"manual_admin_booking"};
          return json({ ok: true, sms });
        } catch {
          return err("\u0427\u0430\u0441\u044A\u0442 \u0435 \u0437\u0430\u0435\u0442", 409);
        }
      }
    }
    return err("\u041D\u0435\u043F\u043E\u0437\u043D\u0430\u0442\u0430 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F", 404);
  }
  return err("\u041D\u0435\u043F\u043E\u0437\u043D\u0430\u0442\u0430 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F", 404);
}
__name(handle, "handle");
const ALLOWED_ORIGINS = new Set([
  "https://www.dany.style", "https://dany.style",
  "https://dany-style.danystyle.workers.dev"
]);
function corsResponse(response, origin) {
  const headers = new Headers(response.headers);
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(response.body, {status: response.status, headers});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (!url.pathname.startsWith("/api/")) {
      return Response.redirect("https://www.dany.style/", 302);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return err("Origin not allowed", 403);
    }
    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, {status: 204}), origin);
    }
    let response;
    try {
      if (url.pathname === "/api/admin/session" && request.method === "GET") {
        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const authenticated = !!env.SESSION_SECRET && await verify(token, env.SESSION_SECRET);
        response = authenticated ? json({ok: true}) : err("Моля, влезте в администраторския панел.", 401);
      } else {
        response = await handle(request, env);
      }
    } catch (e) {
      console.error("DanyStyle request failed", e?.name || "Error");
      response = err("Възникна технически проблем. Опитайте отново.", 500);
    }
    return corsResponse(response, origin);
  }
};

