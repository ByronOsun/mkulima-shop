# mkulima-shop

## Supabase Backend Setup

Run these in Supabase SQL Editor in this order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

The backend includes:
- `categories`
- `products`
- `sales`
- `sale_items`
- `stock_movements`
- `profiles`
- RPC: `get_daily_sales_report(report_date date)`

## Frontend Env

Set in `.env.local`:

- `VITE_SUPABASE_URL=<your-project-url>`
- `VITE_SUPABASE_ANON_KEY=<your-anon-key>`

## Run App

```bash
npm install
npm run dev
```

Notes:
- Current RLS policies are open (`for all using (true)`) for rapid deployment.
- Tighten RLS before production (per-user or per-role access).
