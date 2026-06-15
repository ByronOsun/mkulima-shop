create extension if not exists pgcrypto;

-- Email-style staff accounts:
--   jane.cashier@gmail.com -> username: jane, role: cashier
--   john.admin@gmail.com   -> username: john, role: admin
--
-- This script is safe to run in Supabase SQL editor.
-- It replaces the auth.users trigger so dashboard-created users do not fail.

alter table if exists public.staff_users
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_staff_users_username on public.staff_users(username);
create unique index if not exists idx_staff_users_email on public.staff_users(email) where email is not null;
create index if not exists idx_staff_users_role on public.staff_users(role);

-- Backfill email for existing staff rows.
update public.staff_users
set email = case
  when email is not null then lower(trim(email))
  when username is not null and role is not null then lower(trim(username)) || '.' || lower(trim(role)) || '@gmail.com'
  else null
end
where email is null;

create or replace function public.staff_role_from_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when split_part(lower(coalesce(p_email, '')), '@', 1) like '%.admin' then 'admin'
    else 'cashier'
  end;
$$;

create or replace function public.staff_username_from_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(split_part(split_part(lower(coalesce(p_email, '')), '@', 1), '.', 1), '');
$$;

-- Replace the auth trigger function entirely so Supabase dashboard user creation works.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_username text := coalesce(
    public.staff_username_from_email(new.email),
    split_part(lower(coalesce(new.email, '')), '@', 1),
    new.id::text
  );
  v_role text := coalesce(
    nullif(lower(trim(new.raw_user_meta_data->>'role')), ''),
    public.staff_role_from_email(new.email),
    'cashier'
  );
  v_display_name text := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    initcap(replace(public.staff_username_from_email(new.email), '.', ' ')),
    initcap(replace(split_part(lower(coalesce(new.email, '')), '@', 1), '.', ' ')),
    initcap(replace(v_username, '.', ' '))
  );
begin
  -- Keep a lightweight profile record when the table exists.
  if to_regclass('public.profiles') is not null then
    begin
      insert into public.profiles (id, email, full_name, role, is_active)
      values (
        new.id,
        nullif(v_email, ''),
        v_display_name,
        case when v_role in ('admin', 'cashier', 'manager') then v_role else 'cashier' end,
        true
      )
      on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = true,
        updated_at = now();
    exception when others then
      raise notice 'profiles sync skipped: %', sqlerrm;
    end;
  end if;

  -- Create/update the POS staff account.
  -- pin_hash is set to Supabase's encrypted password when available.
  if to_regclass('public.staff_users') is not null then
    begin
      insert into public.staff_users (email, username, pin_hash, role, display_name, is_active)
      values (
        nullif(v_email, ''),
        v_username,
        coalesce(new.encrypted_password, encode(digest(coalesce(new.id::text, v_username), 'sha256'), 'hex')),
        case when v_role in ('admin', 'cashier') then v_role else 'cashier' end,
        v_display_name,
        true
      )
      on conflict (username) do update set
        email = excluded.email,
        pin_hash = excluded.pin_hash,
        role = excluded.role,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();
    exception when others then
      raise notice 'staff_users sync skipped: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Sample users using the requested format.
insert into public.staff_users (email, pin_hash, role, display_name)
values
  ('john.admin@gmail.com', encode(digest('123456', 'sha256'), 'hex'), 'admin', 'John'),
  ('jane.cashier@gmail.com', encode(digest('111111', 'sha256'), 'hex'), 'cashier', 'Jane'),
  ('mary.cashier@gmail.com', encode(digest('222222', 'sha256'), 'hex'), 'cashier', 'Mary')
on conflict (username) do update set
  email = excluded.email,
  pin_hash = excluded.pin_hash,
  role = excluded.role,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();
