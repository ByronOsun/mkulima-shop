-- Add abigliz001.cosmetics@gmail.com as an employee in Cosmetics Shop
-- Note: Auth user must exist in auth.users table (typically created via Supabase Admin API)
-- This migration creates the profile and role associations

-- Get the Cosmetics shop ID
with cosmetics_shop as (
  select id from public.shops where slug = 'cosmetics'
)
-- Upsert profile for the Cosmetics employee
-- You'll need to replace {USER_ID} with the actual UUID from auth.users
insert into public.profiles (id, email, full_name, shop_id)
values ('{USER_ID}', 'abigliz001.cosmetics@gmail.com', 'abigliz001.cosmetics', (select id from cosmetics_shop))
on conflict (id) do update set
  email = 'abigliz001.cosmetics@gmail.com',
  full_name = 'abigliz001.cosmetics',
  shop_id = (select id from (select id from public.shops where slug = 'cosmetics') as s);

-- Upsert the employee role
insert into public.user_roles (user_id, role)
values ('{USER_ID}', 'employee')
on conflict (user_id, role) do nothing;