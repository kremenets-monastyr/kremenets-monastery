import { renderCard, keyboard, getTopics, addLog, tgCard, isWarrior as isWarriorSrv, TTL_SECONDS as CARD_TTL } from "../_lib/card.js";
/**
 * Cloudflare Pages Function — приймає записку з сайту, надсилає її у Telegram
 * і (за наявності KV) зберігає запис на 7 днів під унікальним номером.
 * Маршрут: POST /api/send-treba
 *
 * ЗМІННІ СЕРЕДОВИЩА (Cloudflare → Settings → Environment variables):
 *   TG_BOT_TOKEN  — токен бота від @BotFather        (СЕКРЕТ)
 *   TG_CHAT_ID    — ID каналу/групи монастиря         (напр. -100…)
 * KV-БІНДІНГ (Settings → Functions → KV namespace bindings), необовʼязково, але треба для памʼятки:
 *   RECORDS       — namespace для збереження записок на 7 днів
 *
 * Токен НІКОЛИ не потрапляє у фронтенд.
 */

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 днів

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function money(v) {
  try { return Number(v).toLocaleString("uk-UA") + " грн"; } catch (e) { return v + " грн"; }
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
// Унікальний, стійкий до колізій номер (без лічильника → без гонок у KV)
function genCode() {
  const year = new Date().getFullYear();
  const rnd = (Date.now().toString(36) + Math.random().toString(36).slice(2))
    .replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase();
  return year + "-" + rnd;
}

function buildMessage(d, code) {
  const TYPE = { living: { t: "ЗА ЗДОРОВ'Я", e: "🔴" }, dead: { t: "ЗА УПОКІЙ", e: "🔵" } };
  const now = new Date().toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const L = [];
  L.push("🕯 <b>Нова записка</b>  №" + esc(code));
  L.push("🕓 " + esc(now));
  let total = 0, hasDon = false;
  const sheets = Array.isArray(d.sheets) ? d.sheets : [];
  sheets.forEach((s) => {
    const ty = TYPE[s.type] || { t: "—", e: "•" };
    L.push("━━━━━━━━━━━━");
    L.push(ty.e + " <b>" + ty.t + "</b>");
    const g = (s.trebaGroup && s.trebaGroup !== s.trebaTitle) ? esc(s.trebaGroup) + " · " : "";
    L.push("Треба: " + g + esc(s.trebaTitle || ""));
    if (s.when) L.push("🗓 Коли: " + esc(String(s.when).slice(0, 120)));
    const names = Array.isArray(s.names) ? s.names : [];
    L.push("Імена (" + names.length + "):");
    names.forEach((n, i) => L.push("  " + (i + 1) + ". " + esc(n)));
    if (s.sum == null) { hasDon = true; L.push("Сума: на пожертву"); }
    else { total += Number(s.sum) || 0; L.push("Сума: " + money(s.sum)); }
  });
  L.push("━━━━━━━━━━━━");
  let tot = total > 0 ? money(total) : "";
  if (hasDon) tot = tot ? tot + " + пожертва" : "на пожертву";
  L.push("💳 <b>Разом:</b> " + (tot || "—"));
  L.push("👤 <b>Ім’я:</b> " + esc(d.name || "—"));
  L.push("📞 <b>Телефон:</b> " + esc(d.phone || "—"));
  return L.join("\n");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let d;
  try { d = await request.json(); }
  catch (e) { return json({ ok: false, error: "Некоректний запит." }, 400); }

  if (d.hp) return json({ ok: true }); // антиспам-пастка: тихо ігноруємо ботів

  // Обмеження частоти: не більше 5 записок за 10 хв з однієї IP-адреси.
  // Захищає канал обителі від заливання фейковими записками.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.RECORDS && ip !== "unknown") {
    try {
      const rlKey = "rl:" + ip;
      const prev = parseInt((await env.RECORDS.get(rlKey)) || "0", 10);
      if (prev >= 5) {
        return json({ ok: false, error: "Забагато записок поспіль. Спробуйте за 10 хвилин або зателефонуйте до обителі." }, 429);
      }
      await env.RECORDS.put(rlKey, String(prev + 1), { expirationTtl: 600 });
    } catch (e) { /* якщо KV недоступний — не блокуємо подання */ }
  }

  const name = (d.name || "").toString().trim();
  const phone = (d.phone || "").toString().trim();
  const sheets = Array.isArray(d.sheets) ? d.sheets : [];

  // Валідація
  if (!sheets.length) return json({ ok: false, error: "Заповніть хоча б одну записку." }, 400);
  if (sheets.length > 30) return json({ ok: false, error: "Забагато записок в одній заявці." }, 400);
  if (!name) return json({ ok: false, error: "Вкажіть ваше ім’я." }, 400);
  if (name.length > 100) return json({ ok: false, error: "Ім’я задовге." }, 400);
  if (!phone) return json({ ok: false, error: "Вкажіть контактний номер телефону." }, 400);
  // За здоровʼя воїнів — не довше 1 місяця (40 днів)
  const LONG = ["3 місяці", "6 місяців", "1 рік", "5 років"];
  const warriorLong = sheets.some((s) =>
    s.type === "living" &&
    LONG.some((x) => String(s.trebaTitle || "").indexOf(x) === 0 || String(s.trebaTitle || "").indexOf("· 1 рік") > 0) &&
    (s.names || []).some((n) => isWarriorSrv(n)));
  if (warriorLong) {
    return json({ ok: false, error: "За здоровʼя воїнів приймаємо на термін до 1 місяця (40 днів)." }, 400);
  }

  // Захист від надмірно довгих значень (форму можна обійти)
  const NAME_MAX_SRV = 70, WHEN_MAX_SRV = 60, NAMES_PER_SHEET = 50;
  sheets.forEach((sh) => {
    sh.names = (Array.isArray(sh.names) ? sh.names : [])
      .map((n) => String(n == null ? "" : n).trim().slice(0, NAME_MAX_SRV))
      .filter(Boolean)
      .slice(0, NAMES_PER_SHEET);
    if (sh.when) sh.when = String(sh.when).trim().slice(0, WHEN_MAX_SRV);
    sh.trebaTitle = String(sh.trebaTitle || "").slice(0, 80);
    sh.trebaGroup = String(sh.trebaGroup || "").slice(0, 80);
  });

  const donationTooMany = sheets.some((s) =>
    String(s.trebaTitle || "").indexOf("За 1 записку") === 0 && ((s.names || []).length) > 20);
  if (donationTooMany) return json({ ok: false, error: "У требі «За 1 записку» — не більше 20 імен." }, 400);
  const totalNames = sheets.reduce((a, s) => a + ((s.names || []).length), 0);
  if (totalNames === 0) return json({ ok: false, error: "Додайте хоча б одне ім’я." }, 400);
  if (totalNames > 300) return json({ ok: false, error: "Забагато імен в одній заявці." }, 400);

  const token = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!token || !chat) {
    return json({ ok: false, error: "Сервіс поки не налаштовано. Зателефонуйте до обителі." }, 500);
  }

  const code = genCode();
  const origin = new URL(request.url).origin;

  const record = {
    code, ts: Date.now(), name, phone,
    total: Number(d.total) || 0, hasDonation: !!d.hasDonation,
    comment: String(d.comment || "").trim().slice(0, 300),
    sheets, origin, status: "new", log: [],
  };

  // 1) Доставка в Telegram — джерело правди. Без неї не підтверджуємо.
  const topics = await getTopics(env);
  const thread = topics && topics.new;

  let tgData = null;
  try {
    tgData = await tgCard(env, "sendMessage", {
      chat_id: chat,
      ...(thread ? { message_thread_id: thread } : {}),
      disable_web_page_preview: true,
      reply_markup: keyboard(record),
    }, record);
  } catch (e) { tgData = null; }

  if (!tgData || !tgData.ok) {
    return json({ ok: false, error: "Не вдалося доставити записку. Спробуйте ще раз або зателефонуйте до обителі." }, 502);
  }
  record.msgId = tgData.result && tgData.result.message_id;
  record.chatId = tgData.result && tgData.result.chat && tgData.result.chat.id;
  if (thread) record.threadId = thread;

  // 1а) Копія в тему «Усі» — повна історія в одному місці, без кнопок
  if (topics && topics.all) {
    try {
      await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chat, message_thread_id: topics.all,
          text: renderCard(record), parse_mode: "HTML",
          disable_web_page_preview: true, disable_notification: true,
        }),
      });
    } catch (e) { /* не критично */ }
  }

  // 1б) Копія у старий канал-архів (якщо налаштовано TG_CHANNEL_ID).
  // Це просто дублікат «як було»: без кнопок і статусів, лише для історії.
  if (env.TG_CHANNEL_ID) {
    try {
      await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TG_CHANNEL_ID,
          text: renderCard(record),
          parse_mode: "HTML",
          disable_web_page_preview: true,
          disable_notification: true,
        }),
      });
    } catch (e) { /* архівна копія не критична */ }
  }

  // 2) Збереження запису (best-effort: не валимо запит, якщо KV недоступний)
  if (env.RECORDS) {
    try {
      await env.RECORDS.put("z:" + code, JSON.stringify(record), { expirationTtl: CARD_TTL });
    } catch (e) { /* запис у Telegram уже є */ }
  }

  return json({ ok: true, code });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
