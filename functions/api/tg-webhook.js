/**
 * POST /api/tg-webhook — приймає події від Telegram:
 *   • натискання кнопок статусу під карткою;
 *   • відповіді менеджерів на картку (стають коментарями в ній).
 *
 * Захист: Telegram надсилає секрет у заголовку X-Telegram-Bot-Api-Secret-Token.
 * Секрет зберігається в змінній TG_WEBHOOK_SECRET.
 */
import { STATUS, personName, getRecord, saveRecord, refreshCard, placeCard, createTopics, getTopics, tg } from "../_lib/card.js";

function ok() {
  return new Response("ok", { status: 200 });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Перевірка секрету — щоб ніхто сторонній не смикав цей адрес
  const secret = env.TG_WEBHOOK_SECRET;
  if (secret) {
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== secret) return new Response("forbidden", { status: 403 });
  }

  let upd;
  try { upd = await request.json(); } catch (e) { return ok(); }

  // ---------- 1) Натискання кнопки статусу ----------
  if (upd.callback_query) {
    const cq = upd.callback_query;
    const data = String(cq.data || "");
    const parts = data.split(":"); // s:<code>:<status>

    if (parts[0] === "s" && parts[1] && STATUS[parts[2]]) {
      const code = parts[1], next = parts[2];
      const rec = await getRecord(env, code);

      if (!rec) {
        await tg(env, "answerCallbackQuery", {
          callback_query_id: cq.id,
          text: "Запис не знайдено (можливо, термін зберігання минув).",
          show_alert: true,
        });
        return ok();
      }

      const who = personName(cq.from);
      const now = Date.now();

      if (next === "work") {
        rec.status = "work";
        rec.assignee = who;
        rec.assignedTs = now;
      } else if (next === "paid") {
        rec.status = "paid";
        rec.paidTs = now;
        rec.paidBy = who;
        rec.paidAuto = false;
        rec.paidConfirmedBy = who;
        if (!rec.assignee) { rec.assignee = who; rec.assignedTs = now; }
      } else if (next === "check") {
        rec.status = "check";
        if (!rec.assignee) { rec.assignee = who; rec.assignedTs = now; }
      } else if (next === "arch") {
        rec.status = "arch";
        rec.archTs = now;
        rec.archBy = who;
      } else if (next === "new") {
        rec.status = "new";
        rec.assignee = null;
        rec.assignedTs = null;
        rec.paidTs = null;
        rec.paidBy = null;
      }

      await saveRecord(env, rec);
      await placeCard(env, rec);   // переносимо картку у відповідну тему
      await tg(env, "answerCallbackQuery", {
        callback_query_id: cq.id,
        text: STATUS[rec.status].dot + " " + STATUS[rec.status].label,
      });
      return ok();
    }

    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
    return ok();
  }

  const msg = upd.message;

  // ---------- 2) Команда /setup — одноразове створення тем-воронки ----------
  if (msg && typeof msg.text === "string" && msg.text.trim().split("@")[0] === "/setup") {
    const { map, added } = await createTopics(env, msg.chat.id);
    const all = Object.keys(map).length;
    await tg(env, "sendMessage", {
      chat_id: msg.chat.id,
      text: all
        ? (added.length
            ? "✅ Додано теми: " + added.join(" · ") + "\nВоронка: 🆕 Нові → 🟡 В роботі → 🟠 Перевірка оплати → 🟢 Оплачені → 📦 Архів"
            : "Усі теми вже створено. Воронка готова.")
        : "⚠️ Не вдалося створити теми. Перевірте, чи ввімкнено «Теми» в налаштуваннях групи і чи має бот право керувати темами.",
    });
    return ok();
  }

  if (msg && typeof msg.text === "string" && msg.text.trim().split("@")[0] === "/setup_reset") {
    if (env.RECORDS) { try { await env.RECORDS.delete("cfg:topics"); } catch (e) {} }
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: "Налаштування тем скинуто. Напишіть /setup." });
    return ok();
  }

  // ---------- 3) Коментар: відповідь менеджера на картку ----------
  if (msg && msg.reply_to_message && typeof msg.text === "string" && msg.text.trim()) {
    const parentId = msg.reply_to_message.message_id;
    const code = findCode(msg.reply_to_message.text || msg.reply_to_message.caption || "");
    if (!code) return ok();

    const rec = await getRecord(env, code);
    if (!rec || rec.msgId !== parentId) return ok();

    const text = msg.text.trim().slice(0, 300);
    rec.notes = Array.isArray(rec.notes) ? rec.notes : [];
    rec.notes.push({ text, who: personName(msg.from), ts: Date.now() });

    await saveRecord(env, rec);
    await refreshCard(env, rec);

    // прибираємо повідомлення-відповідь, щоб чат не засмічувався
    await tg(env, "deleteMessage", { chat_id: msg.chat.id, message_id: msg.message_id });
    return ok();
  }

  return ok();
}

/** Дістати номер записки з тексту картки */
function findCode(text) {
  const m = String(text).match(/№\s*([0-9]{4}-[A-Z0-9]{5})/);
  return m ? m[1] : null;
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
