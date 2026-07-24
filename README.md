# Indufar QR Product Verification System

A production-ready QR code verification system for **Indufar T.G. 15 mg (Tirzepatida 15 mg/0.5mL)**.

## Overview

Customers scan a QR code on the product packaging and are directed to a mobile-optimised verification page that confirms authenticity in real time. Administrators manage products, generate and track thousands of QR codes, import/export CSV files, and download ZIP archives of QR images.

---

## Technology Stack

| Layer      | Technology                       |
|------------|----------------------------------|
| Frontend   | React 18, Vite, React Router, Axios |
| Backend    | Node.js 18+, Express.js          |
| Database   | Supabase (PostgreSQL)            |
| Storage    | Supabase Storage                 |
| Auth       | Supabase Auth + JWT              |
| Hosting    | Vercel (frontend + backend)      |

---

## Folder Structure

```
root/
├── frontend/               # React/Vite frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level pages
│   │   ├── layouts/        # Page layout wrappers
│   │   ├── services/       # Axios API service layer
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Helper functions
│   │   ├── assets/         # Images, icons
│   │   └── styles/         # CSS files
│   ├── public/
│   ├── .env.example
│   └── package.json
│
├── backend/                # Express.js API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # Express route definitions
│   │   ├── middleware/      # Auth, validation, upload, error
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helpers (code gen, QR, CSV, etc.)
│   │   ├── config/         # Supabase client, constants
│   │   ├── __tests__/      # Jest unit + integration tests
│   │   ├── app.js          # Express app
│   │   └── server.js       # HTTP server entry
│   ├── api/
│   │   └── index.js        # Vercel serverless entry
│   ├── database/
│   │   └── migrations/     # SQL migration files
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
├── vercel.json             # Root monorepo Vercel config
├── .gitignore
└── README.md
```

---

## Supabase Setup

### 1. Create a Supabase project
Go to https://supabase.com → New Project → choose a region close to your users.

### 2. Run SQL Migrations
Open **Supabase Dashboard → SQL Editor** and run the following files **in order**:

```
backend/database/migrations/001_initial_schema.sql
backend/database/migrations/002_seed_default_product.sql
backend/database/migrations/003_storage_buckets.sql
```

### 3. Create Storage Buckets
Migration `003` handles bucket creation via SQL. If you prefer the dashboard:

- Go to **Storage** → **New Bucket**
- Create `product-images` → Public: **on**
- Create `company-logos` → Public: **on**

### 4. Create Admin Account

**Option A — Supabase Dashboard:**
1. Go to **Authentication → Users → Invite User**
2. Enter the admin email and send the invite
3. After the user sets their password, run this SQL to create the admin profile:

```sql
INSERT INTO admin_profiles (id, full_name, role)
VALUES (
  '<USER_UUID_FROM_AUTH_USERS>',
  'Admin Name',
  'admin'
);
```

**Option B — SQL (if you know the UUID):**
```sql
-- First create the user via Supabase Auth API, then:
INSERT INTO admin_profiles (id, full_name, role)
SELECT id, 'Admin Name', 'admin'
FROM auth.users
WHERE email = 'admin@indufar.com';
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
PUBLIC_VERIFICATION_BASE_URL=https://indufar-verification.vercel.app
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-minimum-32-character-random-string
JWT_EXPIRES_IN=24h
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> ⚠️ **Never commit `.env` files with real credentials.**  
> The `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.

---

## Local Development

After installing the backend and frontend dependencies and creating their `.env`
files, start the complete local application from the repository root:

```bash
npm run dev
```

This starts the API at `http://localhost:5000` and the app at
`http://localhost:5173`. Keep this command running while using the admin panel.

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in .env with your Supabase credentials
npm run dev
# → API running at http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Leave VITE_API_BASE_URL empty locally so Vite proxies /api requests
npm run dev
# → App running at http://localhost:5173
```

---

## Running Tests

```bash
cd backend
npm test
```

Test suites:
- `codeGenerator.test.js` — code uniqueness, charset, prefix
- `normalizeCode.test.js` — trimming, uppercasing
- `qrGenerator.test.js` — PNG buffer output, URL building
- `verifyApi.test.js` — HTTP integration tests for all verify scenarios

---

## Vercel Deployment

### Backend (Deploy Separately)

1. In Vercel, create a new project from the `backend/` folder
2. Set the **Root Directory** to `backend`
3. Add all environment variables (same as `backend/.env`)
4. Note your backend URL (e.g. `https://indufar-qr-api.vercel.app`)

### Frontend

1. In Vercel, create another project from the `frontend/` folder
2. Set the **Root Directory** to `frontend`
3. Add environment variables:
   - `VITE_API_BASE_URL=https://indufar-qr-api.vercel.app`
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
4. Note your frontend URL (e.g. `https://indufar-verification.vercel.app`)

### After Deployment

5. Go back to the **backend** Vercel project
6. Update `FRONTEND_URL` to your frontend Vercel URL
7. Update `PUBLIC_VERIFICATION_BASE_URL` to your frontend Vercel URL
8. Redeploy the backend

---

## ⚠️ Domain Warning Before Generating Production QR Codes

> **The verification domain CANNOT be changed after QR codes are printed.**  
> Setting `PUBLIC_VERIFICATION_BASE_URL=https://indufar-verification.vercel.app`  
> and generating production codes bakes that URL into every QR image.  
> If you change the domain later, all printed QR codes become unverifiable.

The admin panel requires checking a confirmation box before generating codes.

---

## How to Use the System

### Add a Product
1. Log in to `/admin/login`
2. Go to **Products → Add Product**
3. Fill in name, medicine name, dosage, upload images
4. Save

### Generate 10,000 QR Codes
1. Go to **Generate QR Codes**
2. Select **T.G. 15 mg** as the product
3. Click **10,000** quick-quantity button
4. Confirm the verification domain checkbox
5. Click **Generate 10,000 QR Codes**
6. Wait for completion (progress shown)
7. Click **Download CSV** or **Download ZIP**

### Export CSV
- **QR Codes → Export** → choose filters → Download

### Download QR Images as ZIP
- **QR Codes** → select codes → **Download ZIP**
- Or after generation, download the batch ZIP directly

### Test Authentic/Invalid Codes
- Valid: `GET https://indufar-qr-api.vercel.app/api/verify?code=7GG6Y89U8K`
- Invalid: `GET https://indufar-qr-api.vercel.app/api/verify?code=FAKECODE`

---

## API Endpoints Summary

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/verify?code=CODE` | Verify a QR code |

### Admin (all require `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/auth/login` | Admin login |
| POST | `/api/admin/auth/logout` | Admin logout |
| GET | `/api/admin/auth/me` | Current admin profile |
| GET | `/api/admin/products` | List products |
| POST | `/api/admin/products` | Create product |
| GET | `/api/admin/products/:id` | Get product |
| PUT | `/api/admin/products/:id` | Update product |
| DELETE | `/api/admin/products/:id` | Delete product |
| GET | `/api/admin/qr-codes` | List QR codes |
| POST | `/api/admin/qr-codes` | Create QR code |
| GET | `/api/admin/qr-codes/:id` | Get QR code |
| PUT | `/api/admin/qr-codes/:id` | Update QR code |
| DELETE | `/api/admin/qr-codes/:id` | Delete QR code |
| POST | `/api/admin/qr-codes/generate` | Bulk generate |
| GET | `/api/admin/qr-codes/export` | Export CSV |
| GET | `/api/admin/qr-codes/template` | Download CSV template |
| POST | `/api/admin/qr-codes/preview-import` | Preview CSV import |
| POST | `/api/admin/qr-codes/import` | Import CSV |
| POST | `/api/admin/qr-codes/download-zip` | Download ZIP |
| PATCH | `/api/admin/qr-codes/bulk-status` | Bulk activate/deactivate |
| DELETE | `/api/admin/qr-codes/bulk-delete` | Bulk delete |
| GET | `/api/admin/qr-codes/generation-batches` | List batches |
| GET | `/api/admin/qr-codes/generation-batches/:id` | Get batch |
| GET | `/api/admin/scans` | List scan history |
| GET | `/api/admin/scans/:id` | Get scan detail |
| GET | `/api/admin/scans/export` | Export scans CSV |
| GET | `/api/admin/scans/dashboard` | Dashboard stats |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `products` | Product catalog |
| `qr_codes` | Individual QR codes with status and scan counters |
| `generation_batches` | Tracks bulk generation jobs |
| `scan_logs` | Every verification attempt |
| `admin_profiles` | Admin user profiles linked to Supabase Auth |

---

## Security Notes

- The `SUPABASE_SERVICE_ROLE_KEY` is **only used server-side**
- All public verification goes through the Express API (not direct DB)
- RLS policies deny all direct public access to tables
- Codes are normalized (trimmed, uppercased) before lookup
- Rate limiting on public verify endpoint: 30 req/min/IP
- Rate limiting on login: 10 req/15min/IP
- JWT expires in 24 hours
- Helmet + CORS configured

---

*Secured verification · Powered by Indufar*
# News Automation

The admin News page stores the latest ten Spaceflight News API articles in Supabase.
Apply `backend/database/migrations/006_news.sql`, then set the server-only
`CRON_SECRET` environment variable in Vercel. The configured Vercel Cron invokes
`GET /api/cron/news` daily at `5 0 * * *` (12:05 AM UTC) and sends
`Authorization: Bearer <CRON_SECRET>`. Admins can also refresh from `/admin/news`.
