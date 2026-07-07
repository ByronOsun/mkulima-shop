// Edge Function: mpesa-status
// Queries the local transaction status, and optionally polls Daraja's
// STK Push Query API for transactions still in 'processing' state.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';
import { decrypt } from '../_shared/crypto.ts';
import { queryStkStatus, type TenantCreds } from '../_shared/daraja.ts';

const supabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') return jsonError('Method not allowed', 405);

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const checkoutRequestId = url.searchParams.get('checkout_request_id');

  if (!checkoutRequestId) return jsonError('checkout_request_id query param required');

  try {
    // 1. Check local database first
    const { data: txn, error } = await db
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error || !txn) return jsonError('Transaction not found', 404);

    // 2. If already terminal, return immediately
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(txn.status)) {
      return jsonOk({
        status: txn.status,
        mpesa_receipt_number: txn.mpesa_receipt_number,
        result_description: txn.result_description,
        amount: txn.amount,
        phone_number: txn.phone_number,
      });
    }

    // 3. Still processing — poll Daraja for the latest status
    const { data: creds } = await db
      .from('tenant_mpesa_credentials')
      .select('*')
      .eq('tenant_id', txn.tenant_id)
      .single();

    if (creds) {
      try {
        const [ck, cs, pk] = await Promise.all([
          decrypt(creds.consumer_key_encrypted),
          decrypt(creds.consumer_secret_encrypted),
          decrypt(creds.passkey_encrypted),
        ]);

        const tenantCreds: TenantCreds = {
          shortcode: creds.shortcode,
          shortcode_type: creds.shortcode_type,
          consumer_key: ck,
          consumer_secret: cs,
          passkey: pk,
          environment: creds.environment,
        };

        const queryResult = await queryStkStatus({
          creds: tenantCreds,
          checkoutRequestId,
        });

        const resultCode = parseInt(queryResult.ResultCode ?? '-1', 10);

        if (resultCode === 0) {
          // Payment confirmed via query
          await db
            .from('mpesa_transactions')
            .update({ status: 'completed', result_code: 0, result_description: queryResult.ResultDesc })
            .eq('checkout_request_id', checkoutRequestId);

          return jsonOk({ status: 'completed', result_description: queryResult.ResultDesc, amount: txn.amount });
        }

        if (resultCode !== 1032 && resultCode !== -1) {
          // Non-pending error code
          const newStatus = resultCode === 1037 ? 'timeout' : 'failed';
          await db
            .from('mpesa_transactions')
            .update({ status: newStatus, result_code: resultCode, result_description: queryResult.ResultDesc })
            .eq('checkout_request_id', checkoutRequestId);

          return jsonOk({ status: newStatus, result_description: queryResult.ResultDesc });
        }
      } catch (queryErr) {
        // Non-fatal: Daraja query failed, return local status
        console.warn('[mpesa-status] Daraja query failed:', queryErr);
      }
    }

    return jsonOk({
      status: txn.status,
      amount: txn.amount,
      phone_number: txn.phone_number,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mpesa-status]', msg);
    return jsonError(msg, 500);
  }
});
