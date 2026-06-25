# Mkulima Agrovet POS

A full-featured, offline-capable Point of Sale system for agricultural retail (agrovet) shops in Kenya. Runs as a web app and as a native Android APK — both from the same React codebase via [Capacitor](https://capacitorjs.com/).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Data Models](#data-models)
- [Offline Support](#offline-support)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Backend Setup (Supabase)](#backend-setup-supabase)
- [Building the Android APK](#building-the-android-apk)
- [Security Notes](#security-notes)

---

## Overview

Mkulima Agrovet POS is designed for small-to-medium agrovet shops that need reliable sales, inventory, credit, and finance management — including in areas with intermittent internet connectivity. Sales made offline are queued locally and automatically synced to the cloud when a connection is restored.

Currency: **Kenya Shilling (KES)**.

---

## Features

### Point of Sale (Cashier & Admin)
- Product search and category-filtered grid
- Cart with per-item quantity adjustments
- Discount support (fixed KES amount or percentage, applied at cart level)
- Payment methods: **Cash**, **Card**, **Mobile Money**, **Credit**
- Credit sales record customer name and contact for follow-up
- Offline checkout — sales are queued in IndexedDB and synced when online

### Credit Sales Management
- List all open credit sales (last 90 days)
- Record partial or full payment against a credit balance (cash or mobile money)
- Receipt printing per payment event
- Real-time updates via Supabase Realtime or 10-second polling fallback

### Inventory Management (Admin)
- Add, edit, and delete products (name, SKU, category, price, reorder level, description, photo)
- Product photo capture via device camera
- Low-stock alerts when `quantity_in_stock < reorder_level`
- Total stock value calculation

### Stock Requisition (Admin)
- Stage a list of products with requested quantities
- Export requisition as a PDF to share with supplier

### Sales History
- Cashiers see their own transactions; admins see all
- Expandable transaction detail with line items and payment breakdown
- Filterable by date

### Reports (Admin)
- Daily sales summary: total revenue, transaction count, payment method breakdown
- Top 5 products by quantity sold
- Filter by cashier/staff member
- Export report as PDF

### Finance / Expense Tracking (Admin)
- Record expenses by category: Salaries, Rent, Logistics, Investment, Others
- Date range filter (defaults to month-to-date)
- Profit = total revenue − total expenses

### Receipts
- Web: opens browser print dialog
- Android APK: generates a PDF (80 mm thermal paper format) and opens the Android share sheet

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript 5 |
| Build | Vite 5 (esbuild) + `@vitejs/plugin-legacy` |
| Backend | Supabase (PostgreSQL + RLS + RPC) |
| Local DB | Dexie 4 (IndexedDB wrapper) |
| Mobile | Capacitor 6 (Android wrapper) |
| Auth | PIN-based login with bcryptjs |
| PDF | jsPDF |
| Camera | `@capacitor/camera` |
| File share | `@capacitor/share` + `@capacitor/filesystem` |
| Styling | Plain CSS |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│               React App (src/)               │
│  Pages → Components → Services → Data Layer  │
└──────────────────────────────────────────────┘
           │                        │
    ┌──────▼──────┐          ┌──────▼──────┐
    │  Supabase   │          │  IndexedDB  │
    │ (PostgreSQL)│          │  (Dexie)    │
    │  [online]   │          │  [offline]  │
    └─────────────┘          └─────────────┘
           │
    ┌──────▼──────┐
    │  Capacitor  │  (Android APK wraps dist/)
    └─────────────┘
```

**Web & Android share the same `src/`**. The APK is the Vite-built `dist/` folder embedded as Capacitor assets. Any UI change automatically applies to both targets after a rebuild.

### Offline-First Flow

1. On first load, products and categories are fetched from Supabase and cached in IndexedDB.
2. On subsequent loads, the cache is served immediately; a background fetch refreshes it (stale-while-revalidate, 800 ms IndexedDB read timeout).
3. When offline, completed sales are written to `pending_sales` / `pending_sale_items` in IndexedDB and local stock quantities are decremented immediately.
4. When connectivity is restored, `syncPendingSales()` uploads each pending sale to Supabase, adjusts remote stock quantities, marks the sale as synced, then refreshes the local product cache.
5. A network status banner in the header shows "Offline — N sales pending sync" or "Syncing N sales…".

---

## User Roles

| Role | Accessible Pages |
|---|---|
| **Cashier** | POS (checkout), Transaction History (own), Credit Sales |
| **Admin** | POS, Inventory, Sales History (all), Reports, Finance, Stock Requisition, Credit Sales |

### Authentication

- Staff log in with a **6-digit PIN** (no username/password required at the screen — the username is stored in the session after the first login or seeded by the admin).
- PINs are stored as **bcrypt hashes** in the `staff_users` table.
- Session is persisted in `localStorage` under the key `mkulima-auth-user`.
- Role is derived from the `role` field in `staff_users` (`admin` or `cashier`).

---

## Data Models

```typescript
Product         { id, name, sku, category, description?, unit_price,
                  quantity_in_stock, reorder_level, image_url?, created_at, updated_at }

Sale            { id, sale_date, total_amount,
                  payment_method: 'cash'|'card'|'mobile_money'|'credit',
                  status: 'completed'|'pending'|'cancelled',
                  customer_name?, customer_contact?,
                  amount_paid?, payment_channel?,
                  cashier_name?, cashier_role?,
                  discount_amount? }

SaleItem        { id, sale_id, product_id, quantity, unit_price, subtotal }

Category        { id, name, description?, created_at }

StockMovement   { id, product_id,
                  movement_type: 'in'|'out'|'adjustment',
                  quantity, reference, notes?, created_at }

FinanceExpense  { id, expense_date,
                  category: 'salaries'|'rent'|'logistics'|'investment'|'others',
                  description, amount }

StaffUser       { id, username, pin_hash, role, display_name, is_active,
                  created_at, updated_at }

ReceiptData     { saleId, receiptNumber, saleDate, paymentMethod,
                  totalAmount, discountAmount?, cashierRole, cashierName,
                  items: ReceiptItem[] }
```

### Supabase Tables

- `products` — product catalogue
- `categories` — product categories
- `sales` — completed transactions
- `sale_items` — line items per transaction
- `stock_movements` — inventory movement log
- `profiles` — optional user profile data
- `staff_users` — authentication table (PIN hashes, roles)

### RPC Functions

- `get_daily_sales_report(report_date date)` — returns aggregated daily revenue, counts, and product totals

---

## Offline Support

| Capability | Detail |
|---|---|
| Product catalogue | Cached in IndexedDB, stale-while-revalidate |
| Offline checkout | Sales queued in `pending_sales` / `pending_sale_items` |
| Stock tracking | Local quantities decremented immediately on offline sale |
| Auto-sync | Triggered on `online` event; uploads pending sales, reconciles stock |
| Status feedback | Header banner shows pending count and sync progress |

---

## Project Structure

```
mkulima-shop/
├── src/
│   ├── pages/
│   │   ├── POSPage.tsx           # Checkout interface
│   │   ├── LoginPage.tsx         # PIN login
│   │   ├── InventoryPage.tsx     # Product management (admin)
│   │   ├── SalesPage.tsx         # Sales history browser (admin)
│   │   ├── ReportsPage.tsx       # Daily reports + PDF export (admin)
│   │   ├── FinancePage.tsx       # Expense tracking + profit (admin)
│   │   ├── StockRequisitionPage.tsx  # Restock requests (admin)
│   │   ├── CreditSalesPage.tsx   # Credit account management
│   │   ├── HistoryPage.tsx       # Transaction history
│   │   └── ReceiptPage.tsx       # Post-sale receipt display
│   ├── components/
│   │   ├── ProductList.tsx       # Category grid + search
│   │   ├── Cart.tsx              # Cart with discount + payment
│   │   ├── CreditCheckout.tsx    # Credit sale flow
│   │   ├── AddProductForm.tsx    # New product modal
│   │   ├── EditProductModal.tsx  # Edit product modal
│   │   └── TransactionHistory.tsx
│   ├── services/
│   │   ├── supabase.ts           # Supabase CRUD + demo fallback
│   │   ├── auth.ts               # PIN verification (bcryptjs)
│   │   ├── localDb.ts            # Dexie schema definition
│   │   ├── offlineService.ts     # Offline sale queue + sync
│   │   ├── checkout.ts           # Sale completion (online/offline router)
│   │   ├── pdf.ts                # jsPDF receipt + report generation
│   │   └── camera.ts             # Capacitor Camera integration
│   ├── contexts/
│   │   └── AuthContext.tsx       # Global auth state provider
│   ├── hooks/
│   │   └── useNetworkStatus.ts   # Online/offline + pending sale count
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── styles/                   # CSS stylesheets
│   ├── App.tsx                   # Router + role-based nav
│   └── index.tsx                 # Entry point
├── supabase/
│   ├── schema.sql                # Table + RLS definitions
│   └── seed.sql                  # Demo data + staff users
├── android/                      # Capacitor Android project
│   └── app/src/main/assets/public/  # Pre-built dist/ lives here
├── dist/                         # Vite build output (gitignored)
├── capacitor.config.ts           # App ID: com.mkulima.agrovetpos
├── vite.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### Install & Run (Web)

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev                  # dev server on http://localhost:5173
```

### Demo Mode

If `VITE_SUPABASE_URL` is not set, the app falls back to an in-memory demo mode with sample products and sales — useful for UI development without a backend.

---

## Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are found in your Supabase project under **Settings → API**.

---

## Backend Setup (Supabase)

Run these SQL files in your Supabase **SQL Editor** in order:

```
1. supabase/schema.sql   — creates all tables, RLS policies, and the RPC function
2. supabase/seed.sql     — inserts demo categories, products, and staff users
```

The seed creates two demo staff accounts:

| Username | PIN | Role |
|---|---|---|
| `admin` | `123456` | Admin |
| `cashier1` | `123456` | Cashier |

Change these PINs before going to production.

---

## Building the Android APK

After any UI change, rebuild and sync so the Android project stays current:

```bash
npm run build           # compiles src/ → dist/
npx cap sync android    # copies dist/ → android/app/src/main/assets/public/
```

Then build the APK with Android Studio or Gradle:

```bash
cd android
./gradlew assembleRelease
# output: app/build/outputs/apk/release/app-release.apk
```

A `keystore.properties` file (not committed) is required for signed release builds.

---

## Security Notes

- **RLS policies** in `schema.sql` are currently open (`FOR ALL USING (true)`) for rapid prototyping. Before going to production, tighten them to enforce per-user or per-role access control.
- **Staff PINs** are bcrypt-hashed. Never store plain PINs.
- The Supabase **anon key** is safe to expose in the client (it only grants access as defined by your RLS policies). The **service role key** must never be included in client code.
- Session data in `localStorage` does not expire automatically; implement a timeout policy appropriate for your deployment environment.
