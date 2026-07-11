# Свято-Богоявленський Кременецький монастир — сайт (Astro)

Сайт обителі на **Astro**. На старті працює сторінка **«Записний стіл»**
(подача треб → Telegram). Інші сторінки вмикаються поступово (див. нижче).

Код зберігається на **GitHub**, хоститься на **Cloudflare Pages**
(там же виконується Telegram-функція і зберігаються секрети).

## Структура
```
src/
  pages/index.astro        ← сторінка «Записний стіл»
  layouts/Layout.astro     ← каркас (шрифти, <head>, шапка/футер)
  components/Header.astro   Footer.astro   ← автономні шапка/футер
  data/nav.js              ← список сторінок + прапорець ready (готова/ні)
  styles/global.css        ← стилі (біло-синя тема)
  treby-body.html          ← розмітка форми записок
public/
  treby.js                 ← логіка «записного столу» (клієнтський скрипт)
  logo.png, _headers, robots.txt
functions/
  api/send-treba.js        ← серверна функція: надсилання записки в Telegram
astro.config.mjs           ← тут вкажіть реальний домен у полі site
```

## Локальний запуск (для розробника)
```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # збірка у dist/
```

## Розгортання: GitHub → Cloudflare Pages
1. Створіть репозиторій на **GitHub** і залийте цей проєкт:
   ```bash
   git init && git add . && git commit -m "Кременецький монастир — записний стіл"
   git branch -M main
   git remote add origin https://github.com/ВАШ-АКАУНТ/РЕПО.git
   git push -u origin main
   ```
2. У **Cloudflare → Workers & Pages → Create → Pages → Connect to Git** оберіть репозиторій.
3. Налаштування збірки:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. **Settings → Environment variables** додайте (Production і Preview):
   - `TG_BOT_TOKEN` — токен бота від @BotFather (СЕКРЕТ)
   - `TG_CHAT_ID` — ID каналу/групи монастиря (напр. `-100…`)
   Перерозгорніть проєкт.
5a. (для памʼятки на 7 днів) Створіть **KV namespace** і привʼяжіть його у
    Settings → Functions → KV namespace bindings під іменем **RECORDS**.
5. **Custom domains** — підключіть домен (HTTPS видається автоматично).

Далі кожен `git push` у `main` автоматично оновлює сайт.
Функція `/api/send-treba` працює з теки `functions/` (окремий крок не потрібен).

## Telegram-бот
1. @BotFather → `/newbot` → отримайте **TG_BOT_TOKEN**.
2. Створіть канал/групу монастиря, додайте бота **адміністратором**.
3. Дізнайтеся **TG_CHAT_ID** (напр. через @getidsbot) і впишіть у змінні Cloudflare.

Повідомлення приходить сегментовано: кожна записка окремо (тип, треба, імена, сума),
унизу — «Разом» і телефон.

## Як додати нову сторінку (коли буде готова)
1. Створіть `src/pages/pro.astro` (за зразком index.astro) з контентом.
2. У `src/data/nav.js` поставте цій сторінці `ready: true`.
   Шапка й підвал одразу почнуть її показувати — на всіх сторінках.

## Замінити перед публікацією
- `astro.config.mjs` → `site: 'https://ваш-домен'`.
- Контент із позначками «уточнюється» (телефон, email, розклад, храми, новини).

Повний перелік того, що монастир має зареєструвати/купити (домен, пошта, бот,
за потреби — оплата), наведено в окремому чек-листі, який передається разом із проєктом.
