/**
 * GET /z/<номер>  — сторінка «Ваші записки» (перегляд і пожертва).
 * Читає запис із KV (RECORDS) за номером і показує його разом із поточними реквізитами
 * (із закріпленого повідомлення каналу). Дійсна 7 днів (TTL запису в KV).
 */
function isWarriorZ(name) {
  const s = String(name || "").toLowerCase().trim();
  if (!s) return false;
  if (/(^|[\s,;(])в\.(\s|$)/.test(s)) return true;
  return /(во[іїй]н|воин|войн|б[іо][йє]ц|військовослужб|воєннослужб|безв[іе]ст|полонен|полонян|зниклий|зсу|всу)/.test(s);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function money(v) {
  try { return Number(v).toLocaleString("uk-UA") + " грн"; } catch (e) { return v + " грн"; }
}

const CSS = `
:root{--blue:#22356F;--blue-deep:#16234C;--gold:#2E5AAC;--ink:#26303F;--muted:#5E6B82;--line:#DCE4F1;--bg:#F4F7FC;--red:#B23A3A}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;padding:24px 14px}
.wrap{max-width:560px;margin:0 auto}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px 24px;box-shadow:0 14px 36px rgba(34,53,111,.08)}
.brand{font-family:'Monomakh',serif;color:var(--blue);font-size:18px;text-align:center;line-height:1.25;margin-bottom:8px}
h1{font-family:'Monomakh',serif;font-weight:400;color:var(--blue);font-size:26px;text-align:center;margin-bottom:16px}
.code{text-align:center;color:var(--muted);font-size:14px;margin-bottom:4px}
.code b{font-family:'Monomakh',serif;font-size:26px;color:var(--blue);display:inline-block;margin-top:2px;letter-spacing:.02em}
.meta{text-align:center;color:var(--muted);font-size:13px;margin-bottom:20px}
.sheet{border:1px solid var(--line);border-left:3px solid var(--blue);border-radius:10px;padding:12px 14px;margin-bottom:12px}
.sheet.liv{border-left-color:var(--red)}
.sh-h{font-family:'Monomakh',serif;color:var(--blue);font-size:19px}
.sheet.liv .sh-h{color:var(--red)}
.sh-tr{color:var(--muted);font-size:13px;margin:2px 0 6px}
.sh-n{list-style:none;font-size:15px;margin-bottom:6px}
.sh-n li{padding:1px 0}
.sh-s{font-size:14px}
.warr{background:#FFF7E6;border-radius:6px;padding:2px 6px}
.freetag{font-size:11px;color:#8A6D1F;white-space:nowrap}
.sh-w{font-size:13px;color:var(--blue);background:var(--bg);border-radius:8px;padding:5px 8px;margin-bottom:6px;display:inline-block}
.total{text-align:right;font-size:16px;margin:6px 2px 20px}
.total b{font-family:'Monomakh',serif;font-size:22px;color:var(--blue)}
.req{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:16px}
.req-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:700;text-align:center;margin-bottom:10px}
.req pre{font-family:'IBM Plex Sans',sans-serif;white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.55;margin-bottom:12px}
.note{font-size:13px;color:var(--muted);margin-bottom:20px;text-align:center;line-height:1.55}
.muted{color:var(--muted);font-size:14px;text-align:center}
.btn{display:block;text-align:center;background:var(--blue-deep);color:#fff;text-decoration:none;padding:14px;border-radius:999px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;font-size:13px;transition:.18s;box-shadow:0 10px 24px rgba(22,35,76,.22)}
.btn:hover{background:var(--blue);transform:translateY(-2px)}
.btn2{width:100%;background:transparent;border:1.5px solid var(--blue);color:var(--blue);padding:11px;border-radius:999px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;font-size:12px;cursor:pointer;transition:.18s}
.btn2:hover{background:var(--blue);color:#fff;transform:translateY(-1px)}
.btn2:active{transform:none}
.donate{background:#EEF3FB;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:14px;color:var(--ink);text-align:center;margin-bottom:16px}
.donate b{color:var(--blue)}
.share{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.share-t{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.share-row{display:flex;gap:8px}
.shi{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1.5px solid var(--line);background:#fff;color:var(--blue);cursor:pointer;transition:.15s;padding:0}
.shi svg{width:20px;height:20px;display:block}
.shi:hover{transform:translateY(-2px);border-color:var(--blue);background:#E4EBF7}
.shi.tg:hover{color:#2AABEE;border-color:#2AABEE}
.shi.vb:hover{color:#7360F2;border-color:#7360F2}
.shi.wa:hover{color:#25D366;border-color:#25D366}
.shi.copied{color:#fff;background:var(--blue);border-color:var(--blue)}
.rc{background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:16px 18px;text-align:center;margin-bottom:18px}
.rc-t{font-size:14px;font-weight:700;color:var(--blue);margin-bottom:4px}
.rc-p{font-size:13px;color:var(--muted);margin-bottom:12px}
.rc input[type=file]{font-size:13px;max-width:100%;margin-bottom:10px}
.rc-msg{font-size:13px;min-height:16px;margin-top:8px}
.rc-msg.ok{color:var(--blue)}.rc-msg.err{color:var(--red)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;align-items:stretch}
.two>*{min-width:0;margin-bottom:0}
.two .rc{margin-bottom:0;display:flex;flex-direction:column;justify-content:center}
.two .req{margin-bottom:0}
@media(max-width:600px){.two{grid-template-columns:1fr}}
.rc.done{border-style:solid;border-color:var(--blue);background:#E4EBF7}
@media(max-width:600px){
  body{padding:14px 10px}
  .card{padding:18px 16px;border-radius:14px}
  .brand{font-size:15px;margin-bottom:4px}
  h1{font-size:22px;margin-bottom:10px}
  .code{font-size:13px}.code b{font-size:22px}
  .meta{font-size:12px;margin-bottom:12px}
  .total{font-size:15px;margin:0 2px 12px}.total b{font-size:20px}
  .donate{padding:9px 12px;font-size:13px;margin-bottom:12px}
  .two{gap:10px;margin-bottom:12px}
  .req{padding:12px 14px;margin-bottom:0}
  .req-t{margin-bottom:6px}
  .req pre{font-size:14px;margin-bottom:10px}
  .share{padding:12px 14px}
  .share-t{margin-bottom:8px}
  .note{font-size:12px;margin-bottom:12px}
  .rc{padding:12px 14px;margin-bottom:12px}
  .rc-p{margin-bottom:8px}
}
.acc{border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:18px;overflow:hidden}
.acc-h{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 16px;font-weight:600;color:var(--blue);font-size:15px;transition:.15s}
.acc-h::-webkit-details-marker{display:none}
.acc-h:hover{background:var(--bg)}
.acc-m{margin-left:auto;font-weight:400;font-size:13px;color:var(--muted)}
.acc-x{width:10px;height:10px;border-right:2px solid var(--blue);border-bottom:2px solid var(--blue);transform:rotate(45deg);transition:transform .2s;flex:none;margin-top:-4px}
.acc[open] .acc-x{transform:rotate(-135deg);margin-top:2px}
.acc-b{padding:4px 14px 14px;border-top:1px solid var(--line)}
.acc-b .sheet:last-child{margin-bottom:0}
.total{margin:2px 2px 16px}
`;

const SCRIPT = `
var CODE = __CODE__, LINK = location.origin + '/z/' + CODE;
var cp = document.getElementById('cpLink');
if (cp) cp.addEventListener('click', function(){ navigator.clipboard.writeText(LINK); cp.classList.add('copied'); setTimeout(function(){cp.classList.remove('copied');},1400); });
var rq = document.querySelector('.req .btn2');
if (rq) rq.addEventListener('click', function(){ var o=rq.textContent; rq.textContent='Скопійовано \u2713'; setTimeout(function(){rq.textContent=o;},1500); });
var f=document.getElementById('rcFile'), b=document.getElementById('rcSend'), m=document.getElementById('rcMsg');
if (b) b.addEventListener('click', async function(){
  if(!f.files||!f.files[0]){ m.textContent='Оберіть файл'; m.className='rc-msg err'; return; }
  if(f.files[0].size>10*1024*1024){ m.textContent='Файл завеликий (до 10 МБ)'; m.className='rc-msg err'; return; }
  b.disabled=true; m.textContent='Надсилаємо…'; m.className='rc-msg';
  var fd=new FormData(); fd.append('code',CODE); fd.append('file',f.files[0]);
  try{ var r=await fetch('/api/receipt',{method:'POST',body:fd}); var d={}; try{d=await r.json();}catch(e){}
    if(r.ok&&d.ok){ var box=document.querySelector('.rc'); if(box){ box.classList.add('done'); box.innerHTML='<div class="rc-t">Квитанцію отримано \u2713</div><p class="rc-p">Дякуємо! Обитель звірить пожертву за номером '+CODE+'.</p>'; } try{ localStorage.removeItem('kr_last'); }catch(e){} }
    else { m.textContent=(d&&d.error)?d.error:'Не вдалося надіслати.'; m.className='rc-msg err'; }
  } catch(e){ m.textContent='Помилка зʼєднання.'; m.className='rc-msg err'; }
  finally { b.disabled=false; }
});
`;

function pageHtml(inner, title) {
  return '<!doctype html><html lang="uk"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<style>' +
    "@font-face{font-family:'Monomakh';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/monomakh-cyrillic-400-normal.woff2') format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}" +
    "@font-face{font-family:'Monomakh';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/monomakh-cyrillic-ext-400-normal.woff2') format('woff2');unicode-range:U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F}" +
    "@font-face{font-family:'Monomakh';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/monomakh-latin-400-normal.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2122,U+2191,U+2193,U+2212}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/ibm-plex-sans-cyrillic-400-normal.woff2') format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/ibm-plex-sans-latin-400-normal.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/ibm-plex-sans-cyrillic-600-normal.woff2') format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/ibm-plex-sans-latin-600-normal.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/ibm-plex-sans-cyrillic-700-normal.woff2') format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}" +
    "@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/ibm-plex-sans-latin-700-normal.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122}" +
    '</style>' +
    '<style>' + CSS + '</style></head><body>' + inner + '</body></html>';
}
function html(body, status) {
  return new Response(body, { status: status || 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function getRequisites(env) {
  // Закріплене повідомлення з реквізитами може бути в каналі або в групі —
  // перевіряємо по черзі, доки не знайдемо.
  const chats = [env.TG_REQUISITES_CHAT_ID, env.TG_CHANNEL_ID, env.TG_CHAT_ID].filter(Boolean);
  for (const chat of chats) {
    try {
      const r = await fetch("https://api.telegram.org/bot" + env.TG_BOT_TOKEN + "/getChat?chat_id=" + encodeURIComponent(chat));
      const d = await r.json();
      const pin = d && d.ok && d.result && d.result.pinned_message;
      const text = pin && (pin.text || pin.caption);
      if (text) return text;
    } catch (e) { /* пробуємо наступний */ }
  }
  return null;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const code = String(params.code || "").trim();
  const origin = new URL(request.url).origin;

  let rec = null;
  if (env.RECORDS) {
    try { const raw = await env.RECORDS.get("z:" + code); if (raw) rec = JSON.parse(raw); } catch (e) {}
  }
  const req = await getRequisites(env);
  const reqBlock = req
    ? '<div class="req"><div class="req-t">Реквізити для пожертви</div><pre id="req">' + esc(req) + '</pre>' +
      '<button class="btn2" onclick="navigator.clipboard.writeText(document.getElementById(\'req\').textContent)">Скопіювати реквізити</button></div>'
    : '<div class="req"><div class="req-t">Реквізити для пожертви</div><p class="muted">Реквізити надасть обитель — зверніться до контактів і назвіть номер запису.</p></div>';

  if (!rec) {
    const inner =
      '<div class="wrap"><div class="card">' +
      '<div class="brand">Свято-Богоявленський Кременецький<br>жіночий монастир</div>' +
      '<h1>Записки не знайдено</h1>' +
      '<p class="muted">Запис за номером <b>' + esc(code) + '</b> не знайдено. Можливо, минуло понад 7 днів або номер введено з помилкою.</p>' +
      '<div style="height:16px"></div>' + reqBlock +
      '<a class="btn" href="' + origin + '/">На головну</a></div></div>';
    return html(pageHtml(inner, "Записки не знайдено"), 404);
  }

  const TYPE = { living: { t: "За здоровʼя", c: "liv" }, dead: { t: "За упокій", c: "" } };
  const dt = new Date(rec.ts || Date.now()).toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  let total = 0, hasDon = false;
  const sheets = (rec.sheets || []).map(function (s) {
    const ty = TYPE[s.type] || { t: "—", c: "" };
    let sumTxt;
    if (s.sum == null) { hasDon = true; sumTxt = "на пожертву"; }
    else { total += Number(s.sum) || 0; sumTxt = money(s.sum); }
    const names = (s.names || []).map(function (n, i) { return "<li>" + (i + 1) + ". " + esc(n) + "</li>"; }).join("");
    const treba = (s.trebaGroup && s.trebaGroup !== s.trebaTitle ? esc(s.trebaGroup) + " · " : "") + esc(s.trebaTitle || "");
    const when = s.when ? '<div class="sh-w">🗓 ' + esc(s.when) + '</div>' : '';
    return '<div class="sheet ' + ty.c + '"><div class="sh-h">' + ty.t + '</div><div class="sh-tr">' + treba +
      '</div>' + when + '<ul class="sh-n">' + names + '</ul><div class="sh-s">Сума: <b>' + sumTxt + '</b></div></div>';
  }).join("");
  let tot = total > 0 ? money(total) : "";
  if (hasDon) tot = tot ? tot + " + пожертва" : "на пожертву";
  const nSheets = (rec.sheets || []).length;
  const nNames = (rec.sheets || []).reduce(function (a, s) { return a + ((s.names || []).length); }, 0);
  const plural = function (n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  const wordSheets = plural(nSheets, "записка", "записки", "записок");
  const wordNames = plural(nNames, "імʼя", "імені", "імен");

  const link = origin + "/z/" + (rec.code || code);
  const shareTxt = "Ваші записки до монастиря (Свято-Богоявленський Кременецький жіночий монастир). Номер: " + (rec.code || code) + ".";
  const I = {
    tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.9 19c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.9 12.9 2.3 11.5c-1-.3-1-1 .2-1.5l18.1-7c.8-.3 1.5.2 1.3 1.3z"/></svg>',
    vb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.6 2 4 5.2 4 9.2c0 2.2 1.1 4.2 2.9 5.5v3.8c0 .5.6.8 1 .5l2.6-2c.5.1 1 .1 1.5.1 4.4 0 8-3.2 8-7.2S16.4 2 12 2zm4.6 9.6c-.2.5-.9.9-1.4 1-.4.1-.9.1-1.4-.1-.3-.1-.8-.3-1.4-.5-2.4-1-4-3.4-4.1-3.6-.1-.2-1-1.3-1-2.4s.6-1.7.8-1.9c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.6c.1.1.1.3 0 .4l-.2.3-.3.3c-.1.1-.2.2-.1.4.1.2.5.9 1.1 1.4.8.7 1.4.9 1.6 1 .2.1.3.1.4-.1l.6-.7c.1-.2.3-.2.5-.1l1.5.7c.2.1.4.2.4.3.1.2.1.6 0 .9z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.5-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.1-.4-.2z"/></svg>',
    em: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 6.5L21 6"/></svg>',
    cp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
  };
  const shareBlock =
    '<div class="share"><div class="share-t">Надіслати собі</div><div class="share-row">' +
    '<a class="shi tg" title="Telegram" aria-label="Telegram" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(shareTxt) + '">' + I.tg + '</a>' +
    '<a class="shi vb" title="Viber" aria-label="Viber" href="viber://forward?text=' + encodeURIComponent(shareTxt + " " + link) + '">' + I.vb + '</a>' +
    '<a class="shi wa" title="WhatsApp" aria-label="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(shareTxt + " " + link) + '">' + I.wa + '</a>' +
    '<a class="shi em" title="Пошта" aria-label="Пошта" href="mailto:?subject=' + encodeURIComponent("Ваші записки — " + (rec.code || code)) + '&body=' + encodeURIComponent(shareTxt + "\n" + link) + '">' + I.em + '</a>' +
    '<button class="shi cp" id="cpLink" title="Копіювати посилання" aria-label="Копіювати посилання">' + I.cp + '</button>' +
    '</div></div>';
  const receiptBlock =
    '<div class="rc"><div class="rc-t">Надіслати квитанцію про оплату</div>' +
    '<p class="rc-p">Прикріпіть скрін або фото квитанції (за бажанням).</p>' +
    '<input type="file" id="rcFile" accept="image/*,application/pdf">' +
    '<button class="btn2" id="rcSend">Надіслати квитанцію</button>' +
    '<div class="rc-msg" id="rcMsg"></div></div>';

  const inner =
    '<div class="wrap"><div class="card">' +
    '<div class="brand">Свято-Богоявленський Кременецький<br>жіночий монастир</div>' +
    '<h1>Ваші записки</h1>' +
    '<div class="code">Номер запису<br><b>' + esc(rec.code || code) + '</b></div>' +
    '<div class="meta">' + esc(dt) + (rec.name ? ' · ' + esc(rec.name) : '') + (rec.phone ? ' · ' + esc(rec.phone) : '') + '</div>' +
    '<div class="total">До сплати: <b>' + (tot || "—") + '</b></div>' +
    '<div class="donate"><b>Оплата треб — це добровільна пожертва на монастир.</b></div>' +
    '<div class="two">' + reqBlock + receiptBlock + '</div>' +
    shareBlock +
    '<p class="note">У призначенні платежу (коментарі) напишіть: <b>пожертва ' + esc(rec.code || code) + '</b>.<br>' +
    'Якщо коментар додати не вдається — назвіть номер або ваше імʼя й телефон обителі.<br>Сторінка доступна 7 днів від подання записки.</p>' +
    '<details class="acc"><summary class="acc-h"><span>Переглянути записки</span>' +
      '<span class="acc-m">' + nSheets + ' ' + wordSheets + ' · ' + nNames + ' ' + wordNames + '</span>' +
      '<span class="acc-x" aria-hidden="true"></span></summary>' +
      '<div class="acc-b">' + sheets + '</div></details>' +
    '<a class="btn" href="' + origin + '/">Подати ще одну записку</a></div></div>' +
    '<script>' + SCRIPT.replace('__CODE__', JSON.stringify(rec.code || code)) + '<\/script>';
  return html(pageHtml(inner, "Ваші записки " + (rec.code || code)));
}
