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
--
-- This is the only SQL that should be used to add or update staff users.
-- To add/change a user, edit the values below and re-run this script.
--
-- PINs must be unique across active staff (PIN-only login matches on the
-- first hash that verifies).

create unique index if not exists idx_staff_users_username on public.staff_users(username);
create index if not exists idx_staff_users_role on public.staff_users(role);

insert into public.staff_users (username, pin_hash, role, display_name)
values
  ('john', encode(digest('123466', 'sha256'), 'hex'), 'admin', 'ADMIN'),
  ('don', encode(digest('111141', 'sha256'), 'hex'), 'cashier', 'don'),
  ('mary', encode(digest('222242', 'sha256'), 'hex'), 'cashier', 'Martha'),
  ('byron', encode(digest('255426', 'sha256'), 'hex'), 'cashier', 'Byron')
on conflict (username) do update set
  pin_hash = excluded.pin_hash,
  role = excluded.role,
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();
