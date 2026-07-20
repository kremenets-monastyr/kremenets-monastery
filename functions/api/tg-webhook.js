/**
 * POST /api/tg-webhook — приймає події від Telegram:
 *   • натискання кнопок статусу під карткою;
 *   • відповіді менеджерів на картку (стають коментарями в ній).
 *
 * Захист: Telegram надсилає секрет у заголовку X-Telegram-Bot-Api-Secret-Token.
 * Секрет зберігається в змінній TG_WEBHOOK_SECRET.
 */
import { STATUS, personName, getRecord, saveRecord, refreshCard, placeCard, createTopics, getTopics, addLog, copyNames, tg } from "../_lib/card.js";

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
    const parts = data.split(":"); // s:<code>:<status>  або  syn:<code>

    // Синодик окремим повідомленням — щоб на телефоні можна було скопіювати
    if (parts[0] === "syn" && parts[1]) {
      const rec = await getRecord(env, parts[1]);
      if (rec) {
        const txt = copyNames(rec);
        for (let i = 0; i < txt.length; i += 3500) {
          await tg(env, "sendMessage", {
            chat_id: rec.chatId || (cq.message && cq.message.chat && cq.message.chat.id),
            ...(rec.threadId ? { message_thread_id: rec.threadId } : {}),
            reply_to_message_id: rec.msgId,
            text: txt.slice(i, i + 3500),
            disable_notification: true,
          });
        }
      }
      await tg(env, "answerCallbackQuery", {
        callback_query_id: cq.id,
        text: "Надіслано окремим повідомленням — утримайте його й натисніть «Копіювати».",
        show_alert: true,
      });
      return ok();
    }

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

      const prev = rec.status;
      rec.status = next;

      if (next === "work") {
        if (!rec.assignee) { rec.assignee = who; rec.assignedTs = now; }
      } else if (next === "call") {
        rec.calledBy = who; rec.calledTs = now;
      } else if (next === "print") {
        rec.printedBy = who; rec.printedTs = now;
      } else if (next === "paid") {
        rec.paidBy = who; rec.paidTs = now;
        if (!rec.assignee) { rec.assignee = who; rec.assignedTs = now; }
      } else if (next === "new") {
        rec.assignee = null; rec.assignedTs = null;
        rec.paidBy = null; rec.paidTs = null;
      } else if (next === "arch") {
        rec.archBy = who; rec.archTs = now;
      }

      const TXT = {
        new: "повернуто в нові", work: "взято в роботу", call: "поставлено на дзвінок",
        print: "поставлено на друк", check: "передано на перевірку оплати",
        paid: "оплату підтверджено", arch: "відправлено в архів",
      };
      if (prev !== next) addLog(rec, { kind: "status", to: next, text: TXT[next] || next, who });

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
    addLog(rec, { kind: "note", text, who: personName(msg.from) });

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
