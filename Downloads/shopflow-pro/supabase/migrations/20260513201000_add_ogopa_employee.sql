-- Add abigliz001.ogopa@gmail.com as an employee in Ogopa Shop
-- Note: Auth user must exist in auth.users table (typically created via Supabase Admin API)
-- This migration creates the profile and role associations

-- Get the Ogopa shop ID
with ogopa_shop as (
  select id from public.shops where slug = 'ogopa'
)
-- Upsert profile for the Ogopa employee
-- You'll need to replace {USER_ID} with the actual UUID from auth.users
insert into public.profiles (id, email, full_name, shop_id)
values ('{USER_ID}', 'abigliz001.ogopa@gmail.com', 'abigliz001.ogopa', (select id from ogopa_shop))
on conflict (id) do update set
  email = 'abigliz001.ogopa@gmail.com',
  full_name = 'abigliz001.ogopa',
  shop_id = (select id from (select id from public.shops where slug = 'ogopa') as s);

-- Upsert the employee role
insert into public.user_roles (user_id, role)
values ('{USER_ID}', 'employee')
on conflict (user_id, role) do nothing;
