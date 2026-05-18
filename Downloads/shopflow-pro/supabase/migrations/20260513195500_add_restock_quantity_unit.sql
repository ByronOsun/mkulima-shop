alter table public.stock_restock_orders
  add column if not exists quantity_unit text default 'bottle',
  add column if not exists quantity_unit_amount numeric(12,2);

update public.stock_restock_orders
set quantity_unit = 'bottle', quantity_unit_amount = quantity_requested
where quantity_unit is null;
