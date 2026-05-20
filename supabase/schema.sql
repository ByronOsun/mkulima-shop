-- Mkulima Agrovet Farm POS - Supabase Backend Schema
-- Run in Supabase SQL Editor as project owner.

begin;

create extension if not exists pgcrypto;

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  sku text not null unique,
  description text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity_in_stock integer not null default 0 check (quantity_in_stock >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sales
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date timestamptz not null default now(),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'mobile_money', 'credit')),
  status text not null default 'completed' check (status in ('completed', 'pending', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sale items
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- Stock movement ledger
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity integer not null check (quantity > 0),
  reference text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Optional profile table for staff metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'cashier' check (role in ('admin', 'cashier', 'manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalize existing tables for projects that already had earlier schemas.
-- This prevents function creation errors when columns are missing.
alter table public.categories
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now();

alter table public.products
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists sku text,
  add column if not exists description text,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists quantity_in_stock integer not null default 0,
  add column if not exists reorder_level integer not null default 0,
  add column if not exists image_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.sales
  add column if not exists sale_date timestamptz not null default now(),
  add column if not exists total_amount numeric(12,2) not null default 0,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists status text not null default 'completed',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.sale_items
  add column if not exists quantity integer not null default 1,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.stock_movements
  add column if not exists movement_type text not null default 'adjustment',
  add column if not exists quantity integer not null default 1,
  add column if not exists reference text not null default 'migration',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text not null default 'cashier',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_products_name on public.products(name);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_sales_sale_date on public.sales(sale_date desc);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);
create index if not exists idx_stock_movements_product_id on public.stock_movements(product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at desc);
create unique index if not exists idx_products_sku_unique on public.products(sku);
create unique index if not exists idx_categories_name_unique on public.categories(name);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_unit_price_nonnegative'
  ) then
    alter table public.products
      add constraint products_unit_price_nonnegative check (unit_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_quantity_nonnegative'
  ) then
    alter table public.products
      add constraint products_quantity_nonnegative check (quantity_in_stock >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_reorder_nonnegative'
  ) then
    alter table public.products
      add constraint products_reorder_nonnegative check (reorder_level >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sales_total_nonnegative'
  ) then
    alter table public.sales
      add constraint sales_total_nonnegative check (total_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sale_items_quantity_positive'
  ) then
    alter table public.sale_items
      add constraint sale_items_quantity_positive check (quantity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sale_items_price_nonnegative'
  ) then
    alter table public.sale_items
      add constraint sale_items_price_nonnegative check (unit_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sale_items_subtotal_nonnegative'
  ) then
    alter table public.sale_items
      add constraint sale_items_subtotal_nonnegative check (subtotal >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stock_movements_quantity_positive'
  ) then
    alter table public.stock_movements
      add constraint stock_movements_quantity_positive check (quantity > 0);
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at
before update on public.sales
for each row
execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'cashier'),
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    is_active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.get_daily_sales_report(report_date date)
returns jsonb
language sql
stable
as $$
with day_sales as (
  select s.*
  from public.sales s
  where s.sale_date >= report_date::timestamptz
    and s.sale_date < (report_date::timestamptz + interval '1 day')
),
day_items as (
  select si.*, p.name as product_name, p.category, p.quantity_in_stock
  from public.sale_items si
  join day_sales ds on ds.id = si.sale_id
  join public.products p on p.id = si.product_id
),
payment_breakdown as (
  select jsonb_build_object(
    'cash', coalesce(sum(case when payment_method = 'cash' then total_amount end), 0),
    'card', coalesce(sum(case when payment_method = 'card' then total_amount end), 0),
    'mobile_money', coalesce(sum(case when payment_method = 'mobile_money' then total_amount end), 0),
    'credit', coalesce(sum(case when payment_method = 'credit' then total_amount end), 0)
  ) as value
  from day_sales
),
top_products as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.product_id,
        'name', x.product_name,
        'category', x.category,
        'sku', x.sku,
        'description', x.description,
        'unit_price', x.unit_price,
        'quantity_in_stock', x.quantity_in_stock,
        'reorder_level', x.reorder_level,
        'image_url', x.image_url,
        'created_at', x.created_at,
        'updated_at', x.updated_at
      )
      order by x.qty_sold desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      p.id as product_id,
      p.name as product_name,
      p.sku,
      p.description,
      p.category,
      p.unit_price,
      p.quantity_in_stock,
      p.reorder_level,
      p.image_url,
      p.created_at,
      p.updated_at,
      sum(si.quantity) as qty_sold
    from day_items si
    join public.products p on p.id = si.product_id
    group by p.id
    order by qty_sold desc
    limit 5
  ) x
)
select jsonb_build_object(
  'total_sales', coalesce((select count(*) from day_sales), 0),
  'total_revenue', coalesce((select sum(total_amount) from day_sales), 0),
  'transactions_count', coalesce((select count(*) from day_sales), 0),
  'payment_breakdown', (select value from payment_breakdown),
  'top_products', (select value from top_products)
);
$$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.profiles enable row level security;

-- Demo-friendly policies: allow anon + authenticated reads/writes.
-- Tighten these before production if needed.
drop policy if exists categories_all_access on public.categories;
create policy categories_all_access on public.categories
for all using (true) with check (true);

drop policy if exists products_all_access on public.products;
create policy products_all_access on public.products
for all using (true) with check (true);

drop policy if exists sales_all_access on public.sales;
create policy sales_all_access on public.sales
for all using (true) with check (true);

drop policy if exists sale_items_all_access on public.sale_items;
create policy sale_items_all_access on public.sale_items
for all using (true) with check (true);

drop policy if exists stock_movements_all_access on public.stock_movements;
create policy stock_movements_all_access on public.stock_movements
for all using (true) with check (true);

drop policy if exists profiles_all_access on public.profiles;
create policy profiles_all_access on public.profiles
for all using (true) with check (true);

commit;
