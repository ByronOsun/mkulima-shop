-- Add Ogopa Shop (cosmetics, similar to Beauty Shop)
insert into public.shops (name, slug, contact_info, accent) values
  ('Ogopa Shop', 'ogopa', 'Kisumu, Kenya · +254 700 000 333', 'rose')
on conflict (slug) do update set
  name = 'Ogopa Shop',
  contact_info = 'Kisumu, Kenya · +254 700 000 333',
  accent = 'rose';
