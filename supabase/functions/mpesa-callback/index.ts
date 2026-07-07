// Edge Function: mpesa-callback
// Shared callback URL for all tenants. Safaricom posts the STK Push result here.
// We identify the tenant from the CheckoutRequestID stored in mpesa_transactions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

// Safaricom expects a 200 response quickly; validate async in background.
Deno.serve(async (req) => {
  // Always acknowledge immediately — Safaricom retries on non-2xx
  const ack = new Response(
    JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

  if (req.method !== 'POST') return ack;

  // Process callback asynchronously after responding
  req.json().then(processCallback).catch((err) => {
    console.error('[mpesa-callback] Failed to parse body:', err);
  });

  return ack;
});

interface CallbackMetadata {
  Item: Array<{ Name: string; Value?: string | number }>;
}

interface StkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: CallbackMetadata;
}

async function processCallback(body: unknown) {
  const db = supabaseAdmin();

  try {
    // Daraja wraps the result in Body.stkCallback
    const callback: StkCallback =
      (body as any)?.Body?.stkCallback ?? (body as any)?.stkCallback ?? body;

    const { CheckoutRequestID, MerchantRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      callback;

    if (!CheckoutRequestID) {
      console.error('[mpesa-callback] No CheckoutRequestID in payload', JSON.stringify(body));
      return;
    }

    // Find the transaction to determine which tenant this belongs to
    const { data: txn, error: findErr } = await db
      .from('mpesa_transactions')
      .select('id, tenant_id, sale_id, amount')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (findErr || !txn) {
      console.error('[mpesa-callback] Unknown CheckoutRequestID:', CheckoutRequestID);
      return;
    }

    const success = ResultCode === 0;

    // Extract metadata items (receipt number, amount, phone) from Daraja response
    const meta: Record<string, string | number> = {};
    for (const item of CallbackMetadata?.Item ?? []) {
      if (item.Value !== undefined) meta[item.Name] = item.Value;
    }

    const mpesaReceipt = meta['MpesaReceiptNumber'] as string | undefined;
    const confirmedAmount = meta['Amount'] as number | undefined;

    const newStatus = success ? 'completed' : 'failed';

    // Update transaction record
    await db
      .from('mpesa_transactions')
      .update({
        status: newStatus,
        result_code: ResultCode,
        result_description: ResultDesc,
        mpesa_receipt_number: mpesaReceipt || null,
        callback_data: body as any,
        completed_at: success ? new Date().toISOString() : null,
      })
      .eq('id', txn.id);

    // If payment succeeded, mark the associated sale as completed
    if (success && txn.sale_id) {
      await db
        .from('sales')
        .update({
          status: 'completed',
          payment_channel: 'mpesa',
          amount_paid: confirmedAmount ?? txn.amount,
        })
        .eq('id', txn.sale_id)
        .eq('status', 'pending'); // only update if still pending (idempotent)
    }

    // Audit
    await db.from('mpesa_audit_log').insert({
      tenant_id: txn.tenant_id,
      action: success ? 'payment_completed' : 'payment_failed',
      metadata: {
        checkout_request_id: CheckoutRequestID,
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt: mpesaReceipt,
        amount: confirmedAmount,
        sale_id: txn.sale_id,
      },
    });

    console.info(
      `[mpesa-callback] ${CheckoutRequestID} → ${newStatus}`,
      mpesaReceipt ? `receipt=${mpesaReceipt}` : '',
    );
  } catch (err) {
    console.error('[mpesa-callback] processCallback error:', err);
  }
}
