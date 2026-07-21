/**
 * GET /z/<номер>  — сторінка «Ваші записки» (перегляд і пожертва).
 * Читає запис із KV (RECORDS) за номером і показує його разом із поточними реквізитами
 * (із закріпленого повідомлення каналу). Дійсна 7 днів (TTL запису в KV).
 */
function normPhoneZ(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return String(raw || "").trim();
  if (d.length === 12 && d.startsWith("380")) return "+" + d;
  if (d.length === 11 && d.startsWith("80")) return "+3" + d;
  if (d.length === 10 && d.startsWith("0")) return "+38" + d;
  if (d.length === 9) return "+380" + d;
  return String(raw || "").trim();
}

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
.telx{color:inherit;text-decoration:none;border-bottom:1px dotted currentColor}
.tohome{display:inline-block;margin-bottom:14px;font-size:14px;color:var(--blue);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:#fff}
.tohome:hover{border-color:var(--blue);background:var(--bg)}
.step-tag{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:10px}
.req.step1{border:2px solid #C79A3B;background:#FFFCF5}
.req.step1 .step-tag{background:#C79A3B;color:#fff}
.rc.step2{border:2px solid #2E7D5B;background:#F5FBF8}
.filebtn{display:inline-block;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#2E7D5B;background:#fff;border:1.5px solid #2E7D5B;border-radius:999px;padding:10px 18px;margin:2px 0 8px;transition:.15s}
.filebtn:hover{background:#2E7D5B;color:#fff}
.filename{font-size:13px;color:var(--muted);margin-bottom:10px;word-break:break-all}
.rc.step2 .step-tag{background:#2E7D5B;color:#fff}
@media print{
  .tohome,.share,.rc,.btn,.acc-x,.note{display:none!important}
  body{background:#fff}
  .card{box-shadow:none;border:none;padding:0}
  .acc{display:block!important}
  .acc-b{display:block!important}
  .sheet{page-break-inside:avoid}
  .sh-n li{font-size:12pt!important;line-height:1.7}
  .sh-tr,.sh-h{font-size:12pt!important}
  .code b{font-size:14pt}
}
.ucm{font-size:14px;line-height:1.6;color:var(--ink);background:var(--bg);border-radius:10px;padding:10px 12px;margin:10px 0}
.sh-n li{overflow-wrap:anywhere;word-break:break-word}
.warr{background:#FFF7E6;border-radius:6px;padding:2px 6px}
.freetag{font-size:11px;color:#8A6D1F;white-space:nowrap}
.sh-w{font-size:13px;color:var(--blue);background:var(--bg);border-radius:8px;padding:5px 8px;margin-bottom:6px;display:inline-block}
.total{text-align:center;font-size:16px;margin:6px 2px 20px}
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
.two{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px}
.two>*{min-width:0;margin-bottom:0}
.two .rc,.two .req{margin-bottom:0;display:flex;flex-direction:column;justify-content:flex-start;width:100%;box-sizing:border-box;text-align:center}
.two .step-tag{align-self:center}
.two .req pre{text-align:left}

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
var nameBox=document.getElementById('rcName');
if(f&&nameBox){f.addEventListener('change',function(){nameBox.textContent=f.files&&f.files[0]?f.files[0].name:'Файл не вибрано';});}
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
    ? '<div class="req step1"><div class="step-tag">Крок 1</div><div class="req-t">Зробіть пожертву за реквізитами</div><pre id="req">' + esc(req) + '</pre>' +
      '<button class="btn2" onclick="navigator.clipboard.writeText(document.getElementById(\'req\').textContent)">Скопіювати реквізити</button></div>'
    : '<div class="req step1"><div class="step-tag">Крок 1</div><div class="req-t">Зробіть пожертву за реквізитами</div><p class="muted">Реквізити надасть обитель — зверніться до контактів і назвіть номер запису.</p></div>';

  if (!rec) {
    const inner =
      '<div class="wrap"><div class="card">' +
      '<a class="tohome" href="' + origin + '/">← На головну</a>' +
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
    vb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 0C9.5.03 5.3.34 3 2.47 1.3 4.19.7 6.7.63 9.82c-.06 3.11-.13 8.94 5.48 10.52v2.41s-.04.97.6 1.17c.79.25 1.24-.5 1.99-1.3l1.4-1.58c3.83.32 6.78-.42 7.11-.53.78-.25 5.18-.81 5.9-6.65.74-6.02-.36-9.83-2.34-11.55-.6-.55-3-2.29-8.37-2.31 0 0-.4-.03-1-.02zm.06 1.68c.52 0 .83.02.83.02 4.54.01 6.71 1.38 7.22 1.84 1.67 1.43 2.53 4.86 1.9 9.89-.6 4.87-4.17 5.18-4.83 5.39-.28.09-2.88.73-6.16.52 0 0-2.44 2.95-3.2 3.71-.12.12-.26.17-.35.15-.13-.03-.17-.19-.16-.42l.02-4.05c-4.74-1.32-4.46-6.28-4.41-8.88.05-2.6.54-4.73 1.99-6.16 1.96-1.78 5.48-2.02 7.15-2.01zm.56 2.5a.29.29 0 100 .58c1.4 0 2.6.42 3.53 1.35.93.93 1.35 2.12 1.35 3.53a.29.29 0 10.58 0c0-1.58-.5-2.93-1.55-3.98-1.05-1.05-2.4-1.55-3.98-1.55zm-4.13 1.2c-.24 0-.47.07-.66.22-.42.34-.8.75-1.06 1.18-.23.4-.35.82-.38 1.21-.03.35.05.7.15.97.29.8.85 1.65 1.23 2.24.51.77 1.12 1.5 1.83 2.14.72.62 1.51 1.14 2.37 1.54.51.24 1.05.43 1.45.54.42.11.82.07 1.15-.06.44-.18.83-.52 1.16-.9.16-.2.24-.44.24-.69 0-.25-.09-.49-.25-.69-.33-.37-.88-.72-1.27-.96-.41-.25-.85-.41-1.23-.41-.29 0-.57.1-.77.31l-.43.43a.32.32 0 01-.4.04 7.5 7.5 0 01-1.54-1.17 7.5 7.5 0 01-1.17-1.54.32.32 0 01.04-.4l.43-.43c.33-.33.37-.88.11-1.54-.16-.41-.43-.87-.72-1.28a1.13 1.13 0 00-.68-.24zm4.42.77a.29.29 0 10-.06.58c.87.09 1.48.34 1.89.75.41.41.66 1.02.75 1.89a.29.29 0 10.58-.06c-.1-.98-.4-1.75-.92-2.24-.5-.5-1.26-.82-2.24-.92zm.4 2.07a.29.29 0 10-.09.57c.35.06.55.16.67.28.12.12.22.32.28.67a.29.29 0 10.57-.09c-.07-.45-.24-.83-.52-1.11-.28-.28-.66-.45-1.11-.52z"/></svg>',

    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34m-5.42 7.4h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26C2.16 6.44 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 012.89 6.99c0 5.45-4.44 9.89-9.89 9.89M20.46 3.49A11.82 11.82 0 0012.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 005.69 1.45c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z"/></svg>',
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
    '<div class="rc step2"><div class="step-tag">Крок 2</div><div class="rc-t">Надішліть квитанцію</div>' +
    '<p class="rc-p">Прикріпіть скрін або фото підтвердження оплати — так обитель швидше знайде вашу пожертву. За бажанням.</p>' +
    '<input type="file" id="rcFile" accept="image/*,application/pdf" hidden>' +
    '<label class="filebtn" for="rcFile">📎 Прикріпити файл</label>' +
    '<div class="filename" id="rcName">Файл не вибрано</div>' +
    '<button class="btn2" id="rcSend">Надіслати квитанцію</button>' +
    '<div class="rc-msg" id="rcMsg"></div></div>';

  const inner =
    '<div class="wrap"><div class="card">' +
    '<a class="tohome" href="' + origin + '/">← На головну</a>' +
    '<div class="brand">Свято-Богоявленський Кременецький<br>жіночий монастир</div>' +
    '<h1>Ваші записки</h1>' +
    '<div class="code">Номер запису<br><b>' + esc(rec.code || code) + '</b></div>' +
    '<div class="meta">' + esc(dt) + (rec.name ? ' · ' + esc(rec.name) : '') + (rec.phone ? ' · <a class="telx" href="tel:' + esc(normPhoneZ(rec.phone)) + '">' + esc(normPhoneZ(rec.phone)) + '</a>' : '') + '</div>' +
    '<div class="total">До сплати: <b>' + (tot || "—") + '</b></div>' +
    '<div class="donate"><b>Оплата треб — це добровільна пожертва на монастир.</b></div>' +
    '<div class="two">' + reqBlock + receiptBlock + '</div>' +
    shareBlock +
    (rec.comment ? '<p class="ucm"><b>Ваш коментар:</b> ' + esc(rec.comment) + '</p>' : '') +
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
