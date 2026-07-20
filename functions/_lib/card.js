/**
 * Спільний модуль: як виглядає картка записки в Telegram,
 * які в неї статуси й кнопки, і як її оновлювати.
 * Тека _lib не є маршрутом (Pages ігнорує імена з підкресленням).
 */

export const TTL_SECONDS = 90 * 24 * 3600; // 90 днів історії

export const STATUS = {
  new:   { label: "НОВА",             dot: "⚪", tag: "#нова" },
  work:  { label: "В РОБОТІ",         dot: "🟡", tag: "#в_роботі" },
  call:  { label: "НА ДЗВІНОК",       dot: "📞", tag: "#на_дзвінок" },
  print: { label: "НА ДРУК",          dot: "🖨", tag: "#на_друк" },
  check: { label: "ПЕРЕВІРКА ОПЛАТИ", dot: "🟠", tag: "#перевірка" },
  paid:  { label: "ОПЛАЧЕНО",         dot: "🟢", tag: "#оплачено" },
  arch:  { label: "АРХІВ",            dot: "📦", tag: "#архів" },
};

/** Слова-приписки, за якими впізнаємо воїна (поминання безкоштовне) */
export function isWarrior(name) {
  const s = String(name || "").toLowerCase().trim();
  if (!s) return false;
  if (/(^|[\s,;(])в\.(\s|$)/.test(s)) return true;
  return /(во[іїй]н|воин|войн|б[іо][йє]ц|військовослужб|воєннослужб|безв[іе]ст|полонен|полонян|зниклий|зсу|всу)/.test(s);
}

/** Теми (підгрупи) — воронка: нові → в роботі → оплачені → архів */
export const TOPICS = [
  { key: "all",   name: "📋 Усі",              color: 0x6FB9F0 },
  { key: "new",   name: "🆕 Нові",             color: 0x6FB9F0 },
  { key: "work",  name: "🟡 В роботі",         color: 0xFFD67E },
  { key: "call",  name: "📞 На дзвінок",       color: 0xFF93B2 },
  { key: "print", name: "🖨 На друк",          color: 0xCB86DB },
  { key: "check", name: "🟠 Перевірка оплати", color: 0xFB6F5F },
  { key: "paid",  name: "🟢 Оплачені",         color: 0x8EEE98 },
  { key: "arch",  name: "📦 Архів",            color: 0xCB86DB },
];

/** Скорочення задовгого тексту для показу в картці */
export function cut(s, n) {
  const t = String(s == null ? "" : s).trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

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
function buildCard(rec, nameCap, expandable) {
  const TYPE = {
    living: { t: "ЗА ЗДОРОВ'Я", e: "🔴" },
    dead:   { t: "ЗА УПОКІЙ",   e: "🔵" },
  };
  const st = STATUS[rec.status] || STATUS.new;
  const L = [];

  L.push(st.dot + " <b>" + st.label + "</b>  ·  №" + esc(rec.code));
  L.push("🕓 " + esc(kyivTime(rec.ts)));

  let total = 0, hasDon = false, freeTotal = 0;
  (rec.sheets || []).forEach((s) => {
    const ty = TYPE[s.type] || { t: "—", e: "•" };
    L.push("━━━━━━━━━━━━");
    L.push(ty.e + " <b>" + ty.t + "</b>");
    const g = (s.trebaGroup && s.trebaGroup !== s.trebaTitle) ? esc(cut(s.trebaGroup, 60)) + " · " : "";
    L.push("Треба: " + g + esc(cut(s.trebaTitle, 80)));
    if (s.when) L.push("🗓 Коли: " + esc(cut(s.when, 60)));
    const names = Array.isArray(s.names) ? s.names : [];
    L.push("Імена (" + names.length + "):");
    const shown = nameCap && names.length > nameCap ? names.slice(0, nameCap) : names;
    shown.forEach((n, i) => {
      const nm = cut(n, 70);
      if (isWarrior(n)) {
        freeTotal++;
        L.push("  " + (i + 1) + ". <u><b>" + esc(nm) + "</b></u> 🕯 <i>безкоштовно</i>");
      } else {
        L.push("  " + (i + 1) + ". " + esc(nm));
      }
    });
    if (nameCap && names.length > nameCap) {
      L.push("  … ще " + (names.length - nameCap) + " імен — див. сторінку записки");
      names.slice(nameCap).forEach((n) => { if (isWarrior(n)) freeTotal++; });
    }
    if (s.sum == null) { hasDon = true; L.push("Сума: на пожертву"); }
    else { total += Number(s.sum) || 0; L.push("Сума: " + money(s.sum)); }
  });

  L.push("━━━━━━━━━━━━");
  let tot = total > 0 ? money(total) : "";
  if (hasDon) tot = tot ? tot + " + пожертва" : "на пожертву";
  L.push("💳 <b>Разом:</b> " + (tot || "—"));
  if (freeTotal) L.push("🕯 <b>Воїнів (безкоштовно):</b> " + freeTotal);
  L.push("👤 <b>Ім’я:</b> " + esc(cut(rec.name, 60) || "—"));
  L.push("📞 <b>Телефон:</b> " + esc(cut(rec.phone, 30) || "—"));
  if (rec.comment) L.push("✉️ <b>Коментар:</b> " + esc(cut(rec.comment, 300)));
  if (rec.origin) L.push("🔗 Записки: " + rec.origin + "/z/" + rec.code);

  // Позначки й додаткові відомості
  const marks = [];
  if (rec.calledTs)  marks.push("📞 Подзвонила: <b>" + esc(rec.calledBy || "—") + "</b> · " + esc(kyivTime(rec.calledTs)));
  if (rec.printedTs) marks.push("🖨 Роздрукувала: <b>" + esc(rec.printedBy || "—") + "</b> · " + esc(kyivTime(rec.printedTs)));
  if (rec.receipt)   marks.push("🧾 Квитанцію надіслано" + (rec.receiptTs ? " · " + esc(kyivTime(rec.receiptTs)) : ""));
  if (rec.bankAmount) marks.push("🏦 Надходження за випискою: <b>" + money(rec.bankAmount) + "</b>" + (rec.bankTs ? " · " + esc(kyivTime(rec.bankTs)) : ""));
  if (rec.status === "check") marks.push("⏳ <b>Очікує перевірки сестрою</b>");
  if (rec.status === "paid") marks.push("💰 Оплату підтвердила: <b>" + esc(rec.paidBy || "—") + "</b> · " + esc(kyivTime(rec.paidTs)));
  if (marks.length) { L.push("━━━━━━━━━━━━"); marks.forEach((x) => L.push(x)); }

  // Історія: усі дії й коментарі в хронологічному порядку
  const log = Array.isArray(rec.log) ? rec.log : [];
  if (log.length) {
    L.push("━━━━━━━━━━━━");
    L.push("<b>Хід роботи:</b>");
    log.slice(-14).forEach((e) => {
      const icon = e.kind === "note" ? "💬" : (STATUS[e.to] ? STATUS[e.to].dot : "•");
      L.push(icon + " " + esc(e.text) + "  <i>— " + esc(e.who) + ", " + esc(kyivTime(e.ts)) + "</i>");
    });
  }

  // Синодик — блок коду: Telegram показує кнопку копіювання, довжина не обмежена
  const syn = copyNames(rec);
  if (syn) {
    const inner = '<pre><code class="language-Записка">' + esc(syn) + "</code></pre>";
    const block = expandable
      ? "━━━━━━━━━━━━\n<b>Для синодика</b> — розгорніть і натисніть, щоб скопіювати:\n<blockquote expandable>" + inner + "</blockquote>"
      : "━━━━━━━━━━━━\n<b>Для синодика</b> (натисніть, щоб скопіювати):\n" + inner;
    // Telegram обмежує повідомлення 4096 знаками — стежимо, щоб картка вмістилась
    if (L.join("\n").length + block.length < 3800) L.push(block);
  }

  L.push("");
  L.push(st.tag + " #" + String(rec.code || "").replace(/[^A-Za-z0-9]/g, "") + (freeTotal ? " #воїни" : ""));
  return L.join("\n");
}

/**
 * Картка з гарантією, що повідомлення вміститься в ліміт Telegram (4096 знаків).
 * Якщо імен дуже багато — показуємо перші, решту дивляться на сторінці записки.
 */
export function renderCard(rec, expandable) {
  const exp = expandable !== false;
  for (const cap of [0, 12, 6, 3]) {          // 0 = без обмеження
    const t = buildCard(rec, cap, exp);
    if (t.length <= 3900) return t;
  }
  // Крайній випадок: прибираємо рядки з кінця, щоб не розрізати розмітку
  const lines = buildCard(rec, 2, false).split("\n");
  const tail = lines[lines.length - 1];
  const out = [];
  let len = 0;
  for (const ln of lines) {
    if (len + ln.length + 120 > 3900) { out.push("… далі — на сторінці записки"); break; }
    out.push(ln); len += ln.length + 1;
  }
  out.push("", tail);
  return out.join("\n");
}

/** Дописати подію в історію записки */
export function addLog(rec, entry) {
  rec.log = Array.isArray(rec.log) ? rec.log : [];
  rec.log.push({ ts: Date.now(), ...entry });
  if (rec.log.length > 60) rec.log = rec.log.slice(-60);
}

/** Кнопки під карткою — показуємо тільки доречні для поточного статусу */
export function keyboard(rec) {
  const c = rec.code, cur = rec.status || "new";
  const B = (key, text) => ({ text, callback_data: "s:" + c + ":" + key });
  const row1 = [], row2 = [];

  if (cur !== "work")  row1.push(B("work",  "🟡 В роботі"));
  if (cur !== "call")  row1.push(B("call",  "📞 Дзвінок"));
  if (cur !== "print") row1.push(B("print", "🖨 Друк"));

  if (cur !== "check") row2.push(B("check", "🟠 Перевірка"));
  if (cur !== "paid")  row2.push(B("paid",  "🟢 Оплачено"));
  if (cur !== "arch")  row2.push(B("arch",  "📦 Архів"));

  const rows = [];
  if (row1.length) rows.push(row1);
  if (row2.length) rows.push(row2);
  if (cur !== "new") rows.push([B("new", "↩︎ Повернути в нові")]);

  rows.push([
    { text: "📞 Копіювати телефон", copy_text: { text: String(rec.phone || "").slice(0, 256) } },
  ]);
  return { inline_keyboard: rows };
}

/** Готовий текст записки для синодика: тип, треба, імена — кожне з нового рядка */
export function copyNames(rec) {
  const TY = { living: "За здоровʼя", dead: "За упокій" };
  const lines = [];
  (rec.sheets || []).forEach((s, idx) => {
    if (idx) lines.push("");
    if (TY[s.type]) lines.push(TY[s.type]);
    // Повна назва треби: група + термін («Неусипна псалтир · 1 місяць»)
    const g = s.trebaGroup && s.trebaGroup !== s.trebaTitle ? s.trebaGroup + " · " : "";
    if (s.trebaTitle || g) lines.push((g + (s.trebaTitle || "")).trim());
    if (s.when) lines.push("на " + s.when);
    (s.names || []).forEach((n) => lines.push(cut(n, 70)));
  });
  const t = lines.join("\n") || String(rec.code || "");
  return t.length > 2500 ? t.slice(0, 2497) + "…" : t;
}

/**
 * Надіслати/оновити картку. Якщо Telegram не прийме згортану цитату
 * (старіша версія API), автоматично повторюємо без неї.
 */
export async function tgCard(env, method, base, rec) {
  let r = await tg(env, method, { ...base, text: renderCard(rec, true), parse_mode: "HTML" });
  const bad = r && !r.ok && /parse entities|can't parse|unsupported/i.test(String(r.description || ""));
  if (bad) r = await tg(env, method, { ...base, text: renderCard(rec, false), parse_mode: "HTML" });
  return r;
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
  await tgCard(env, "editMessageText", {
    chat_id: rec.chatId,
    message_id: rec.msgId,
    disable_web_page_preview: true,
    reply_markup: keyboard(rec),
  }, rec);
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
  const res = await tgCard(env, "sendMessage", {
    chat_id: rec.chatId,
    message_thread_id: thread,
    disable_web_page_preview: true,
    reply_markup: keyboard(rec),
  }, rec);

  if (res && res.ok && res.result) {
    rec.msgId = res.result.message_id;
    rec.threadId = thread;
    await saveRecord(env, rec);
    if (oldMsg) await tg(env, "deleteMessage", { chat_id: rec.chatId, message_id: oldMsg });
  } else {
    await refreshCard(env, rec);
  }
}
