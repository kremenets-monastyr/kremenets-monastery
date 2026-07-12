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

  const fd = new FormData();
  fd.append("chat_id", chat);
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  fd.append(field, file, file.name || (isImage ? "receipt.jpg" : "receipt.pdf"));

  try {
    const tg = await fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", body: fd });
    const d = await tg.json();
    if (!tg.ok || !d.ok) return json({ ok: false, error: "Не вдалося надіслати. Спробуйте ще раз." }, 502);

    // Позначимо в записі, що квитанцію отримано (best-effort)
    if (env.RECORDS) {
      try {
        const raw = await env.RECORDS.get("z:" + code);
        if (raw) {
          const r = JSON.parse(raw);
          r.receipt = true; r.receiptTs = Date.now();
          const left = Math.max(60, Math.floor((r.ts + 7 * 24 * 3600 * 1000 - Date.now()) / 1000));
          await env.RECORDS.put("z:" + code, JSON.stringify(r), { expirationTtl: left });
        }
      } catch (e) {}
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
