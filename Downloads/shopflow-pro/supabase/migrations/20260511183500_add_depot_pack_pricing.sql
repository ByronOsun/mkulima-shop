alter table public.products
	add column if not exists pack_size int check (pack_size is null or pack_size > 0),
	add column if not exists price_retail_crate numeric(12,2) check (price_retail_crate is null or price_retail_crate >= 0),
	add column if not exists price_wholesale_crate numeric(12,2) check (price_wholesale_crate is null or price_wholesale_crate >= 0);

update public.products
set pack_size = 24
where pack_size is null;
