
-- Roles enum and user_roles table (per security best practices)
create type public.app_role as enum ('admin', 'employee');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_info text,
  accent text not null default 'rose',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  shop_id uuid references public.shops(id) on delete set null,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sku text not null,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  category text,
  low_stock_threshold int not null default 10,
  created_at timestamptz not null default now(),
  unique (shop_id, sku)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete set null,
  total_amount numeric(12,2) not null,
  payment_mode text not null check (payment_mode in ('cash','atm','mpesa')),
  ref_id text,
  customer_name text,
  customer_phone text,
  created_at timestamptz not null default now()
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  sku_snapshot text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references auth.users(id) on delete set null,
  shop_id uuid references public.shops(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Security definer helper functions
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.current_shop_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

-- RLS
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.broadcasts enable row level security;

-- shops: everyone authenticated can read; admin writes
create policy "shops read" on public.shops for select to authenticated using (true);
create policy "shops admin write" on public.shops for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- profiles: users see own; admin sees all; admin manages
create policy "profiles self select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles admin write" on public.profiles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_roles: admin only
create policy "user_roles admin" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "user_roles self read" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- products: employee sees own shop; admin sees all; admin writes
create policy "products read" on public.products for select to authenticated
  using (public.has_role(auth.uid(),'admin') or shop_id = public.current_shop_id());
create policy "products admin write" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- transactions: employee sees own shop; admin sees all
create policy "transactions read" on public.transactions for select to authenticated
  using (public.has_role(auth.uid(),'admin') or shop_id = public.current_shop_id());
create policy "transactions employee insert" on public.transactions for insert to authenticated
  with check (employee_id = auth.uid() and shop_id = public.current_shop_id());

-- transaction_items: read alongside transactions
create policy "txn_items read" on public.transaction_items for select to authenticated
  using (exists(select 1 from public.transactions t where t.id = transaction_id
    and (public.has_role(auth.uid(),'admin') or t.shop_id = public.current_shop_id())));
create policy "txn_items employee insert" on public.transaction_items for insert to authenticated
  with check (exists(select 1 from public.transactions t where t.id = transaction_id and t.employee_id = auth.uid()));

-- activity_logs: employees insert own, read own shop; admin reads all
create policy "logs read" on public.activity_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin') or shop_id = public.current_shop_id());
create policy "logs insert" on public.activity_logs for insert to authenticated
  with check (employee_id = auth.uid());

-- broadcasts: read by shop members or admin; admin writes
create policy "broadcasts read" on public.broadcasts for select to authenticated
  using (public.has_role(auth.uid(),'admin') or shop_id = public.current_shop_id() or shop_id is null);
create policy "broadcasts admin write" on public.broadcasts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Atomic checkout RPC: validates stock, decrements, inserts txn + items, logs activity
create or replace function public.create_sale(
  _payment_mode text,
  _ref_id text,
  _customer_name text,
  _customer_phone text,
  _items jsonb -- [{product_id, quantity}]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _shop uuid;
  _txn uuid;
  _total numeric := 0;
  _item jsonb;
  _prod public.products%rowtype;
  _qty int;
  _line_total numeric;
begin
  _shop := public.current_shop_id();
  if _shop is null then raise exception 'No shop assigned'; end if;
  if _payment_mode not in ('cash','atm','mpesa') then raise exception 'Invalid payment mode'; end if;

  insert into public.transactions(shop_id, employee_id, total_amount, payment_mode, ref_id, customer_name, customer_phone)
  values (_shop, auth.uid(), 0, _payment_mode, _ref_id, _customer_name, _customer_phone)
  returning id into _txn;

  for _item in select * from jsonb_array_elements(_items)
  loop
    _qty := (_item->>'quantity')::int;
    select * into _prod from public.products where id = (_item->>'product_id')::uuid for update;
    if not found then raise exception 'Product not found'; end if;
    if _prod.shop_id <> _shop then raise exception 'Product not in your shop'; end if;
    if _prod.stock_quantity < _qty then raise exception 'Insufficient stock for %', _prod.name; end if;

    _line_total := _prod.price * _qty;
    _total := _total + _line_total;

    update public.products set stock_quantity = stock_quantity - _qty where id = _prod.id;
    insert into public.transaction_items(transaction_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, total)
    values (_txn, _prod.id, _prod.name, _prod.sku, _qty, _prod.price, _line_total);
  end loop;

  update public.transactions set total_amount = _total where id = _txn;

  insert into public.activity_logs(employee_id, shop_id, action, details)
  values (auth.uid(), _shop, 'sale', jsonb_build_object('transaction_id', _txn, 'total', _total, 'items', jsonb_array_length(_items)));

  return _txn;
end;
$$;

-- Profile auto-create trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable realtime
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.activity_logs;
alter publication supabase_realtime add table public.broadcasts;

-- Seed the two shops
insert into public.shops (name, slug, contact_info, accent) values
  ('Beauty Shop','beauty','Kisumu, Kenya · +254 700 000 111','rose'),
  ('Depot Shop','depot','Kisumu, Kenya · +254 700 000 222','red');
