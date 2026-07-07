-- M-Pesa Multi-Tenant Payment Schema
-- Run in Supabase SQL Editor AFTER schema.sql and multi_tenant.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tenant M-Pesa credentials ─────────────────────────────────────────────────
-- All sensitive fields are AES-256-GCM encrypted by the edge function before
-- storage. The plaintext NEVER touches the database layer.
CREATE TABLE IF NOT EXISTS public.tenant_mpesa_credentials (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shortcode                 text         NOT NULL,
  shortcode_type            text         NOT NULL CHECK (shortcode_type IN ('paybill', 'till')),
  -- Encrypted values: base64(iv || ciphertext) produced by AES-256-GCM
  consumer_key_encrypted    text         NOT NULL,
  consumer_secret_encrypted text         NOT NULL,
  passkey_encrypted         text         NOT NULL,
  environment               text         NOT NULL DEFAULT 'production'
                                         CHECK (environment IN ('sandbox', 'production')),
  -- For Paybill shortcodes: the account number that appears on the customer's
  -- phone and routes payment to the correct sub-account. Null for Till numbers.
  account_number            text,
  is_active                 boolean      NOT NULL DEFAULT true,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- ── M-Pesa transaction ledger ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id               uuid          REFERENCES public.sales(id) ON DELETE SET NULL,
  checkout_request_id   text,
  merchant_request_id   text,
  phone_number          text          NOT NULL,
  amount                numeric(12,2) NOT NULL,
  status                text          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','processing','completed','failed','cancelled','timeout')),
  mpesa_receipt_number  text,
  result_code           integer,
  result_description    text,
  callback_data         jsonb,
  initiated_at          timestamptz   NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── Credential access audit log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mpesa_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action      text        NOT NULL,
  actor_id    text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
-- Reuse the existing set_updated_at() function from schema.sql
DROP TRIGGER IF EXISTS trg_tenant_mpesa_creds_updated_at ON public.tenant_mpesa_credentials;
CREATE TRIGGER trg_tenant_mpesa_creds_updated_at
  BEFORE UPDATE ON public.tenant_mpesa_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mpesa_transactions_updated_at ON public.mpesa_transactions;
CREATE TRIGGER trg_mpesa_transactions_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mpesa_txn_checkout_req
  ON public.mpesa_transactions(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mpesa_txn_tenant   ON public.mpesa_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_txn_sale      ON public.mpesa_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_txn_status    ON public.mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_txn_created   ON public.mpesa_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_audit_tenant  ON public.mpesa_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_creds_tenant  ON public.tenant_mpesa_credentials(tenant_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.tenant_mpesa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_audit_log           ENABLE ROW LEVEL SECURITY;

-- Credentials: DENY all client access — edge functions use service_role key
DROP POLICY IF EXISTS mpesa_creds_deny_all ON public.tenant_mpesa_credentials;
CREATE POLICY mpesa_creds_deny_all ON public.tenant_mpesa_credentials
  FOR ALL USING (false);

-- Transactions: allow anon reads for realtime polling; deny all writes from client
DROP POLICY IF EXISTS mpesa_txn_read_all ON public.mpesa_transactions;
CREATE POLICY mpesa_txn_read_all ON public.mpesa_transactions
  FOR SELECT USING (true);

-- Audit log: service role only
DROP POLICY IF EXISTS mpesa_audit_deny_all ON public.mpesa_audit_log;
CREATE POLICY mpesa_audit_deny_all ON public.mpesa_audit_log
  FOR ALL USING (false);

-- ── Enable Realtime for transaction status polling ────────────────────────────
-- The frontend subscribes to mpesa_transactions changes to detect payment completion.
ALTER PUBLICATION supabase_realtime ADD TABLE public.mpesa_transactions;

COMMIT;
