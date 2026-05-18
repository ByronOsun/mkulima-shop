with ranked as (
  select
    id,
    shop_id,
    name,
    sku,
    stock_quantity,
    row_number() over (
      partition by shop_id, lower(trim(name))
      order by created_at asc, id asc
    ) as rn,
    sum(stock_quantity) over (
      partition by shop_id, lower(trim(name))
    ) as total_stock
  from public.products
  where shop_id in (select id from public.shops where slug = 'depot')
)
update public.products p
set stock_quantity = r.total_stock
from ranked r
where p.id = r.id
  and r.rn = 1;

with ranked as (
  select
    id,
    shop_id,
    name,
    sku,
    stock_quantity,
    row_number() over (
      partition by shop_id, lower(trim(name))
      order by created_at asc, id asc
    ) as rn
  from public.products
  where shop_id in (select id from public.shops where slug = 'depot')
)
delete from public.products p
using ranked r
where p.id = r.id
  and r.rn > 1;