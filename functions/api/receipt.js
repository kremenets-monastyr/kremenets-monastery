import { getRecord, saveRecord, placeCard, addLog } from "../_lib/card.js";
/**
 * POST /api/receipt  (multipart/form-data: code, file)
 * Приймає квитанцію (скрін/фото/PDF) і надсилає її у Telegram-канал монастиря,
 * підписавши номером запису, іменем і телефоном (беруться з KV, якщо є).
 */
const MAX = 10 * 1024 * 1024; // 10 МБ

function json(o, s) {
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!token || !chat) return json({ ok: false, error: "Сервіс не налаштовано." }, 500);

  let form;
  try { form = await request.formData(); }
  catch (e) { return json({ ok: false, error: "Некоректний запит." }, 400); }

  const code = String(form.get("code") || "").trim().slice(0, 32);
  const file = form.get("file");
  if (!code) return json({ ok: false, error: "Немає номера запису." }, 400);
  if (!file || typeof file === "string") return json({ ok: false, error: "Оберіть файл." }, 400);
  if (file.size > MAX) return json({ ok: false, error: "Файл завеликий (до 10 МБ)." }, 400);

  // Дані запису (для підпису) — best-effort
  let who = "";
  if (env.RECORDS) {
    try {
      const raw = await env.RECORDS.get("z:" + code);
      if (raw) {
        const r = JSON.parse(raw);
        who = (r.name ? " · " + esc(r.name) : "") + (r.phone ? " · " + esc(r.phone) : "");
      }
    } catch (e) {}
  }

  const caption = "🧾 <b>Квитанція про пожертву</b>\n№" + esc(code) + who;

  const type = String(file.type || "");
  const isImage = type.indexOf("image/") === 0;
  const method = isImage ? "sendPhoto" : "sendDocument";
  const field = isImage ? "photo" : "document";

  let rec = null;
  try { rec = await getRecord(env, code); } catch (e) { rec = null; }

  try {
    // 1) Спершу переносимо картку в «Перевірку оплати», щоб квитанція лягла в ту саму тему
    if (rec) {
      rec.receipt = true;
      rec.receiptTs = Date.now();
      if (rec.status !== "paid") {
        rec.status = "check";
        addLog(rec, { kind: "status", to: "check", text: "надійшла квитанція — потрібна перевірка", who: "сайт" });
      }
      await saveRecord(env, rec);
      await placeCard(env, rec);   // картка тепер у темі check із оновленим rec.threadId / rec.msgId
    }

    // 2) Квитанцію кладемо в ту саму тему, відповіддю на картку — щоб опинилась одразу під нею
    const fd = new FormData();
    fd.append("chat_id", chat);
    fd.append("caption", caption);
    fd.append("parse_mode", "HTML");
    if (rec && rec.threadId) fd.append("message_thread_id", String(rec.threadId));
    if (rec && rec.msgId) fd.append("reply_to_message_id", String(rec.msgId));
    fd.append(field, file, file.name || (isImage ? "receipt.jpg" : "receipt.pdf"));

    const tg = await fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", body: fd });
    const d = await tg.json();
    if (!tg.ok || !d.ok) return json({ ok: false, error: "Не вдалося надіслати. Спробуйте ще раз." }, 502);

    // 3) Запам'ятовуємо id квитанції в записі (стане в пригоді для майбутніх дій)
    if (rec && d.result && d.result.message_id) {
      rec.receiptMsgId = d.result.message_id;
      rec.receiptIsDoc = !isImage;
      // file_id найбільшого розміру фото (або документа) — щоб потім пересилати
      if (isImage && Array.isArray(d.result.photo) && d.result.photo.length) {
        rec.receiptFileId = d.result.photo[d.result.photo.length - 1].file_id;
      } else if (d.result.document) {
        rec.receiptFileId = d.result.document.file_id;
      }
      try { await saveRecord(env, rec); } catch (e) {}
    }

    // копія квитанції в канал-архів
    if (env.TG_CHANNEL_ID) {
      try {
        const fd2 = new FormData();
        fd2.append("chat_id", env.TG_CHANNEL_ID);
        fd2.append("caption", caption);
        fd2.append("parse_mode", "HTML");
        fd2.append("disable_notification", "true");
        fd2.append(field, file, file.name || (isImage ? "receipt.jpg" : "receipt.pdf"));
        await fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", body: fd2 });
      } catch (e) { /* не критично */ }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: "Помилка зʼєднання." }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
