/**
 * POST /api/payment-hook — приймає повідомлення банку про надходження
 * і сам знаходить, до якої записки належить пожертва.
 *
 * Логіка пошуку:
 *   1) номер записки в коментарі до платежу — точний збіг;
 *   2) якщо номера немає — шукаємо неоплачені записки на ту саму суму
 *      за останні 7 днів і надсилаємо підказку сестрам із кнопками.
 *
 * Формат розрахований на monobank (corporate/personal API), але
 * розуміє й простий JSON: { amount, comment, ts }.
 */
import { getRecord, saveRecord, placeCard, tg, money, kyivTime } from "../_lib/card.js";

function ok(o) {
  return new Response(JSON.stringify(o || { ok: true }), {
    status: 200, headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Витягнути номер записки з коментаря: 2026-ABCDE (з дефісом або без) */
function codeFromComment(text) {
  const t = String(text || "").toUpperCase().replace(/\s+/g, "");
  let m = t.match(/(20\d{2})-?([A-Z0-9]{5})/);
  return m ? m[1] + "-" + m[2] : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Захист: секрет у заголовку або в адресі (?k=...)
  const secret = env.PAYMENT_HOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const got = request.headers.get("X-Payment-Secret") || url.searchParams.get("k");
    if (got !== secret) return new Response("forbidden", { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch (e) { return ok(); }

  // monobank: { type:"StatementItem", data:{ account, statementItem:{ amount, comment, time } } }
  const si = (body && body.data && body.data.statementItem) || body || {};
  const amountRaw = Number(si.amount);
  if (!isFinite(amountRaw) || amountRaw <= 0) return ok();          // видатки ігноруємо
  const amount = Math.abs(amountRaw) >= 1000 && si.currencyCode
    ? Math.round(Math.abs(amountRaw) / 100)                          // monobank — копійки
    : Math.round(Math.abs(amountRaw));
  const comment = si.comment || si.description || body.comment || "";
  const when = si.time ? si.time * 1000 : Date.now();

  // ---------- 1) Точний збіг за номером у коментарі ----------
  const code = codeFromComment(comment);
  if (code) {
    const rec = await getRecord(env, code);
    if (rec) {
      if (rec.status !== "paid") {
        rec.status = "paid";
        rec.paidTs = when;
        rec.paidAuto = true;
        rec.paidAmount = amount;
        await saveRecord(env, rec);
        await placeCard(env, rec);
        await tg(env, "sendMessage", {
          chat_id: rec.chatId || env.TG_CHAT_ID,
          reply_to_message_id: rec.msgId,
          text: "💰 <b>Надійшла пожертва " + money(amount) + "</b>\n" +
                "Записку №" + rec.code + " позначено як оплачену автоматично.",
          parse_mode: "HTML",
        });
      }
      return ok({ ok: true, matched: rec.code });
    }
  }

  // ---------- 2) Підказка: неоплачені записки на ту саму суму ----------
  const guesses = await findByAmount(env, amount);
  const head = "💰 <b>Надходження " + money(amount) + "</b> · " + kyivTime(when) +
               (comment ? "\nКоментар: " + String(comment).slice(0, 120) : "");

  if (guesses.length === 1) {
    const g = guesses[0];
    await tg(env, "sendMessage", {
      chat_id: g.chatId || env.TG_CHAT_ID,
      reply_to_message_id: g.msgId,
      text: head + "\n\nСхоже на записку <b>№" + g.code + "</b> (" + g.name + ").\nПідтвердити оплату?",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🟢 Так, оплачено", callback_data: "s:" + g.code + ":paid" }]] },
    });
  } else if (guesses.length > 1) {
    await tg(env, "sendMessage", {
      chat_id: env.TG_CHAT_ID,
      text: head + "\n\nПідходить кілька записок — оберіть потрібну:",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: guesses.slice(0, 6).map((g) => [
          { text: "№" + g.code + " · " + g.name, callback_data: "s:" + g.code + ":paid" },
        ]),
      },
    });
  } else {
    await tg(env, "sendMessage", {
      chat_id: env.TG_CHAT_ID,
      text: head + "\n\n⚠️ Не вдалося зіставити із записками. Перевірте вручну.",
      parse_mode: "HTML",
    });
  }
  return ok();
}

/** Неоплачені записки на вказану суму за останні 7 днів */
async function findByAmount(env, amount) {
  if (!env.RECORDS) return [];
  const out = [];
  try {
    const list = await env.RECORDS.list({ prefix: "z:", limit: 400 });
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    for (const k of list.keys) {
      const raw = await env.RECORDS.get(k.name);
      if (!raw) continue;
      let r; try { r = JSON.parse(raw); } catch (e) { continue; }
      if (!r || r.status === "paid" || !r.ts || r.ts < since) continue;
      if (Math.round(Number(r.total) || 0) === amount) out.push(r);
      if (out.length >= 10) break;
    }
  } catch (e) { /* повертаємо що встигли */ }
  return out;
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  // monobank перевіряє адресу методом GET перед підпискою
  return new Response("ok", { status: 200 });
}
