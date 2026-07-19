/**
 * Спільний модуль: як виглядає картка записки в Telegram,
 * які в неї статуси й кнопки, і як її оновлювати.
 * Тека _lib не є маршрутом (Pages ігнорує імена з підкресленням).
 */

export const TTL_SECONDS = 90 * 24 * 3600; // 90 днів історії

export const STATUS = {
  new:  { label: "НОВА",      dot: "⚪", tag: "#нова" },
  work:  { label: "В РОБОТІ",   dot: "🟡", tag: "#в_роботі" },
  check: { label: "ПЕРЕВІРКА",  dot: "🟠", tag: "#перевірка" },
  paid: { label: "ОПЛАЧЕНО",  dot: "🟢", tag: "#оплачено" },
  arch: { label: "АРХІВ",     dot: "📦", tag: "#архів" },
};

/** Теми (підгрупи) — воронка: нові → в роботі → оплачені → архів */
export const TOPICS = [
  { key: "new",  name: "🆕 Нові",      color: 0x6FB9F0 },
  { key: "work",  name: "🟡 В роботі",       color: 0xFFD67E },
  { key: "check", name: "🟠 Перевірка оплати", color: 0xFB6F5F },
  { key: "paid", name: "🟢 Оплачені",  color: 0x8EEE98 },
  { key: "arch", name: "📦 Архів",     color: 0xCB86DB },
];

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("uk-UA").replace(/\u00A0/g, " ") + " грн";
}

export function kyivTime(ts) {
  return new Date(ts || Date.now()).toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Ім'я менеджера з даних Telegram */
export function personName(from) {
  if (!from) return "—";
  const n = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return n || (from.username ? "@" + from.username : "id" + from.id);
}

/** Повний текст картки за збереженим записом */
export function renderCard(rec) {
  const TYPE = {
    living: { t: "ЗА ЗДОРОВ'Я", e: "🔴" },
    dead:   { t: "ЗА УПОКІЙ",   e: "🔵" },
  };
  const st = STATUS[rec.status] || STATUS.new;
  const L = [];

  L.push(st.dot + " <b>" + st.label + "</b>  ·  №" + esc(rec.code));
  L.push("🕓 " + esc(kyivTime(rec.ts)));

  let total = 0, hasDon = false;
  (rec.sheets || []).forEach((s) => {
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
  L.push("👤 <b>Ім’я:</b> " + esc(rec.name || "—"));
  L.push("📞 <b>Телефон:</b> " + esc(rec.phone || "—"));
  if (rec.origin) L.push("🔗 Записки: " + rec.origin + "/z/" + rec.code);

  // Хто що зробив
  const log = [];
  if (rec.assignee) log.push("👤 Взяв(ла): <b>" + esc(rec.assignee) + "</b> · " + esc(kyivTime(rec.assignedTs)));
  if (rec.status === "paid") {
    log.push("💰 Оплату підтвердила: <b>" + esc(rec.paidBy || "—") + "</b> · " + esc(kyivTime(rec.paidTs)));
  }
  if (rec.receipt) log.push("🧾 Квитанцію надіслано" + (rec.receiptTs ? " · " + esc(kyivTime(rec.receiptTs)) : ""));
  if (rec.bankAmount) log.push("🏦 Надходження за випискою: <b>" + money(rec.bankAmount) + "</b>" + (rec.bankTs ? " · " + esc(kyivTime(rec.bankTs)) : ""));
  if (rec.status === "check") log.push("⏳ <b>Очікує перевірки сестрою</b>");
  if (log.length) { L.push("━━━━━━━━━━━━"); log.forEach((x) => L.push(x)); }

  // Коментарі менеджерів
  const notes = Array.isArray(rec.notes) ? rec.notes : [];
  if (notes.length) {
    L.push("━━━━━━━━━━━━");
    notes.slice(-10).forEach((n) => {
      L.push("💬 " + esc(n.text) + "  <i>— " + esc(n.who) + ", " + esc(kyivTime(n.ts)) + "</i>");
    });
  }

  L.push("");
  L.push(st.tag + " #" + String(rec.code || "").replace(/[^A-Za-z0-9]/g, ""));
  return L.join("\n");
}

/** Кнопки під карткою — показуємо тільки доречні для поточного статусу */
export function keyboard(rec) {
  const c = rec.code;
  const rows = [];
  if (rec.status === "new") {
    rows.push([
      { text: "🟡 Взяти в роботу", callback_data: "s:" + c + ":work" },
      { text: "🟢 Оплачено", callback_data: "s:" + c + ":paid" },
    ]);
  } else if (rec.status === "work") {
    rows.push([{ text: "🟢 Оплачено", callback_data: "s:" + c + ":paid" }]);
    rows.push([{ text: "↩︎ Повернути в нові", callback_data: "s:" + c + ":new" }]);
  } else if (rec.status === "check") {
    rows.push([{ text: "✅ Підтвердити оплату", callback_data: "s:" + c + ":paid" }]);
    rows.push([{ text: "↩︎ Повернути в роботу", callback_data: "s:" + c + ":work" }]);
  } else if (rec.status === "paid") {
    rows.push([{ text: "📦 В архів", callback_data: "s:" + c + ":arch" }]);
    rows.push([{ text: "↩︎ Повернути в роботу", callback_data: "s:" + c + ":work" }]);
  } else {
    rows.push([{ text: "↩︎ Повернути в оплачені", callback_data: "s:" + c + ":paid" }]);
  }
  // Кнопки копіювання (Telegram копіює текст у буфер обміну)
  rows.push([
    { text: "📋 Імена", copy_text: { text: copyNames(rec) } },
    { text: "📞 Телефон", copy_text: { text: String(rec.phone || "").slice(0, 256) } },
  ]);
  return { inline_keyboard: rows };
}

/** Готовий текст записки для вставки в синодик (Telegram обмежує 256 знаками) */
export function copyNames(rec) {
  const TY = { living: "За здоровʼя", dead: "За упокій" };
  const parts = [];
  (rec.sheets || []).forEach((s) => {
    const head = (TY[s.type] || "") + (s.trebaTitle ? " · " + s.trebaTitle : "");
    parts.push(head + ": " + (s.names || []).join(", "));
  });
  const t = parts.join("\n") || String(rec.code || "");
  return t.length > 256 ? t.slice(0, 253) + "…" : t;
}

export async function tg(env, method, payload) {
  const r = await fetch("https://api.telegram.org/bot" + env.TG_BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  try { return await r.json(); } catch (e) { return { ok: false }; }
}

export async function getRecord(env, code) {
  if (!env.RECORDS || !code) return null;
  try {
    const raw = await env.RECORDS.get("z:" + code);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveRecord(env, rec) {
  if (!env.RECORDS) return;
  try {
    await env.RECORDS.put("z:" + rec.code, JSON.stringify(rec), { expirationTtl: TTL_SECONDS });
  } catch (e) { /* не критично */ }
}

/** Перемалювати картку в Telegram за збереженим записом */
export async function refreshCard(env, rec) {
  if (!rec || !rec.msgId || !rec.chatId) return;
  await tg(env, "editMessageText", {
    chat_id: rec.chatId,
    message_id: rec.msgId,
    text: renderCard(rec),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(rec),
  });
}


/** Збережені ідентифікатори тем */
export async function getTopics(env) {
  if (!env.RECORDS) return null;
  try {
    const raw = await env.RECORDS.get("cfg:topics");
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveTopics(env, map) {
  if (!env.RECORDS) return;
  try { await env.RECORDS.put("cfg:topics", JSON.stringify(map)); } catch (e) {}
}

/** Створити теми-воронку в групі (одноразово, командою /setup) */
export async function createTopics(env, chatId) {
  const map = (await getTopics(env)) || {};
  const added = [];
  for (const t of TOPICS) {
    if (map[t.key]) continue;                     // така тема вже є — не дублюємо
    const r = await tg(env, "createForumTopic", {
      chat_id: chatId, name: t.name, icon_color: t.color,
    });
    if (r && r.ok && r.result) { map[t.key] = r.result.message_thread_id; added.push(t.name); }
  }
  if (Object.keys(map).length) await saveTopics(env, map);
  return { map, added };
}

/**
 * Помістити картку в тему, що відповідає статусу.
 * Telegram не вміє переносити повідомлення, тож картка publikується наново,
 * а стара видаляється. Уся історія (виконавець, коментарі) — усередині картки.
 */
export async function placeCard(env, rec) {
  const topics = await getTopics(env);
  const thread = topics && topics[rec.status];

  // Теми не налаштовані — просто оновлюємо картку на місці
  if (!thread) { await refreshCard(env, rec); return; }

  // Уже в потрібній темі — достатньо оновити
  if (rec.threadId && rec.threadId === thread) { await refreshCard(env, rec); return; }

  const oldMsg = rec.msgId;
  const res = await tg(env, "sendMessage", {
    chat_id: rec.chatId,
    message_thread_id: thread,
    text: renderCard(rec),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(rec),
  });

  if (res && res.ok && res.result) {
    rec.msgId = res.result.message_id;
    rec.threadId = thread;
    await saveRecord(env, rec);
    if (oldMsg) await tg(env, "deleteMessage", { chat_id: rec.chatId, message_id: oldMsg });
  } else {
    await refreshCard(env, rec);
  }
}
