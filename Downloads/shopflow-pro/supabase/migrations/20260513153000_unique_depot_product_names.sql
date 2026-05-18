create unique index if not exists products_shop_name_unique
on public.products (shop_id, lower(trim(name)));