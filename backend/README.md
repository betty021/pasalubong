# PasalubongHub API

Node.js + Express + PostgreSQL (Supabase). Isang tindahan lang: **admin** (may-ari) at **customer**.

## Setup (step by step)
1. Supabase > SQL Editor: kung may lumang `shops` table pa, patakbuhin ang `sql/reset_old_tables.sql` (ISANG BESES LANG, at bago pa magkalaman ang bagong tables).
2. `npm install`
3. Kopyahin ang `.env.example` sa `.env` at punan (DATABASE_URL, JWT_SECRET, at ang SMTP_* para sa email verification — tingnan sa ibaba)
4. `npm run db:init`  (gagawa ng mga table; ligtas ulitin)
5. `npm run admin:create -- email@mo.com MalakasNaPassword`
6. `npm run dev`  ->  http://localhost:4000/api/health

## Endpoints
Ipadala ang token: `Authorization: Bearer <token>`

| Method | Path | Sino |
|---|---|---|
| POST | /api/auth/register-customer (Gmail lang; magpapadala ng 6-digit code) | public |
| POST | /api/auth/verify-email `{email, code}` (nagla-login na pagka-tama) | public |
| POST | /api/auth/resend-verification `{email}` | public |
| POST | /api/auth/login `{role, email, password}` | public |
| GET / PATCH | /api/auth/me | naka-login / customer |
| PUT | /api/auth/password | naka-login |
| GET | /api/store | public |
| PATCH | /api/store | admin |
| GET | /api/categories | public (admin: `?archived=true`) |
| POST, PATCH /:id, DELETE /:id, POST /:id/restore | /api/categories | admin |
| GET | /api/products `?category_id=&q=` | public (active lang; admin: lahat) |
| GET | /api/products/:id | public |
| POST, PATCH /:id, DELETE /:id, POST /:id/restore | /api/products | admin |
| POST | /api/orders `{customer_name, customer_phone, fulfillment, address?, notes?, items:[{product_id, quantity}]}` | customer |
| GET | /api/orders/mine | customer (lalabas ang code kapag Ready na) |
| GET | /api/orders `?status=` | admin |
| GET | /api/orders/:id | admin |
| PATCH | /api/orders/:id/status `{status}` | admin (cancelled = ibinabalik ang stock) |

Soft delete ang lahat ng DELETE (archive lang). Ang presyo at stock ay laging galing sa database, hindi sa browser.


## Hakbang 5-6
- `GET /api/summary` (admin) — buod para sa Dashboard (benta, orders bawat status, best sellers, low stock).
- Frontend: sidebar ang admin (`/admin`, `/admin/orders`, `/admin/products`, `/admin/categories`, `/admin/store`, `/admin/messages`); top bar ang bisita at customer. Font Awesome ang mga icon (`npm install` sa frontend).

## Email verification (Gmail)
- Gmail lang ang tinatanggap sa sign-up (`@gmail.com`). Pagka-register, magpapadala ng **6-digit code** sa Gmail ng customer (valid 15 minuto, 5 maling subok lang, 60 segundo bago puwedeng mag-resend). Hindi puwedeng mag-login hangga't hindi na-verify.
- Setup ng pang-send na Gmail: i-on ang 2-Step Verification -> https://myaccount.google.com/apppasswords -> gumawa ng App Password -> ilagay sa `.env` bilang `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- Habang walang SMTP sa `.env` (local dev), ipi-print ang code sa console ng backend. Sa production (`NODE_ENV=production`) ay kailangan talaga ang SMTP.
- Database: patakbuhin ulit ang `npm run db:init` (o i-paste ang `sql/step6_email_verification.sql` sa Supabase SQL Editor). Ang mga customer na existing na ay awtomatikong verified.
- Tandaan: may mga hosting (hal. Render free plan) na bina-block ang SMTP ports; kung ganoon, kailangan ng email API (Resend/Brevo) sa halip.

## Hakbang 8: PWA, offline, background sync, push
- `cd backend && npm install` (may bagong `web-push`), tapos `npm run db:init` (gagawa ng `push_subscriptions`).
- `npm run push:keys` -> ilagay ang `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` sa `.env`. Kapag wala, naka-off lang ang push (hindi nagka-crash).
- Ang service worker ay naka-register sa **production build lang**: `cd frontend && npm run build && npm run preview` (port 4173). Dapat HTTPS ang hosting (localhost ay OK).
- Offline: app shell, products, categories, store info at mga larawan. Hindi naka-cache: login, orders, chat, admin.
- Background sync: ang "mark as read" (notifications at chat) na ginawa habang offline ay ipinapadala pagbalik ng internet. Sinadyang hindi kasama ang checkout.
- Push: Settings > Push notifications > Turn on. Dumadaan sa `createNotification()`, kaya lahat ng bell notification ay may push din.
- Tandaan: sa iPhone/iPad, gumagana lang ang push kapag naka-"Add to Home Screen" ang app. Ang Background Sync API ay Chromium lang; sa iba, nire-replay ang pila pagbukas ng app o pagbalik ng internet.

## Offline checkout (Background Sync)
- Kapag walang internet pagpindot ng **Place order**, ise-save ang order sa device (IndexedDB) at ipapadala kusa pagbalik ng internet. Makikita ito sa **My Orders** bilang "Waiting to be placed".
- Walang doble: bawat order ay may unique na `client_key` (unique index `orders_client_key_uq`). Ang server pa rin ang kumukuha ng presyo, stock at shipping fee.
- Kung tanggihan pagbalik ng internet (hal. ubos na ang stock), lalabas ang dahilan sa My Orders at puwedeng i-Dismiss.
- Database: patakbuhin ang `sql/order_client_key.sql` sa Supabase SQL Editor.
- Para sa demo: `cd frontend && npm run build && npm run preview`, buksan ang DevTools > Network > Offline, mag-order, tapos ibalik sa Online.
