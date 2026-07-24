-- Credit payments ledger for Mkulima Agrovet POS.
--
-- This captures schema that had only ever been applied by hand directly
-- against the live Supabase project (credit_payments table, sales.amount_paid
-- and related columns, and the trigger that keeps a sale's balance/status in
-- sync as installments come in). None of it was version-controlled, so a
-- fresh environment provisioned from schema.sql alone would silently be
-- missing it. Every statement below is idempotent and safe to re-run against
-- a database that already has this schema by hand.
--
-- Run in Supabase SQL Editor as project owner.

begin;

-- Columns on `sales` used by credit sale tracking.
alter table public.sales
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists customer_name text,
  add column if not exists customer_contact text,
  add column if not exists payment_channel text,
  add column if not exists cashier_name text,
  add column if not exists cashier_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_amount_paid_nonnegative'
  ) then
    alter table public.sales
      add constraint sales_amount_paid_nonnegative check (amount_paid >= 0);
  end if;
end $$;

-- Credit payments ledger — one row per installment paid against a credit sale.
create table if not exists public.credit_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'mobile_money')),
  payment_channel text,
  paid_by text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_payments_sale_id on public.credit_payments(sale_id);
create index if not exists idx_credit_payments_created_at on public.credit_payments(created_at desc);

-- Keep sales.amount_paid/status in sync whenever a payment is recorded.
--
-- Deliberately recomputes amount_paid as SUM(credit_payments.amount) rather
-- than incrementing sales.amount_paid by NEW.amount: this makes the trigger
-- idempotent/self-healing if it ever fires alongside another
-- already-applied trigger doing the same job under a different name (a real
-- possibility here, since this schema previously existed only by hand) —
-- recomputing from the ledger converges to the correct total either way,
-- whereas incrementing would double-count.
create or replace function public.handle_credit_payment()
returns trigger
language plpgsql
as $$
declare
  v_total numeric(12,2);
  v_paid numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_paid
  from public.credit_payments
  where sale_id = new.sale_id;

  select total_amount into v_total
  from public.sales
  where id = new.sale_id;

  update public.sales
  set amount_paid = v_paid,
      status = case when v_total is not null and v_paid >= v_total then 'completed' else 'pending' end,
      updated_at = now()
  where id = new.sale_id;

  return new;
end;
$$;

drop trigger if exists trg_credit_payments_apply on public.credit_payments;
create trigger trg_credit_payments_apply
after insert on public.credit_payments
for each row
execute function public.handle_credit_payment();

alter table public.credit_payments enable row level security;

drop policy if exists credit_payments_all_access on public.credit_payments;
create policy credit_payments_all_access on public.credit_payments
for all using (true) with check (true);

commit;
