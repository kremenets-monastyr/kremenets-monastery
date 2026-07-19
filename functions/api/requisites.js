/**
 * GET /api/requisites
 * Повертає текст ЗАКРІПЛЕНОГО повідомлення каналу монастиря (поточні реквізити).
 * Реквізити оновлюються редагуванням закріпленого повідомлення — код чіпати не треба.
 */
function json(o, s) {
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const token = env.TG_BOT_TOKEN;
  if (!token) return json({ ok: false });

  // Реквізити можуть бути закріплені у службовому каналі або в групі —
  // перевіряємо по черзі, доки не знайдемо закріплене повідомлення.
  const chats = [env.TG_REQUISITES_CHAT_ID, env.TG_CHANNEL_ID, env.TG_CHAT_ID].filter(Boolean);
  for (const chat of chats) {
    try {
      const r = await fetch(
        "https://api.telegram.org/bot" + token + "/getChat?chat_id=" + encodeURIComponent(chat)
      );
      const d = await r.json();
      const pin = d && d.ok && d.result && d.result.pinned_message;
      const text = pin && (pin.text || pin.caption);
      if (text) return json({ ok: true, text: text });
    } catch (e) { /* пробуємо наступний */ }
  }
  return json({ ok: false });
}
