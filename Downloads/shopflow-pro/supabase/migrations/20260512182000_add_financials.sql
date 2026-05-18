create table public.shop_financial_periods (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shop_id, period_start, period_end)
);

create table public.shop_financial_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  period_id uuid not null references public.shop_financial_periods(id) on delete cascade,
  entry_type text not null check (entry_type in ('expense','investment')),
  title text not null,
  category text,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.shop_financial_periods enable row level security;
alter table public.shop_financial_entries enable row level security;

create policy "financial periods admin read" on public.shop_financial_periods for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "financial periods admin write" on public.shop_financial_periods for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "financial entries admin read" on public.shop_financial_entries for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "financial entries admin write" on public.shop_financial_entries for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
