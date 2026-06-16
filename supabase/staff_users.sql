create extension if not exists pgcrypto;

-- Remove the auth.users sync trigger from the old email-based setup. The app
-- never creates Supabase Auth users, so this trigger and its helper
-- functions are dead weight left over from a previous approach.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.staff_role_from_email(text);
drop function if exists public.staff_username_from_email(text);

-- POS login is PIN-only (see authService.loginByPin): the app matches the
-- entered PIN against staff_users.pin_hash and signs in as that account.
-- There is no email/password/Supabase Auth flow involved.

create table if not exists public.staff_users (
  id           uuid        primary key default gen_random_uuid(),
  username     text        not null unique,
  pin_hash     text        not null,
  role         text        not null check (role in ('admin', 'cashier')),
  display_name text        not null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists idx_staff_users_username on public.staff_users(username);
create index  if not exists idx_staff_users_role         on public.staff_users(role);

-- RLS: allow the app (anon key) to read staff — required for PIN login.
-- All write operations must go through the Supabase Dashboard SQL editor
-- using the service_role key (bypasses RLS).
alter table public.staff_users enable row level security;

drop policy if exists staff_users_select on public.staff_users;
create policy staff_users_select on public.staff_users
  for select using (true);

-- No anon INSERT / UPDATE / DELETE policy — blocked by default under RLS.


-- ============================================================
--  STAFF MANAGEMENT — run these in the Supabase SQL Editor
-- ============================================================

-- ADD a new staff member (replace values as needed; PIN must be 6 digits):
--
-- INSERT INTO public.staff_users (username, pin_hash, role, display_name)
-- VALUES (
--   'jane',
--   encode(digest('123456', 'sha256'), 'hex'),
--   'cashier',   -- 'cashier' or 'admin'
--   'Jane Wanjiku'
-- )
-- ON CONFLICT (username) DO UPDATE SET
--   pin_hash     = excluded.pin_hash,
--   role         = excluded.role,
--   display_name = excluded.display_name,
--   is_active    = true,
--   updated_at   = now();


-- CHANGE a PIN (replace username and new 6-digit PIN):
--
-- UPDATE public.staff_users
-- SET pin_hash   = encode(digest('654321', 'sha256'), 'hex'),
--     updated_at = now()
-- WHERE username = 'jane';


-- DEACTIVATE a staff member (keeps the record; they cannot log in):
--
-- UPDATE public.staff_users
-- SET is_active  = false,
--     updated_at = now()
-- WHERE username = 'jane';


-- PERMANENTLY delete a staff member:
--
-- DELETE FROM public.staff_users WHERE username = 'jane';


-- VIEW all current staff:
--
-- SELECT id, username, display_name, role, is_active, created_at
-- FROM public.staff_users
-- ORDER BY created_at;
