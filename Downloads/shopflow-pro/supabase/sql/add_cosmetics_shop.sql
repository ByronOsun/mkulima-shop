-- Cosmetics Shop seed for Supabase SQL editor
-- Run this in SQL editor, not the Node/Deno seed script.

insert into public.shops (name, slug, contact_info, accent) values
  ('Cosmetics Shop', 'cosmetics', 'Kisumu, Kenya · +254 700 000 333', 'rose')
on conflict (slug) do update set
  name = excluded.name,
  contact_info = excluded.contact_info,
  accent = excluded.accent;

do $$
declare
  cosmetics_shop_id uuid;
  cosmetics_user_id uuid;
begin
  select id into cosmetics_shop_id
  from public.shops
  where slug = 'cosmetics';

  if cosmetics_shop_id is null then
    raise exception 'Cosmetics shop not found';
  end if;

  select id into cosmetics_user_id
  from auth.users
  where email = 'abigliz001.cosmetics@gmail.com';

  if cosmetics_user_id is null then
    raise notice 'Auth user not found for abigliz001.cosmetics@gmail.com';
    return;
  end if;

  insert into public.profiles (id, email, full_name, shop_id)
  values (cosmetics_user_id, 'abigliz001.cosmetics@gmail.com', 'abigliz001', cosmetics_shop_id)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    shop_id = excluded.shop_id;

  insert into public.user_roles (user_id, role)
  values (cosmetics_user_id, 'employee')
  on conflict (user_id, role) do nothing;
end $$;
