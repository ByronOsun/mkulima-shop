-- Add Cosmetics Shop (synonymous to Ogopa Shop)
insert into public.shops (name, slug, contact_info, accent) values
  ('Cosmetics Shop', 'cosmetics', 'Kisumu, Kenya · +254 700 000 333', 'rose')
on conflict (slug) do update set
  name = 'Cosmetics Shop',
  contact_info = 'Kisumu, Kenya · +254 700 000 333',
  accent = 'rose';