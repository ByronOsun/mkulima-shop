-- Create stock restock orders table for managing pending and confirmed restocks
create table public.stock_restock_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_requested numeric(12,2) not null check (quantity_requested > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

-- Add RLS
alter table public.stock_restock_orders enable row level security;

create policy "restock orders admin read" on public.stock_restock_orders for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "restock orders admin write" on public.stock_restock_orders for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));

create policy "restock orders admin update" on public.stock_restock_orders for update to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create policy "restock orders admin delete" on public.stock_restock_orders for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));
