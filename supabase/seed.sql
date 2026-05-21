-- Seed data for Mkulima Agrovet Farm POS
-- Run after schema.sql

begin;

do $$
declare
  products_has_shop_id boolean := false;
  categories_has_shop_id boolean := false;
  products_has_price boolean := false;
  default_shop_id uuid := null;
  rows_updated integer := 0;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'shop_id'
  ) into products_has_shop_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'shop_id'
  ) into categories_has_shop_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'price'
  ) into products_has_price;

  if products_has_shop_id or categories_has_shop_id then
    if to_regclass('public.shops') is not null then
      execute 'select id from public.shops order by created_at asc limit 1' into default_shop_id;
      if default_shop_id is null then
        execute 'select id from public.shops limit 1' into default_shop_id;
      end if;
    end if;

    if default_shop_id is null and products_has_shop_id then
      execute 'select shop_id from public.products where shop_id is not null limit 1' into default_shop_id;
    end if;

    if default_shop_id is null and categories_has_shop_id then
      execute 'select shop_id from public.categories where shop_id is not null limit 1' into default_shop_id;
    end if;

    if default_shop_id is null then
      raise exception using message =
        'Seed aborted: schema requires shop_id but no shop is available. Insert one row into public.shops (or existing products/categories with shop_id) then rerun seed.sql.';
    end if;
  end if;

  -- Categories: update first, insert if missing (no dependency on unique index/constraint).
  if categories_has_shop_id then
    update public.categories c
    set description = v.description
    from (
      values
        ('Feeds'::text, 'Animal feed and nutrition'::text),
        ('Animal Health'::text, 'Veterinary medicines and supplements'::text),
        ('Seeds & Inputs'::text, 'Seeds, fertilizers, and crop inputs'::text),
        ('Tools'::text, 'Farm tools and equipment'::text)
    ) as v(name, description)
    where c.shop_id = default_shop_id
      and c.name = v.name;

    insert into public.categories (shop_id, name, description)
    select default_shop_id, v.name, v.description
    from (
      values
        ('Feeds'::text, 'Animal feed and nutrition'::text),
        ('Animal Health'::text, 'Veterinary medicines and supplements'::text),
        ('Seeds & Inputs'::text, 'Seeds, fertilizers, and crop inputs'::text),
        ('Tools'::text, 'Farm tools and equipment'::text)
    ) as v(name, description)
    where not exists (
      select 1 from public.categories c
      where c.shop_id = default_shop_id
        and c.name = v.name
    );
  else
    update public.categories c
    set description = v.description
    from (
      values
        ('Feeds'::text, 'Animal feed and nutrition'::text),
        ('Animal Health'::text, 'Veterinary medicines and supplements'::text),
        ('Seeds & Inputs'::text, 'Seeds, fertilizers, and crop inputs'::text),
        ('Tools'::text, 'Farm tools and equipment'::text)
    ) as v(name, description)
    where c.name = v.name;

    insert into public.categories (name, description)
    select v.name, v.description
    from (
      values
        ('Feeds'::text, 'Animal feed and nutrition'::text),
        ('Animal Health'::text, 'Veterinary medicines and supplements'::text),
        ('Seeds & Inputs'::text, 'Seeds, fertilizers, and crop inputs'::text),
        ('Tools'::text, 'Farm tools and equipment'::text)
    ) as v(name, description)
    where not exists (
      select 1 from public.categories c
      where c.name = v.name
    );
  end if;

  -- Products: update by SKU first, insert missing rows.
  if products_has_shop_id then
    update public.products p
    set
      name = v.name,
      category = v.category,
      description = v.description,
      unit_price = v.unit_price,
      quantity_in_stock = v.quantity_in_stock,
      reorder_level = v.reorder_level,
      image_url = v.image_url,
      updated_at = now()
    from (
      values
        ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
        ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
        ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
        ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
        ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
    ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
    where p.shop_id = default_shop_id
      and p.sku = v.sku;

    if products_has_price then
      update public.products p
      set price = v.unit_price
      from (
        values
          ('FEE-001'::text, 3200::numeric),
          ('FEE-002'::text, 4100::numeric),
          ('HLT-101'::text, 950::numeric),
          ('SEED-210'::text, 1800::numeric),
          ('TL-450'::text, 1250::numeric)
      ) as v(sku, unit_price)
      where p.shop_id = default_shop_id
        and p.sku = v.sku;
    end if;

    if products_has_price then
      insert into public.products (
        shop_id,
        name,
        category,
        sku,
        description,
        price,
        unit_price,
        quantity_in_stock,
        reorder_level,
        image_url
      )
      select
        default_shop_id,
        v.name,
        v.category,
        v.sku,
        v.description,
        v.unit_price,
        v.unit_price,
        v.quantity_in_stock,
        v.reorder_level,
        v.image_url
      from (
        values
          ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
          ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
          ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
          ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
          ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
      ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
      where not exists (
        select 1
        from public.products p
        where p.shop_id = default_shop_id
          and p.sku = v.sku
      );
    else
      insert into public.products (
        shop_id,
        name,
        category,
        sku,
        description,
        unit_price,
        quantity_in_stock,
        reorder_level,
        image_url
      )
      select
        default_shop_id,
        v.name,
        v.category,
        v.sku,
        v.description,
        v.unit_price,
        v.quantity_in_stock,
        v.reorder_level,
        v.image_url
      from (
        values
          ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
          ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
          ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
          ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
          ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
      ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
      where not exists (
        select 1
        from public.products p
        where p.shop_id = default_shop_id
          and p.sku = v.sku
      );
    end if;
  else
    update public.products p
    set
      name = v.name,
      category = v.category,
      description = v.description,
      unit_price = v.unit_price,
      quantity_in_stock = v.quantity_in_stock,
      reorder_level = v.reorder_level,
      image_url = v.image_url,
      updated_at = now()
    from (
      values
        ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
        ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
        ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
        ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
        ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
    ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
    where p.sku = v.sku;

    if products_has_price then
      update public.products p
      set price = v.unit_price
      from (
        values
          ('FEE-001'::text, 3200::numeric),
          ('FEE-002'::text, 4100::numeric),
          ('HLT-101'::text, 950::numeric),
          ('SEED-210'::text, 1800::numeric),
          ('TL-450'::text, 1250::numeric)
      ) as v(sku, unit_price)
      where p.sku = v.sku;
    end if;

    if products_has_price then
      insert into public.products (
        name,
        category,
        sku,
        description,
        price,
        unit_price,
        quantity_in_stock,
        reorder_level,
        image_url
      )
      select
        v.name,
        v.category,
        v.sku,
        v.description,
        v.unit_price,
        v.unit_price,
        v.quantity_in_stock,
        v.reorder_level,
        v.image_url
      from (
        values
          ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
          ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
          ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
          ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
          ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
      ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
      where not exists (
        select 1
        from public.products p
        where p.sku = v.sku
      );
    else
      insert into public.products (
        name,
        category,
        sku,
        description,
        unit_price,
        quantity_in_stock,
        reorder_level,
        image_url
      )
      select
        v.name,
        v.category,
        v.sku,
        v.description,
        v.unit_price,
        v.quantity_in_stock,
        v.reorder_level,
        v.image_url
      from (
        values
          ('FEE-001'::text, 'Dairy Meal 50kg'::text, 'Feeds'::text, 'High-energy dairy feed for milk production'::text, 3200::numeric, 24::int, 8::int, null::text),
          ('FEE-002'::text, 'Broiler Starter 50kg'::text, 'Feeds'::text, 'Starter mash for poultry broilers'::text, 4100::numeric, 17::int, 6::int, null::text),
          ('HLT-101'::text, 'Acaricide Spray 1L'::text, 'Animal Health'::text, 'Tick and mite control spray'::text, 950::numeric, 32::int, 12::int, null::text),
          ('SEED-210'::text, 'Maize Seed 10kg'::text, 'Seeds & Inputs'::text, 'Certified maize seed for planting'::text, 1800::numeric, 28::int, 10::int, null::text),
          ('TL-450'::text, 'Jembe Hoe'::text, 'Tools'::text, 'Heavy-duty digging hoe'::text, 1250::numeric, 9::int, 4::int, null::text)
      ) as v(sku, name, category, description, unit_price, quantity_in_stock, reorder_level, image_url)
      where not exists (
        select 1
        from public.products p
        where p.sku = v.sku
      );
    end if;
  end if;
end $$;

-- Staff login users for the POS app.
create extension if not exists pgcrypto;

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  pin_hash text not null,
  role text not null check (role in ('admin', 'cashier')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_users_username on public.staff_users(username);
create index if not exists idx_staff_users_role on public.staff_users(role);

insert into public.staff_users (username, pin_hash, role, display_name)
values
  ('admin', encode(digest('123456', 'sha256'), 'hex'), 'admin', 'Administrator'),
  ('john.wakulima', encode(digest('111111', 'sha256'), 'hex'), 'cashier', 'John Wakulima'),
  ('mary.kipchoge', encode(digest('222222', 'sha256'), 'hex'), 'cashier', 'Mary Kipchoge')
on conflict (username) do update set
  pin_hash = excluded.pin_hash,
  role = excluded.role,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();

commit;
