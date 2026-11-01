var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
// src/worker.js
var TIMES = Array.from({ length: 8 }, (_, i) => String(i + 10).padStart(2, "0") + ":00");
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
  const recipients = (env.NOTIFY_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!recipients.length) return false;
  const send =  __name(async (to, sub, txt, files = []) => {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: sub, text: txt, attachments: files }) });
    if (!r.ok) {
      console.error("Email provider error", r.status, (await r.text()).slice(0, 250));
      return false;
    }
    return true;
  }, "send");
  const results = await Promise.all(recipients.map((to) => send(to, subject, body, attachments)));
  if (clientEmail) await send(clientEmail, "Dany Style \u2014 \u043F\u043E\u0442\u0432\u044A\u0440\u0436\u0434\u0435\u043D\u0438\u0435", subject.startsWith("\u0420\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u044F") ? "\u041F\u043E\u043B\u0443\u0447\u0438\u0445\u043C\u0435 \u0432\u0430\u0448\u0430\u0442\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u044F. " + body.split("\n").filter((x) => /Дата:|Час:|Номер:/.test(x)).join("\n") : "\u041F\u043E\u043B\u0443\u0447\u0438\u0445\u043C\u0435 \u0432\u0430\u0448\u0430\u0442\u0430 \u0437\u0430\u044F\u0432\u043A\u0430. \u0414\u0430\u043D\u0438\u0435\u043B\u0430 \u0449\u0435 \u0441\u0435 \u0441\u0432\u044A\u0440\u0436\u0435 \u0441 \u0432\u0430\u0441 \u043B\u0438\u0447\u043D\u043E. \u0422\u043E\u0432\u0430 \u043D\u0435 \u0435 \u043F\u043E\u0442\u0432\u044A\u0440\u0434\u0435\u043D \u0447\u0430\u0441.");
  return results.every(Boolean);
}
__name(sendMail, "sendMail");
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method, ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!env.DB) return err("\u041B\u0438\u043F\u0441\u0432\u0430 D1 \u0431\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u0438", 503);
  if (method === "GET" && path === "/api/calendar") {
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 35 * 864e5) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0435\u0440\u0438\u043E\u0434");
    const rows = await env.DB.prepare("SELECT date,time FROM slots WHERE date BETWEEN ? AND ?").bind(from, to).all();
    return json({ occupied: rows.results });
  }
  if (method === "POST" && path === "/api/book") {
    const b = await request.json();
    const date = safe(b.date, 10), time = safe(b.time, 5), name = safe(b.name, 100), phone = safe(b.phone, 30), email = safe(b.email, 160), service = safe(b.service, 1e3);
    if (!future(date) || !validTime(time) || !name || !phone || !validEmail(email) || b.privacy !== true) return err("\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u0442\u0435 \u043F\u043E\u043F\u044A\u043B\u043D\u0435\u043D\u0438\u0442\u0435 \u0434\u0430\u043D\u043D\u0438 \u0438 \u0441\u044A\u0433\u043B\u0430\u0441\u0438\u0435\u0442\u043E.");
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare("INSERT INTO slots(date,time,kind,id,name,phone,email,service) VALUES(?,?,'booked',?,?,?,?,?)").bind(date, time, id, name, phone, email, service).run();
    } catch {
      return err("\u0422\u043E\u0437\u0438 \u0447\u0430\u0441 \u0432\u0435\u0447\u0435 \u0435 \u0437\u0430\u0435\u0442. \u041C\u043E\u043B\u044F, \u0438\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0434\u0440\u0443\u0433.", 409);
    }
    const sent = await sendMail(env, "\u0420\u0435\u0437\u0435\u0440\u0432\u0430\u0446\u0438\u044F Dany Style \u2014 " + date + " " + time, `\u041D\u043E\u043C\u0435\u0440: ${id}
\u0418\u043C\u0435: ${name}
\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ${phone}
\u0418\u043C\u0435\u0439\u043B: ${email}
\u0414\u0430\u0442\u0430: ${date}
\u0427\u0430\u0441: ${time}
\u0423\u0441\u043B\u0443\u0433\u0430: ${service}`, email);
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
    if (method === "GET" && path === "/api/admin/calendar") {
      const from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 35 * 864e5) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043F\u0435\u0440\u0438\u043E\u0434");
      const rows = await env.DB.prepare("SELECT date,time,kind,id,name,phone,email,service FROM slots WHERE date BETWEEN ? AND ? ORDER BY date,time").bind(from, to).all();
      return json({ items: rows.results });
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
        if (!validTime(time)) return err("\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0447\u0430\u0441");
        if (b.action === "block") {
          await env.DB.prepare("INSERT OR IGNORE INTO slots(date,time,kind) VALUES(?,?,'blocked')").bind(date, time).run();
          return json({ ok: true });
        }
        if (b.action === "unblock") {
          await env.DB.prepare("DELETE FROM slots WHERE date=? AND time=? AND kind='blocked'").bind(date, time).run();
          return json({ ok: true });
        }
      }
      if (path === "/api/admin/day") {
        if (b.action === "block") {
          await env.DB.batch(TIMES.map((t) => env.DB.prepare("INSERT OR IGNORE INTO slots(date,time,kind) VALUES(?,?,'blocked')").bind(date, t)));
          return json({ ok: true });
        }
        if (b.action === "unblock") {
          await env.DB.prepare("DELETE FROM slots WHERE date=? AND kind='blocked'").bind(date).run();
          return json({ ok: true });
        }
      }
      if (path === "/api/admin/book") {
        const name = safe(b.name, 100), phone = safe(b.phone, 30), service = safe(b.service, 1e3);
        if (!validTime(time) || !name) return err("\u041B\u0438\u043F\u0441\u0432\u0430\u0442 \u0434\u0430\u043D\u043D\u0438");
        try {
          await env.DB.prepare("INSERT INTO slots(date,time,kind,id,name,phone,service) VALUES(?,?,'booked',?,?,?,?)").bind(date, time, crypto.randomUUID(), name, phone, service).run();
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
