-- SQL-only seed for all shops
-- Run this in the Supabase SQL editor.

-- Shops
insert into public.shops (name, slug, contact_info, accent) values
  ('Beauty Shop', 'beauty', 'Kisumu, Kenya · +254 700 000 111', 'rose'),
  ('Depot Shop', 'depot', 'Kisumu, Kenya · +254 700 000 222', 'red'),
  ('Ogopa Shop', 'ogopa', 'Kisumu, Kenya · +254 700 000 333', 'rose'),
  ('Cosmetics Shop', 'cosmetics', 'Kisumu, Kenya · +254 700 000 333', 'rose')
on conflict (slug) do update set
  name = excluded.name,
  contact_info = excluded.contact_info,
  accent = excluded.accent;

-- Beauty employee
DO $$
DECLARE
  v_shop_id uuid;
  v_user_id uuid;
BEGIN
  select id into v_shop_id from public.shops where slug = 'beauty';
  select id into v_user_id from auth.users where email = 'abigliz001.beauty@gmail.com';

  if v_shop_id is null then
    raise exception 'Beauty shop not found';
  end if;

  if v_user_id is null then
    raise notice 'Auth user not found for abigliz001.beauty@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (v_user_id, 'abigliz001.beauty@gmail.com', 'abigliz001', v_shop_id)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'employee')
  on conflict (user_id, role) do nothing;
END $$;

-- Depot employee
DO $$
DECLARE
  v_shop_id uuid;
  v_user_id uuid;
BEGIN
  select id into v_shop_id from public.shops where slug = 'depot';
  select id into v_user_id from auth.users where email = 'abigliz001.depot@gmail.com';

  if v_shop_id is null then
    raise exception 'Depot shop not found';
  end if;

  if v_user_id is null then
    raise notice 'Auth user not found for abigliz001.depot@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (v_user_id, 'abigliz001.depot@gmail.com', 'abigliz001', v_shop_id)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'employee')
  on conflict (user_id, role) do nothing;
END $$;

-- Ogopa employee
DO $$
DECLARE
  v_shop_id uuid;
  v_user_id uuid;
BEGIN
  select id into v_shop_id from public.shops where slug = 'ogopa';
  select id into v_user_id from auth.users where email = 'abigliz001.ogopa@gmail.com';

  if v_shop_id is null then
    raise exception 'Ogopa shop not found';
  end if;

  if v_user_id is null then
    raise notice 'Auth user not found for abigliz001.ogopa@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (v_user_id, 'abigliz001.ogopa@gmail.com', 'abigliz001', v_shop_id)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'employee')
  on conflict (user_id, role) do nothing;
END $$;

-- Cosmetics employee
DO $$
DECLARE
  v_shop_id uuid;
  v_user_id uuid;
BEGIN
  select id into v_shop_id from public.shops where slug = 'cosmetics';
  select id into v_user_id from auth.users where email = 'abigliz001.cosmetics@gmail.com';

  if v_shop_id is null then
    raise exception 'Cosmetics shop not found';
  end if;

  if v_user_id is null then
    raise notice 'Auth user not found for abigliz001.cosmetics@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (v_user_id, 'abigliz001.cosmetics@gmail.com', 'abigliz001', v_shop_id)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'employee')
  on conflict (user_id, role) do nothing;
END $$;

-- Admin user (same admin for all shops)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  select id into v_user_id from auth.users where email = 'abigliz001@gmail.com';

  if v_user_id is null then
    raise notice 'Auth user not found for abigliz001@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (v_user_id, 'abigliz001@gmail.com', 'abigliz001', null)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;
END $$;

-- Beauty products
insert into public.products (shop_id, name, sku, price, stock_quantity, category)
select s.id, p.name, p.sku, p.price, p.stock_quantity, p.category
from public.shops s
join (values
  ('Matte Lipstick - Ruby', 'BTY-LIP-001', 850, 24, 'Lips'),
  ('Liquid Foundation - Beige', 'BTY-FND-002', 1850, 12, 'Face'),
  ('Volume Mascara', 'BTY-MSC-003', 1200, 18, 'Eyes'),
  ('Rose Blush Compact', 'BTY-BLS-004', 950, 8, 'Face'),
  ('Nail Polish - Coral', 'BTY-NAL-005', 450, 30, 'Nails')
) as p(name, sku, price, stock_quantity, category) on true
where s.slug = 'beauty'
on conflict (shop_id, sku) do update set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  category = excluded.category;

-- Ogopa products
insert into public.products (shop_id, name, sku, price, stock_quantity, category)
select s.id, p.name, p.sku, p.price, p.stock_quantity, p.category
from public.shops s
join (values
  ('Matte Lipstick - Ruby', 'OGO-LIP-001', 850, 24, 'Lips'),
  ('Liquid Foundation - Beige', 'OGO-FND-002', 1850, 12, 'Face'),
  ('Volume Mascara', 'OGO-MSC-003', 1200, 18, 'Eyes'),
  ('Rose Blush Compact', 'OGO-BLS-004', 950, 8, 'Face'),
  ('Nail Polish - Coral', 'OGO-NAL-005', 450, 30, 'Nails')
) as p(name, sku, price, stock_quantity, category) on true
where s.slug = 'ogopa'
on conflict (shop_id, sku) do update set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  category = excluded.category;

-- Cosmetics products
insert into public.products (shop_id, name, sku, price, stock_quantity, category)
select s.id, p.name, p.sku, p.price, p.stock_quantity, p.category
from public.shops s
join (values
  ('Matte Lipstick - Ruby', 'CSG-LIP-001', 850, 24, 'Lips'),
  ('Liquid Foundation - Beige', 'CSG-FND-002', 1850, 12, 'Face'),
  ('Volume Mascara', 'CSG-MSC-003', 1200, 18, 'Eyes'),
  ('Rose Blush Compact', 'CSG-BLS-004', 950, 8, 'Face'),
  ('Nail Polish - Coral', 'CSG-NAL-005', 450, 30, 'Nails')
) as p(name, sku, price, stock_quantity, category) on true
where s.slug = 'cosmetics'
on conflict (shop_id, sku) do update set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  category = excluded.category;

-- Depot products
insert into public.products (shop_id, name, sku, price, stock_quantity, category)
select s.id, p.name, p.sku, p.price, p.stock_quantity, p.category
from public.shops s
join (values
  ('Coca-Cola 500ml', 'DEP-COK-001', 60, 120, 'Soda'),
  ('Fanta Orange 500ml', 'DEP-FNT-002', 60, 96, 'Soda'),
  ('Sprite 500ml', 'DEP-SPR-003', 60, 84, 'Soda'),
  ('Dasani Water 1L', 'DEP-WTR-004', 80, 60, 'Water'),
  ('Minute Maid Tropical 400ml', 'DEP-JCE-005', 95, 7, 'Juice'),
  ('Minute Maid Mango 400ml', 'DEP-JCE-006', 95, 7, 'Juice'),
  ('Minute Maid Apple 400ml', 'DEP-JCE-007', 95, 7, 'Juice'),
  ('Quencher Mineral Water 400ml', 'DEP-WTR-008', 50, 24, 'Water'),
  ('Novida Soft Drink 400ml', 'DEP-SFT-009', 50, 24, 'Soft Drink'),
  ('Predator Soft Drink 400ml', 'DEP-SFT-010', 50, 24, 'Soft Drink'),
  ('Charged 400ml', 'DEP-ENG-011', 60, 24, 'Energy Drink'),
  ('Lemonade 400ml', 'DEP-SFT-012', 50, 24, 'Soft Drink'),
  ('Power Play 400ml', 'DEP-ENG-013', 60, 24, 'Energy Drink'),
  ('Bravado 400ml', 'DEP-ENG-014', 60, 24, 'Energy Drink'),
  ('Planet Mineral Water 400ml', 'DEP-WTR-015', 50, 24, 'Water')
) as p(name, sku, price, stock_quantity, category) on true
where s.slug = 'depot'
on conflict (shop_id, sku) do update set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  category = excluded.category;
