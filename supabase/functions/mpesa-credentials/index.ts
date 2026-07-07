// Edge Function: mpesa-credentials
// Manages encrypted M-Pesa Daraja credentials per tenant.
// Uses service_role key — credentials are never readable from the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';
import { encrypt, decrypt } from '../_shared/crypto.ts';

const supabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const db = supabaseAdmin();

  try {
    if (req.method === 'POST') {
      // Save or update credentials for a tenant
      const body = await req.json();
      const {
        tenant_id,
        shortcode,
        shortcode_type,
        consumer_key,
        consumer_secret,
        passkey,
        environment = 'production',
        account_number,
        actor_id,
      } = body;

      if (!tenant_id || !shortcode || !shortcode_type || !consumer_key || !consumer_secret || !passkey) {
        return jsonError('Missing required fields: tenant_id, shortcode, shortcode_type, consumer_key, consumer_secret, passkey');
      }

      if (shortcode_type === 'paybill' && !account_number) {
        return jsonError('Account Number is required for Paybill shortcodes');
      }

      // Verify tenant exists and is active
      const { data: tenant, error: tenantErr } = await db
        .from('tenants')
        .select('id, is_active')
        .eq('id', tenant_id)
        .single();

      if (tenantErr || !tenant) return jsonError('Tenant not found', 404);
      if (!tenant.is_active) return jsonError('Tenant account is suspended', 403);

      // Verify actor is an admin for this tenant (if actor_id provided)
      if (actor_id) {
        const { data: actor } = await db
          .from('staff_users')
          .select('role, is_active, tenant_id')
          .eq('id', actor_id)
          .single();

        const isAuthorized =
          actor?.is_active &&
          (actor.role === 'admin' || actor.role === 'super_admin') &&
          (actor.role === 'super_admin' || actor.tenant_id === tenant_id);

        if (!isAuthorized) return jsonError('Unauthorized: admin access required', 403);
      }

      // Encrypt each sensitive credential separately
      const [ck, cs, pk] = await Promise.all([
        encrypt(consumer_key),
        encrypt(consumer_secret),
        encrypt(passkey),
      ]);

      const { error: upsertErr } = await db
        .from('tenant_mpesa_credentials')
        .upsert(
          {
            tenant_id,
            shortcode: shortcode.toString(),
            shortcode_type,
            consumer_key_encrypted: ck,
            consumer_secret_encrypted: cs,
            passkey_encrypted: pk,
            environment,
            account_number: account_number || null,
            is_active: true,
          },
          { onConflict: 'tenant_id' },
        );

      if (upsertErr) throw new Error(upsertErr.message);

      // Audit log
      await db.from('mpesa_audit_log').insert({
        tenant_id,
        action: 'credentials_updated',
        actor_id: actor_id || null,
        metadata: { shortcode, shortcode_type, environment },
      });

      return jsonOk({ success: true, message: 'M-Pesa credentials saved successfully' });
    }

    if (req.method === 'GET') {
      // Return masked credential status (no secrets)
      const url = new URL(req.url);
      const tenant_id = url.searchParams.get('tenant_id');
      if (!tenant_id) return jsonError('tenant_id query param required');

      const { data, error } = await db
        .from('tenant_mpesa_credentials')
        .select('shortcode, shortcode_type, environment, account_number, is_active, updated_at')
        .eq('tenant_id', tenant_id)
        .single();

      if (error || !data) {
        return jsonOk({ configured: false });
      }

      return jsonOk({
        configured: true,
        shortcode: data.shortcode,
        shortcode_type: data.shortcode_type,
        environment: data.environment,
        account_number: data.account_number || null,
        is_active: data.is_active,
        updated_at: data.updated_at,
      });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { tenant_id, actor_id } = body;
      if (!tenant_id) return jsonError('tenant_id required');

      if (actor_id) {
        const { data: actor } = await db
          .from('staff_users')
          .select('role, is_active, tenant_id')
          .eq('id', actor_id)
          .single();

        const isAuthorized =
          actor?.is_active &&
          (actor.role === 'admin' || actor.role === 'super_admin') &&
          (actor.role === 'super_admin' || actor.tenant_id === tenant_id);

        if (!isAuthorized) return jsonError('Unauthorized', 403);
      }

      const { error } = await db
        .from('tenant_mpesa_credentials')
        .delete()
        .eq('tenant_id', tenant_id);

      if (error) throw new Error(error.message);

      await db.from('mpesa_audit_log').insert({
        tenant_id,
        action: 'credentials_deleted',
        actor_id: actor_id || null,
        metadata: {},
      });

      return jsonOk({ success: true });
    }

    return jsonError('Method not allowed', 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mpesa-credentials]', msg);
    return jsonError(msg, 500);
  }
});
