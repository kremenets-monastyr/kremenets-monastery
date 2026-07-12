/**
 * GET /z/<номер>  — сторінка-памʼятка для оплати.
 * Читає запис із KV (RECORDS) за номером і показує його разом із поточними реквізитами
 * (із закріпленого повідомлення каналу). Дійсна 7 днів (TTL запису в KV).
 */
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
.share{margin-bottom:18px}
.share-t{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:center;margin-bottom:10px}
.share-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.sh{font-size:12px;font-weight:600;padding:9px 15px;border-radius:999px;border:1.5px solid var(--line);color:var(--blue);background:#fff;text-decoration:none;cursor:pointer;transition:.15s}
.sh:hover{border-color:var(--blue);background:#E4EBF7;transform:translateY(-1px)}
.rc{background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:16px 18px;text-align:center;margin-bottom:18px}
.rc-t{font-size:14px;font-weight:700;color:var(--blue);margin-bottom:4px}
.rc-p{font-size:13px;color:var(--muted);margin-bottom:12px}
.rc input[type=file]{font-size:13px;max-width:100%;margin-bottom:10px}
.rc-msg{font-size:13px;min-height:16px;margin-top:8px}
.rc-msg.ok{color:var(--blue)}.rc-msg.err{color:var(--red)}
`;

const SCRIPT = `
var CODE = __CODE__, LINK = location.origin + '/z/' + CODE;
var cp = document.getElementById('cpLink');
if (cp) cp.addEventListener('click', function(){ navigator.clipboard.writeText(LINK); var o=cp.textContent; cp.textContent='Скопійовано \u2713'; setTimeout(function(){cp.textContent=o;},1500); });
var rq = document.querySelector('.req .btn2');
if (rq) rq.addEventListener('click', function(){ var o=rq.textContent; rq.textContent='Скопійовано \u2713'; setTimeout(function(){rq.textContent=o;},1500); });
var f=document.getElementById('rcFile'), b=document.getElementById('rcSend'), m=document.getElementById('rcMsg');
if (b) b.addEventListener('click', async function(){
  if(!f.files||!f.files[0]){ m.textContent='Оберіть файл'; m.className='rc-msg err'; return; }
  if(f.files[0].size>10*1024*1024){ m.textContent='Файл завеликий (до 10 МБ)'; m.className='rc-msg err'; return; }
  b.disabled=true; m.textContent='Надсилаємо…'; m.className='rc-msg';
  var fd=new FormData(); fd.append('code',CODE); fd.append('file',f.files[0]);
  try{ var r=await fetch('/api/receipt',{method:'POST',body:fd}); var d={}; try{d=await r.json();}catch(e){}
    if(r.ok&&d.ok){ m.textContent='Квитанцію надіслано \u2713 Дякуємо!'; m.className='rc-msg ok'; f.value=''; }
    else { m.textContent=(d&&d.error)?d.error:'Не вдалося надіслати.'; m.className='rc-msg err'; }
  } catch(e){ m.textContent='Помилка зʼєднання.'; m.className='rc-msg err'; }
  finally { b.disabled=false; }
});
`;

function pageHtml(inner, title) {
  return '<!doctype html><html lang="uk"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Monomakh&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style></head><body>' + inner + '</body></html>';
}
function html(body, status) {
  return new Response(body, { status: status || 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function getRequisites(env) {
  try {
    const r = await fetch("https://api.telegram.org/bot" + env.TG_BOT_TOKEN + "/getChat?chat_id=" + encodeURIComponent(env.TG_CHAT_ID));
    const d = await r.json();
    const pin = d && d.ok && d.result && d.result.pinned_message;
    return (pin && (pin.text || pin.caption)) || null;
  } catch (e) { return null; }
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
      '<div class="brand">Свято-Богоявленський<br>Кременецький монастир</div>' +
      '<h1>Памʼятку не знайдено</h1>' +
      '<p class="muted">Запис за номером <b>' + esc(code) + '</b> не знайдено. Можливо, минуло понад 7 днів або номер введено з помилкою.</p>' +
      '<div style="height:16px"></div>' + reqBlock +
      '<a class="btn" href="' + origin + '/">На головну</a></div></div>';
    return html(pageHtml(inner, "Памʼятку не знайдено"), 404);
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
    return '<div class="sheet ' + ty.c + '"><div class="sh-h">' + ty.t + '</div><div class="sh-tr">' + treba +
      '</div><ul class="sh-n">' + names + '</ul><div class="sh-s">Сума: <b>' + sumTxt + '</b></div></div>';
  }).join("");
  let tot = total > 0 ? money(total) : "";
  if (hasDon) tot = tot ? tot + " + пожертва" : "на пожертву";

  const link = origin + "/z/" + (rec.code || code);
  const shareTxt = "Памʼятка для оплати треб (Свято-Богоявленський Кременецький монастир). Номер: " + (rec.code || code) + ".";
  const shareBlock =
    '<div class="share"><div class="share-t">Надіслати памʼятку собі</div><div class="share-row">' +
    '<a class="sh" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(shareTxt) + '">Telegram</a>' +
    '<a class="sh" href="viber://forward?text=' + encodeURIComponent(shareTxt + " " + link) + '">Viber</a>' +
    '<a class="sh" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(shareTxt + " " + link) + '">WhatsApp</a>' +
    '<a class="sh" href="mailto:?subject=' + encodeURIComponent("Памʼятка для оплати — " + (rec.code || code)) + '&body=' + encodeURIComponent(shareTxt + "\n" + link) + '">Пошта</a>' +
    '<button class="sh" id="cpLink">Копіювати</button></div></div>';
  const receiptBlock =
    '<div class="rc"><div class="rc-t">Надіслати квитанцію про оплату</div>' +
    '<p class="rc-p">Прикріпіть скрін або фото квитанції (за бажанням).</p>' +
    '<input type="file" id="rcFile" accept="image/*,application/pdf">' +
    '<button class="btn2" id="rcSend">Надіслати квитанцію</button>' +
    '<div class="rc-msg" id="rcMsg"></div></div>';

  const inner =
    '<div class="wrap"><div class="card">' +
    '<div class="brand">Свято-Богоявленський<br>Кременецький монастир</div>' +
    '<h1>Памʼятка для оплати</h1>' +
    '<div class="code">Номер запису<br><b>' + esc(rec.code || code) + '</b></div>' +
    '<div class="meta">' + esc(dt) + (rec.name ? ' · ' + esc(rec.name) : '') + (rec.phone ? ' · ' + esc(rec.phone) : '') + '</div>' +
    sheets +
    '<div class="total">До сплати: <b>' + (tot || "—") + '</b></div>' +
    '<div class="donate"><b>Оплата треб — це добровільна пожертва на монастир.</b></div>' +
    reqBlock +
    '<p class="note">У коментарі до платежу вкажіть <b>номер</b> (' + esc(rec.code || code) + ') або ваше <b>імʼя та телефон</b>.<br>Памʼятка дійсна 7 днів від подання записки.</p>' +
    shareBlock + receiptBlock +
    '<a class="btn" href="' + origin + '/">Подати ще одну записку</a></div></div>' +
    '<script>' + SCRIPT.replace('__CODE__', JSON.stringify(rec.code || code)) + '<\/script>';
  return html(pageHtml(inner, "Памʼятка " + (rec.code || code)));
}
