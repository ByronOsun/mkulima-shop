// Frontend service layer for M-Pesa Daraja integration.
// All sensitive work (credential decryption, token generation) happens
// in Supabase Edge Functions — this module only orchestrates the calls.

import { supabase } from './supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function edgeFetch(path: string, init?: RequestInit) {
  return fetch(`${FUNCTIONS_URL}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...(init?.headers ?? {}),
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MpesaTransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface MpesaTransaction {
  id: string;
  tenant_id: string;
  sale_id: string | null;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  phone_number: string;
  amount: number;
  status: MpesaTransactionStatus;
  mpesa_receipt_number: string | null;
  result_code: number | null;
  result_description: string | null;
  initiated_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StkPushParams {
  tenant_id: string;
  sale_id?: string;
  amount: number;
  phone: string;
  description?: string;
}

export interface StkPushResult {
  success: boolean;
  checkout_request_id?: string;
  merchant_request_id?: string;
  transaction_id?: string;
  customer_message?: string;
  error?: string;
}

export interface MpesaCredentials {
  shortcode: string;
  shortcode_type: 'paybill' | 'till';
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
  /** Required for Paybill: the account number shown on the customer's phone
   *  that routes payment to the correct sub-account. Not used for Till. */
  account_number?: string;
}

export interface MpesaCredentialStatus {
  configured: boolean;
  shortcode?: string;
  shortcode_type?: 'paybill' | 'till';
  environment?: 'sandbox' | 'production';
  account_number?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const mpesaService = {
  /** Initiate an STK Push for a tenant using their own Daraja credentials. */
  async initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
    const resp = await edgeFetch('mpesa-stkpush', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const json = await resp.json();
    if (!resp.ok) return { success: false, error: json.error ?? 'STK Push failed' };
    return json as StkPushResult;
  },

  /** Poll the local DB (fast path) for a transaction's current status. */
  async getTransactionStatus(checkoutRequestId: string): Promise<MpesaTransaction | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();
    return data as MpesaTransaction | null;
  },

  /**
   * Subscribe to real-time status changes for a specific transaction.
   * The callback fires whenever the row is updated in mpesa_transactions.
   */
  subscribeToTransaction(
    checkoutRequestId: string,
    onUpdate: (tx: MpesaTransaction) => void,
  ) {
    if (!supabase) return null;
    return supabase
      .channel(`mpesa-txn-${checkoutRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mpesa_transactions',
          filter: `checkout_request_id=eq.${checkoutRequestId}`,
        },
        (payload) => onUpdate(payload.new as MpesaTransaction),
      )
      .subscribe();
  },

  /** Cancel a realtime subscription. */
  unsubscribe(channel: unknown) {
    if (channel && supabase) supabase.removeChannel(channel as ReturnType<typeof supabase.channel>);
  },

  /** Query Daraja via the edge function for a still-processing transaction. */
  async queryStatus(checkoutRequestId: string): Promise<{ status: MpesaTransactionStatus; mpesa_receipt_number?: string; result_description?: string }> {
    const resp = await edgeFetch(`mpesa-status?checkout_request_id=${encodeURIComponent(checkoutRequestId)}`);
    const json = await resp.json();
    return json;
  },

  /** Save or update the M-Pesa Daraja credentials for a tenant (admin only). */
  async saveCredentials(
    tenantId: string,
    creds: MpesaCredentials,
    actorId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const resp = await edgeFetch('mpesa-credentials', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId, actor_id: actorId, ...creds }),
    });
    return resp.json();
  },

  /** Check if a tenant has M-Pesa credentials configured (no secrets returned). */
  async getCredentialStatus(tenantId: string): Promise<MpesaCredentialStatus> {
    try {
      const resp = await edgeFetch(`mpesa-credentials?tenant_id=${encodeURIComponent(tenantId)}`);
      if (!resp.ok) return { configured: false };
      return resp.json();
    } catch {
      return { configured: false };
    }
  },

  /** Remove M-Pesa credentials for a tenant (admin only). */
  async deleteCredentials(
    tenantId: string,
    actorId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const resp = await edgeFetch('mpesa-credentials', {
      method: 'DELETE',
      body: JSON.stringify({ tenant_id: tenantId, actor_id: actorId }),
    });
    return resp.json();
  },
};
