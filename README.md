# Offline-First POS System

A full-stack Point of Sale web application (React PWA + Node/Express + PostgreSQL) designed so a cashier can keep selling when the internet drops. Sales are saved locally in the browser (IndexedDB) and pushed to the server when connectivity returns.

> **Project status:** feature-complete prototype built as a portfolio project. It has **no automated tests**, has **not been load- or production-tested**, and the PostgreSQL-backed flows have not been run end-to-end in the environment used to prepare this repository. See [Verification status](#verification-status) and [Known limitations](#known-limitations) for an honest account.

## Problem it addresses

Small shops often have unreliable connectivity. A cloud-only POS stops working when the connection fails. This project keeps the checkout flow running locally and reconciles with a central database afterwards, with support for multiple branches, each with its own inventory.

## Implemented features

**Authentication & roles**
- Email/password login with JWT access tokens (default 15 min) and rotating refresh tokens (default 7 days); refresh tokens are stored hashed (bcrypt).
- Roles: `ADMIN`, `MANAGER`, `CASHIER`, enforced by route middleware and by frontend route guards.
- Admin can create, edit and deactivate users (soft delete).

**Products & categories**
- Create / edit / deactivate products (soft delete) with name, SKU, barcode, price, cost price, tax rate, category.
- Barcode lookup endpoint; the POS search box matches a barcode or SKU on Enter (keyboard-wedge scanners work; there is no camera scanning).
- Categories with colour/icon fields.

**Checkout (POS screen)**
- Product grid with category filter and search; cart with quantity controls, per-line discount support in the store, and a cart-level discount value in the store.
- Tax calculated per product tax rate.
- Payment methods: cash (with change calculation), mobile money, card. *Payment is recorded only — there is no payment-gateway or mobile-money API integration.*
- Printable receipt (browser print window) showing store header, items, totals, and an "offline / pending sync" notice.

**Offline mode & sync**
- Product, category and inventory data cached in IndexedDB (`idb`).
- Sales created offline (or when the online API call fails) go into an IndexedDB queue with a client-generated UUID (`clientId`); local stock is decremented immediately.
- Sync engine: runs every 30 s and on the browser `online` event; pushes queued sales in batches of 50 to `POST /sync/batch`, then pulls `GET /sync/delta`.
- Server deduplicates sales by `clientId`; failed items are retried up to 3 attempts, then marked `failed`.
- UI shows online/offline state, pending count, last sync time and sync errors; Sales page has an "Offline Queue" tab with per-sale status.

**Inventory**
- Per-branch stock, automatic decrement on sale (inside a DB transaction), restore on void, manual adjustments with reason (audit-logged), low-stock / out-of-stock views.

**Reports & dashboard** (online only)
- Daily / weekly / monthly sales summaries, revenue, tax, discounts, average order value, profit (revenue − cost price × qty), payment-method breakdown, best-selling products, hourly distribution, low-stock alerts, charts (Recharts).

**Multi-branch**
- Branches, users and inventory are branch-scoped; non-admin users are restricted to their own branch for most queries; admins can query across branches.

**Audit & operations**
- `audit_logs` entries for sale creation, voids and inventory adjustments; `sync_logs` for processed sync operations.
- Helmet, CORS allow-list, rate limiting, request validation (express-validator), Winston logging, `/health` endpoint.

**PWA**
- Installable manifest and Workbox-generated service worker (via `vite-plugin-pwa`) that precaches the app shell and applies a stale-while-revalidate cache to product/category API calls.

## Technology stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18, Vite 5 | UI and build tooling |
| Styling | Tailwind CSS 3 | Touch-friendly dark UI |
| State | Zustand | Auth, cart, sync status, UI state |
| Routing | React Router 6 | Pages and role-guarded routes |
| Local DB | IndexedDB via `idb` | Offline products, inventory, sales queue |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, asset caching |
| Charts | Recharts | Dashboard and reports |
| HTTP | Axios | API client with token-refresh interceptor |
| Backend | Node.js, Express 4 | REST API (`/api/v1`) |
| ORM / DB | Prisma 5, PostgreSQL | Persistent data store |
| Security | jsonwebtoken, bcryptjs, helmet, express-rate-limit, cors | Auth and hardening |
| Logging | Winston, Morgan | Application and request logs |

No third-party/external services are integrated (no payment gateways, SMS, email, or cloud storage).

## Architecture

```
React PWA (Zustand, IndexedDB, Service Worker)
   │  online: REST calls            offline: writes to IndexedDB queue
   ▼                                        │
Express API  ◄───── sync engine (batch push + delta pull) ◄──┘
   │  JWT auth · RBAC · validation · rate limit
   ▼
Services (auth, sale, sync, report) ──► Prisma ──► PostgreSQL
```

**Checkout data flow:** cart (Zustand) → if online, `POST /sales`; if offline or the request fails → `enqueueSale()` in IndexedDB → local stock decrement → receipt. Later the sync engine posts queued sales; the server skips any `clientId` it has already stored.

**Conflict handling (as implemented):** sales — idempotent by `clientId`; products — `syncVersion` comparison (server wins if ahead); inventory — server-side decrement operation exists but the client does not currently enqueue inventory operations (stock changes travel with the sale).

## Database (Prisma schema)

`branches`, `users`, `categories`, `products`, `inventory` (unique per product+branch), `sales`, `sale_items`, `sync_logs`, `audit_logs`. Enums: `UserRole`, `PaymentMethod`, `SaleStatus`, `SyncStatus`. Full definition: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## Directory structure

```
.
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── app.js · server.js
│       ├── config/database.js
│       ├── middleware/   (auth, errorHandler, validate)
│       ├── routes/       (auth, user, branch, category, product, inventory, sale, sync, report)
│       ├── services/     (auth, sale, sync, report)
│       └── utils/        (logger, seed)
└── frontend/
    ├── vite.config.js · tailwind.config.js · postcss.config.js
    └── src/
        ├── App.jsx · main.jsx
        ├── components/   (ui/AppLayout, pos/Receipt, auth/AuthLayout)
        ├── pages/        (Login, POS, Dashboard, Products, Sales, Inventory, Reports, Users, Settings)
        ├── services/     (api, db [IndexedDB], syncEngine)
        └── store/        (syncStore.js — auth, cart, sync, UI stores)
```

## Local development

**Prerequisites:** Node.js 18+, PostgreSQL 14+.

```bash
# Backend
cd backend
npm install
cp .env.example .env            # set DATABASE_URL and strong JWT secrets
npx prisma generate
npx prisma migrate dev --name init   # no migrations are committed yet; this creates the first one
npm run db:seed                 # demo admin, cashier, categories, products
npm run dev                     # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:5000/api/v1
npm run dev                     # http://localhost:5173
```

Seeded demo accounts (development only — change or remove before any real deployment): `admin@myshop.com / admin123!` and `cashier@myshop.com / cashier123!`.

## Configuration

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets (use long random values) |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (`15m`, `7d`) |
| `PORT`, `NODE_ENV` | Server port / environment |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | Rate limiting |

**`frontend/.env`:** `VITE_API_URL` — base URL of the API.

Real `.env` files are git-ignored; only `.env.example` templates are committed.

## API overview

All routes are under `/api/v1`: `auth` (login, refresh, logout, register, me), `users`, `branches`, `categories`, `products` (incl. `/barcode/:code`), `inventory` (incl. `/adjust`), `sales` (incl. `PATCH /:id/void`), `sync` (`POST /batch`, `GET /delta`, `GET /status`), `reports` (`daily`, `weekly`, `monthly`, `low-stock`). Role requirements are defined in each file under `backend/src/routes/`.

## Verification status

What was actually checked when preparing this repository:

| Check | Result |
|---|---|
| Backend: `node --check` on every source file | ✅ Passed |
| Frontend: `npm install` + `vite build` | ✅ Passed (PWA service worker generated) |
| Prisma `validate` / `generate` | ⚠️ Not run — the preparation sandbox could not download Prisma engine binaries |
| API run against a live PostgreSQL database | ❌ Not performed |
| Automated tests (unit/integration/e2e) | ❌ None exist |
| Browser testing of offline → online sync | ❌ Not performed |

Three defects found during preparation were fixed: missing `postcss.config.js` (Tailwind was not being compiled), an invalid `require('uuid')` in `App.jsx`, and an incorrect `.env` path in the seed script.

## Known limitations

- No test suite; no committed Prisma migrations.
- PWA icons referenced by the manifest (`/icons/*.png`) are not included in the repo.
- Login requires internet; an offline session only works if the user was already logged in.
- Sync only handles sale creation reliably; the delta endpoint does not return categories, and offline product edits are not queued by the UI.
- Duplicate protection for `clientId` is an application-level check without a database unique constraint (a concurrent race is theoretically possible).
- Receipt numbers use a random suffix and are not guaranteed unique under heavy load.
- Reports calculate profit with per-item queries (slow for large datasets) and require connectivity.
- Store name/address on receipts are hard-coded.
- No encryption of locally stored data, no Background Sync API usage, and no caching layer.

## Future improvements (not implemented)

Automated tests (Jest/Supertest, Playwright), committed migrations and CI, unique constraint on `clientId`, local-data encryption, Background Sync API, offline product/inventory operation queue, configurable store settings, refunds, PWA icon set, code-splitting.
