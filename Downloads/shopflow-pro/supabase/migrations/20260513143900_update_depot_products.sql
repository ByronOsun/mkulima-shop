insert into public.products (shop_id, name, sku, price, stock_quantity, category, low_stock_threshold)
select
  s.id,
  v.name,
  v.sku,
  v.price,
  v.stock_quantity,
  v.category,
  10
from public.shops s
cross join (
  values
    ('Coca-Cola 500ml', 'DEP-COK-001', 60::numeric, 120, 'Soda'),
    ('Fanta Orange 500ml', 'DEP-FNT-002', 60::numeric, 96, 'Soda'),
    ('Sprite 500ml', 'DEP-SPR-003', 60::numeric, 84, 'Soda'),
    ('Dasani Water 1L', 'DEP-WTR-004', 80::numeric, 60, 'Water'),
    ('Minute Maid Tropical 400ml', 'DEP-JCE-005', 95::numeric, 7, 'Juice'),
    ('Minute Maid Mango 400ml', 'DEP-JCE-006', 95::numeric, 7, 'Juice'),
    ('Minute Maid Apple 400ml', 'DEP-JCE-007', 95::numeric, 7, 'Juice'),
    ('Quencher Mineral Water 400ml', 'DEP-WTR-008', 50::numeric, 24, 'Water'),
    ('Novida Soft Drink 400ml', 'DEP-SFT-009', 50::numeric, 24, 'Soft Drink'),
    ('Predator Soft Drink 400ml', 'DEP-SFT-010', 50::numeric, 24, 'Soft Drink'),
    ('Charged 400ml', 'DEP-ENG-011', 60::numeric, 24, 'Energy Drink'),
    ('Lemonade 400ml', 'DEP-SFT-012', 50::numeric, 24, 'Soft Drink'),
    ('Power Play 400ml', 'DEP-ENG-013', 60::numeric, 24, 'Energy Drink'),
    ('Bravado 400ml', 'DEP-ENG-014', 60::numeric, 24, 'Energy Drink'),
    ('Planet Mineral Water 400ml', 'DEP-WTR-015', 50::numeric, 24, 'Water')
) as v(name, sku, price, stock_quantity, category)
where s.slug = 'depot'
on conflict (shop_id, sku) do update
set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  category = excluded.category,
  low_stock_threshold = excluded.low_stock_threshold;