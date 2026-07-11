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
  const token = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!token || !chat) return json({ ok: false });
  try {
    const r = await fetch(
      "https://api.telegram.org/bot" + token + "/getChat?chat_id=" + encodeURIComponent(chat)
    );
    const d = await r.json();
    const pin = d && d.ok && d.result && d.result.pinned_message;
    const text = pin && (pin.text || pin.caption);
    if (text) return json({ ok: true, text: text });
    return json({ ok: false });
  } catch (e) {
    return json({ ok: false });
  }
}
