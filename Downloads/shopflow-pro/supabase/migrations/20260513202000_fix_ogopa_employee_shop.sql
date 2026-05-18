-- Fix: Assign abigliz001.ogopa@gmail.com profile to Ogopa Shop
update public.profiles
set shop_id = (select id from public.shops where slug = 'ogopa')
where email = 'abigliz001.ogopa@gmail.com'
  and shop_id is null;
