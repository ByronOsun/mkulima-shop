-- Multi-tenancy migration for VIZIA POS
-- Run this in the Supabase SQL editor against your project.

-- 1. Tenants table — one row per shop / organisation
CREATE TABLE IF NOT EXISTS public.tenants (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name    text         NOT NULL,
  address      text,
  phone        text,
  header_text  text,
  footer_text  text,
  is_active    boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- 2. Expand staff_users role constraint and add tenant_id
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.staff_users
  DROP CONSTRAINT IF EXISTS staff_users_role_check;

ALTER TABLE public.staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('admin', 'cashier', 'super_admin'));

-- 3. Add tenant_id to data tables
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
