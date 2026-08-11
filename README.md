# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company — customers, products/inventory, and a sales challan flow with stock-safe business logic.

## Live Deployment
- **Frontend:** https://fundsroom-steel.vercel.app
- **Backend API:** https://fundsroom-sdea.onrender.com
- **Repository:** https://github.com/iahamedalii/fundsroom (branch: `develop`)

> Note: the backend is hosted on Render's free tier, which spins down after inactivity. The first request after idle time can take 30–60 seconds to respond while it wakes up — this is expected, not a bug.

## Demo Recording
https://drive.google.com/file/d/1OqIZ-Xz_3SWHXu2Qyz5HYj5-fjomaAhv/view?usp=sharing


## Tech Stack
- **Backend:** Node.js, TypeScript, Express, PostgreSQL (Supabase), Prisma ORM, JWT auth, Zod validation
- **Frontend:** React (Vite + TypeScript), React Router, Axios, plain CSS (responsive)
- **Deployment:** Render (backend), Vercel (frontend), Supabase (Postgres)

## Architecture (short version)
- `backend/` — REST API. Layered as `routes -> controllers -> prisma`. `middleware/auth.ts` handles JWT verification + role-based route guards. `middleware/errorHandler.ts` centralizes error responses so controllers stay clean.
- `frontend/` — Vite React SPA. `AuthContext` stores the JWT + user in `localStorage` and attaches it to every API call via an Axios interceptor. Pages are grouped by module (Customers, Products, Challans).
- **Sales challan business logic** lives in `backend/src/controllers/challan.controller.ts`:
  - Every challan item stores a **snapshot** of product name/SKU/price at the time it was added (not just a foreign key), so historical challans stay accurate even if a product is later renamed or repriced.
  - Confirming a challan (either at creation or via the `/confirm` endpoint) checks stock **inside a DB transaction** before decrementing it — stock can never go negative, and a proper 400 error is returned if it would.
  - Cancelling a **confirmed** challan restores the stock it had reserved and logs a stock movement, so the inventory log stays consistent.

## Local Setup

### 1. Database
Create a free PostgreSQL instance (any of these work): [Neon](https://neon.tech), [Supabase](https://supabase.com), or a local Postgres install.

### 2. Backend
```bash
cd backend
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed                # creates one test user per role + sample products
npm run dev                 # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env        # VITE_API_URL should point at your backend
npm install
npm run dev                 # http://localhost:5173
```

### Test logins (seeded, password for all: `password123`)
| Role | Email |
|---|---|
| Admin | admin@erp.test |
| Sales | sales@erp.test |
| Warehouse | warehouse@erp.test |
| Accounts | accounts@erp.test |

## Environment Variables
**backend/.env**
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — any long random string
- `JWT_EXPIRES_IN` — e.g. `8h`
- `PORT` — defaults to 4000
- `CORS_ORIGIN` — your frontend URL

**frontend/.env**
- `VITE_API_URL` — your backend base URL

## Deployment (free-tier path)
1. **Database:** create a Neon/Supabase Postgres project, copy the connection string into backend `DATABASE_URL`.
2. **Backend:** push `backend/` to GitHub, connect it on Render/Railway as a Node service. Build command: `npm install && npx prisma generate && npm run build`. Start command: `npm run start`. Add the same env vars as `.env`. Run `npx prisma migrate deploy` once (Render/Railway shell) and `npm run seed` to create test users.
3. **Frontend:** push `frontend/` to GitHub, connect it on Vercel/Netlify. Build command: `npm run build`, output dir: `dist`. Set `VITE_API_URL` to the deployed backend URL.
4. **CORS:** update backend `CORS_ORIGIN` to the deployed frontend URL.

AWS deployment is optional per the assignment; the above path avoids any cost.

## API Overview
All endpoints except `/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/login | public | returns JWT + user |
| GET | /auth/me | any | current user |
| GET | /customers | any | `?search=&status=&page=&limit=` |
| GET | /customers/:id | any | includes follow-ups + challans |
| POST | /customers | Admin, Sales | |
| PUT | /customers/:id | Admin, Sales | |
| POST | /customers/:id/follow-ups | Admin, Sales | add a note |
| GET | /products | any | `?search=&lowStock=true&page=&limit=` |
| GET | /products/:id | any | includes stock movement log |
| POST | /products | Admin, Warehouse | |
| PUT | /products/:id | Admin, Warehouse | |
| POST | /products/:id/stock-movements | Admin, Warehouse | manual IN/OUT adjustment |
| GET | /challans | any | `?status=&customerId=&page=&limit=` |
| GET | /challans/:id | any | |
| POST | /challans | Admin, Sales | create as DRAFT or CONFIRMED |
| POST | /challans/:id/confirm | Admin, Sales, Warehouse | deducts stock, validates availability |
| POST | /challans/:id/cancel | Admin, Sales | restores stock if it was confirmed |

Full request/response examples: see `insomnia_collection.json` (import via Insomnia → Create → Import From File — it's also Postman-compatible if opened there instead).

## Known Limitations / Not Implemented
- No password-reset / user-management UI (users are seeded directly; adding a "manage users" screen was out of scope for the time available).
- No invoice generation or PDF export (listed as bonus in the brief).
- No pagination controls in the frontend UI yet — the API supports `page`/`limit`, but the UI currently just calls with defaults (fetches first 20-100).
- No automated tests (unit/integration) — given the 48-hour window, testing was prioritized manually via Insomnia.
- Purchase orders (mentioned in the business context) are not implemented — the brief's "Core Modules Required" section did not list a Purchase Order module, so it was treated as out of scope; happy to add it if needed.
- Docker/GitHub Actions/S3 image upload (bonus items) not implemented due to time.


## Assumptions Made
- "Sales challan" quantities and prices are captured as a snapshot on `ChallanItem`, separate from the live `Product` record, per the requirement that challans "should store product snapshot data, not only product ID."
- Confirming a challan can happen either at creation time (`status: "CONFIRMED"` in the create payload) or afterward via a dedicated `/confirm` endpoint on an existing DRAFT — both paths re-validate stock immediately before deducting it.
- Warehouse role can confirm challans (since confirming affects stock, which is a warehouse concern) in addition to Sales/Admin; only Sales/Admin can create or cancel challans.
- The deployed backend (Render) connects to Supabase via its **transaction pooler** (port 6543), not the direct connection (port 5432) — Render's network doesn't support the IPv6-only direct connection. Migrations are run locally against the direct connection instead, since PgBouncer's transaction mode doesn't support the prepared statements Prisma migrations need.