// Edge Function: mpesa-stkpush
// Initiates an M-Pesa STK Push using the tenant's own Daraja credentials.
// Credentials are decrypted in memory and never returned to the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';
import { decrypt } from '../_shared/crypto.ts';
import { initiateStkPush, formatPhone, type TenantCreds } from '../_shared/daraja.ts';

const supabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const db = supabaseAdmin();

  try {
    const body = await req.json();
    const { tenant_id, sale_id, amount, phone, description } = body;

    if (!tenant_id || !amount || !phone) {
      return jsonError('Required: tenant_id, amount, phone');
    }

    if (amount < 1) return jsonError('Amount must be at least KES 1');

    const formattedPhone = formatPhone(String(phone));
    if (formattedPhone.length !== 12 || !formattedPhone.startsWith('254')) {
      return jsonError(`Invalid phone number: ${phone}. Use format 07XXXXXXXX or 2547XXXXXXXX`);
    }

    // Fetch encrypted credentials for this tenant
    const { data: creds, error: credsErr } = await db
      .from('tenant_mpesa_credentials')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .single();

    if (credsErr || !creds) {
      return jsonError('M-Pesa is not configured for this tenant. Please set up your Daraja credentials in Settings.', 404);
    }

    // Decrypt credentials (in memory only — never persisted or returned)
    const [consumerKey, consumerSecret, passkey] = await Promise.all([
      decrypt(creds.consumer_key_encrypted),
      decrypt(creds.consumer_secret_encrypted),
      decrypt(creds.passkey_encrypted),
    ]);

    const tenantCreds: TenantCreds = {
      shortcode: creds.shortcode,
      shortcode_type: creds.shortcode_type,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      passkey,
      environment: creds.environment,
    };

    // Build callback URL pointing to the shared mpesa-callback function
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    // For Paybill: use the stored account number (required by Safaricom to route
    // funds to the correct sub-account). For Till: use the sale reference.
    const saleRef = sale_id ? sale_id.substring(0, 8).toUpperCase() : 'POS';
    const accountRef = creds.shortcode_type === 'paybill' && creds.account_number
      ? creds.account_number.slice(0, 12)
      : (description ? description.slice(0, 12) : `Sale-${saleRef}`);
    const txDesc = `Payment ${saleRef}`;

    // Initiate STK Push via Daraja API
    const stkResponse = await initiateStkPush({
      creds: tenantCreds,
      phone: formattedPhone,
      amount: Number(amount),
      accountRef,
      description: txDesc,
      callbackUrl,
    });

    // Record the pending transaction in our ledger
    const { data: txn, error: txnErr } = await db
      .from('mpesa_transactions')
      .insert({
        tenant_id,
        sale_id: sale_id || null,
        checkout_request_id: stkResponse.CheckoutRequestID,
        merchant_request_id: stkResponse.MerchantRequestID,
        phone_number: formattedPhone,
        amount: Math.ceil(Number(amount)),
        status: 'processing',
      })
      .select('id')
      .single();

    if (txnErr) {
      // Non-fatal: STK push succeeded even if we fail to record locally
      console.error('[mpesa-stkpush] Failed to record transaction:', txnErr.message);
    }

    // Audit
    await db.from('mpesa_audit_log').insert({
      tenant_id,
      action: 'stk_push_initiated',
      metadata: {
        checkout_request_id: stkResponse.CheckoutRequestID,
        phone: formattedPhone,
        amount: Math.ceil(Number(amount)),
        sale_id: sale_id || null,
      },
    });

    return jsonOk({
      success: true,
      checkout_request_id: stkResponse.CheckoutRequestID,
      merchant_request_id: stkResponse.MerchantRequestID,
      transaction_id: txn?.id || null,
      customer_message: stkResponse.CustomerMessage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mpesa-stkpush]', msg);
    return jsonError(msg, 500);
  }
});
