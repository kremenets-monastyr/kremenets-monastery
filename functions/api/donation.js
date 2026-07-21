/**
 * POST /api/donation — людина позначає, що додає до пожертви ще певну суму.
 * Гроші не проводяться тут: сума просто фіксується в записці, щоб сестри
 * знали, чому надійшло більше, ніж вартість треб.
 */
import { getRecord, saveRecord, placeCard, addLog, money } from "../_lib/card.js";

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let d;
  try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }

  const code = String(d.code || "").trim().toUpperCase();
  const amount = Math.round(Number(d.amount) || 0);

  if (!/^20\d{2}-[A-Z0-9]{5}$/.test(code)) return json({ ok: false, error: "Невірний номер записки" }, 400);
  if (!(amount > 0 && amount <= 100000)) return json({ ok: false, error: "Вкажіть суму від 1 до 100 000 грн" }, 400);

  const rec = await getRecord(env, code);
  if (!rec) return json({ ok: false, error: "Записку не знайдено" }, 404);

  // Проста межа: не частіше ніж раз на 20 секунд для однієї записки
  if (rec.extraTs && Date.now() - rec.extraTs < 20000) {
    return json({ ok: false, error: "Зачекайте кілька секунд" }, 429);
  }

  rec.extra = (Number(rec.extra) || 0) + amount;
  rec.extraTs = Date.now();
  addLog(rec, { kind: "note", text: "додаткова пожертва " + money(amount), who: "сайт" });

  await saveRecord(env, rec);
  await placeCard(env, rec);

  return json({ ok: true, extra: rec.extra });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
