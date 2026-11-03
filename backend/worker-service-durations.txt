var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
// src/worker.js
var TIMES = Array.from({length:15},(_,i)=>{const m=600+i*30;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")});
const SCHEDULE_VERSION = "service-duration-v1";
const SERVICES = [{"id": "ingrown", "bg": "Впит нокът", "en": "Ingrown toenail", "durations": [30, 60]}, {"id": "onycholysis", "bg": "Онихолиза", "en": "Onycholysis", "durations": [30, 60]}, {"id": "thickened", "bg": "Удебелени и деформирани нокти", "en": "Thickened and deformed nails", "durations": [40, 80]}, {"id": "fungal", "bg": "Гъбични изменения по ноктите", "en": "Fungal nail changes", "durations": [40, 60]}, {"id": "hyperkeratosis", "bg": "Хиперкератоза", "en": "Hyperkeratosis", "durations": [30, 60]}, {"id": "niti", "bg": "Корекция с NiTi", "en": "NiTi nail correction", "durations": [30]}, {"id": "gel-polish", "bg": "Гел лак", "en": "Gel polish", "durations": [90]}, {"id": "natural-gel", "bg": "Гел върху естествен нокът", "en": "Gel on natural nails", "durations": [150]}, {"id": "extensions", "bg": "Изграждане с гел", "en": "Gel nail extensions", "durations": [165]}];
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
async function sendMail(env, subject, body, clientEmail, attachments = []) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  const recipients = [...new Set((env.NOTIFY_EMAILS || "").split(",").map(x => x.trim()).filter(Boolean))];
  if (!recipients.length) return false;
  const text = body.split("\n").filter(line => !/^Номер:/.test(line)).join("\n");
  const fields = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2];
  }
  const booking = subject.startsWith("Резервация");
  const date = fields[booking ? "Дата" : "Предпочитана дата"] || "";
  const prettyDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join(".") : date;
  const clientSubject = booking ? "Dany Style — потвърждение на Вашия час" : "Dany Style — получихме Вашата заявка";
  const greeting = fields["Име"] ? "Здравейте, " + fields["Име"] + "," : "Здравейте,";
  const intro = booking
    ? "Благодарим Ви за доверието. Вашият час в Dany Style е запазен."
    : "Благодарим Ви за заявката за домашно посещение. Ще се свържа с Вас, за да уточним подробностите и да потвърдим удобен час. Това писмо не е потвърждение на резервация.";
  const rows = booking
    ? [["Дата", prettyDate], ["Час", fields["Час"]], ["Продължителност", fields["Продължителност"]], ["Услуга / бележка", fields["Услуга"]]]
    : [["Предпочитана дата", prettyDate], ["Адрес", fields["Адрес"]]];
  const details = rows.filter(([, value]) => value);
  const closing = booking
    ? "Очаквам Ви! Ако се налага промяна или отмяна на часа, моля свържете се с мен на 0897 001 475."
    : "Ако имате допълнителни въпроси, можете да се свържете с мен на 0897 001 475.";
  const signature = "Поздрави,\nДаниела Ангелова\nПодолог | Dany Style";
  const clientText = ["Dany Style", "", greeting, "", intro, "", ...details.map(([label,value]) => label + ": " + value), ...(booking ? ["Адрес: гр. Пловдив, ж.к. Тракия, ул. Съединение 45"] : []), "", closing, "", signature, "https://www.dany.style/"].join("\n");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#fbf5f7;color:#493641;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf5f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #eedde4;border-radius:16px"><tr><td style="padding:28px 24px 20px;border-bottom:1px solid #eedde4"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="https://www.dany.style/assets/home-0.png" width="72" height="72" alt="Лого Dany Style" style="display:block;width:72px;height:72px;border:0"></td><td style="padding-left:16px"><strong style="font-family:Georgia,serif;font-size:27px;color:#8b526c">Dany Style</strong><br><span style="font-size:13px;color:#77616d">Подологична грижа · Даниела Ангелова</span></td></tr></table></td></tr><tr><td style="padding:26px 24px;font-size:16px;line-height:1.65"><p style="margin:0 0 18px">${escape(greeting)}</p><p style="margin:0 0 22px">${escape(intro)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf4f7;border-radius:10px">${details.map(([label,value]) => `<tr><td style="padding:10px 14px;vertical-align:top;font-size:14px;color:#765368;width:34%">${escape(label)}</td><td style="padding:10px 14px;font-size:15px;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join("")}</table>${booking ? '<p style="font-size:14px;color:#77616d;margin:18px 0">гр. Пловдив, ж.к. Тракия<br>ул. Съединение 45</p>' : ''}<p style="margin:22px 0">${escape(closing)}</p><p style="margin:0">Поздрави,<br><strong style="color:#8b526c">Даниела Ангелова</strong><br><span style="font-size:14px;color:#77616d">Подолог | Dany Style</span></p></td></tr><tr><td style="padding:18px 24px;border-top:1px solid #eedde4;font-size:13px;color:#77616d"><a href="tel:+359897001475" style="color:#8b526c">0897 001 475</a> &nbsp;·&nbsp; <a href="https://www.dany.style/" style="color:#8b526c">www.dany.style</a></td></tr></table></td></tr></table></body></html>`;
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
  const results = await Promise.all(recipients.map(to => send(to, subject, text, attachments)));
  const clientSent = clientEmail ? await send(clientEmail, clientSubject, clientText, [], html) : true;
  return results.every(Boolean) && clientSent;
}
__name(sendMail, "sendMail");

const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3));
const durationOf = row => Number(row.duration_minutes) > 0 ? Number(row.duration_minutes) : (row.kind === "booked" || LEGACY_TIMES.includes(row.time) ? 90 : 60);
const overlaps = (time,row,duration=APPOINTMENT_MINUTES) => minutes(time) < minutes(row.time)+durationOf(row) && minutes(row.time) < minutes(time)+duration;
const scheduleInfo = {scheduleVersion:SCHEDULE_VERSION,times:TIMES,appointmentMinutes:APPOINTMENT_MINUTES,stepMinutes:30,adminBlockMinutes:90,services:SERVICES};
const expandSlots = rows => rows.flatMap(row => TIMES.filter(time=>overlaps(time,row,30)).map(time=>({date:row.date,time})));
const schemaChecks = new WeakMap();
async function ensureScheduleSchema(db) {
  if (!schemaChecks.has(db)) schemaChecks.set(db,(async()=>{
    const columns = await db.prepare("PRAGMA table_info(slots)").all();
    if (!columns.results.some(c=>c.name === "duration_minutes")) {
      try { await db.prepare("ALTER TABLE slots ADD COLUMN duration_minutes INTEGER").run(); }
      catch (e) { // Another Worker isolate may have added the column concurrently.
        const current = await db.prepare("PRAGMA table_info(slots)").all();
        if (!current.results.some(c=>c.name === "duration_minutes")) throw e;
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
  const result=await env.DB.prepare(`INSERT INTO slots(date,time,kind,id,name,phone,email,service,duration_minutes) SELECT ?,?,'booked',?,?,?,?,?,? WHERE NOT EXISTS (${CONFLICT_SQL})`)
    .bind(date,time,booking.id,booking.name,booking.phone||"",booking.email||"",booking.service||"",booking.duration||90,date,minutes(time)+(booking.duration||90),minutes(time)).run();
  return result.meta.changes === 1;
}
function selection(b) {
  if (!b.serviceId) {
    if (b.quantity !== undefined || b.duration_minutes !== undefined) return null;
    return {service:safe(b.service,1000),duration:90};
  }
  const item=SERVICES.find(s=>s.id===b.serviceId), quantity=Number(b.quantity ?? 1);
  if (!item || !Number.isInteger(quantity) || quantity<1 || quantity>item.durations.length) return null;
  return {service:item.bg+(item.durations.length>1?` — ${quantity} бр.`:"")+(safe(b.notes,700)?" • "+safe(b.notes,700):""),duration:item.durations[quantity-1]};
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

async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method, ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!env.DB) return err("\u041B\u0438\u043F\u0441\u0432\u0430 D1 \u0431\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u0438", 503);
  if (method === "GET" && path === "/api/schedule") return json(scheduleInfo);
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
    return json({ id, emailSent: sent }, 201);
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
    return json({ ok: true });
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
    await ensureScheduleSchema(env.DB);
    if (method === "GET" && path === "/api/admin/calendar") {
      const from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 35 * 864e5) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0435\u0440\u0438\u043E\u0434");
      const rows = await env.DB.prepare("SELECT date,time,kind,id,name,phone,email,service,duration_minutes FROM slots WHERE date BETWEEN ? AND ? ORDER BY date,time").bind(from, to).all();
      return json({ ...scheduleInfo, items: rows.results.map(row=>({...row,duration_minutes:durationOf(row)})), occupied:expandSlots(rows.results) });
    }
    if (method === "POST") {
      const b = await request.json(), date = safe(b.date, 10), time = safe(b.time, 5);
      if (path === "/api/admin/cancel") {
        if (!b.id) return err("\u041B\u0438\u043F\u0441\u0432\u0430 \u043D\u043E\u043C\u0435\u0440");
        await env.DB.prepare("DELETE FROM slots WHERE id=? AND kind='booked'").bind(safe(b.id, 100)).run();
        return json({ ok: true });
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
          if (!await insertBooking(env,date,time,{id:crypto.randomUUID(),name,phone,...selected})) return err("Този час вече е зает.",409);
          return json({ ok: true });
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

