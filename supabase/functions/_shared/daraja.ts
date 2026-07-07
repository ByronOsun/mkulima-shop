// Safaricom Daraja API utilities

export type DarajaEnv = 'sandbox' | 'production';
export type ShortcodeType = 'paybill' | 'till';

export interface TenantCreds {
  shortcode: string;
  shortcode_type: ShortcodeType;
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  environment: DarajaEnv;
}

export const DARAJA_BASE: Record<DarajaEnv, string> = {
  production: 'https://api.safaricom.co.ke',
  sandbox: 'https://sandbox.safaricom.co.ke',
};

export async function getDarajaToken(creds: TenantCreds): Promise<string> {
  const url = `${DARAJA_BASE[creds.environment]}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = btoa(`${creds.consumer_key}:${creds.consumer_secret}`);

  const resp = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Daraja OAuth failed (${resp.status}): ${body}`);
  }
  const json = await resp.json();
  if (!json.access_token) throw new Error('Daraja returned no access_token');
  return json.access_token as string;
}

/** YYYYMMDDHHMMSS timestamp in local Kenya time (UTC+3). */
export function getTimestamp(): string {
  const d = new Date(Date.now() + 3 * 3600_000); // UTC+3
  return d.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

/** Base64(shortcode + passkey + timestamp) */
export function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/** Normalise a Kenyan phone number to 2547XXXXXXXX or 2541XXXXXXXX. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('254') && d.length === 12) return d;
  if (d.startsWith('0') && d.length === 10) return '254' + d.slice(1);
  if ((d.startsWith('7') || d.startsWith('1')) && d.length === 9) return '254' + d;
  return d;
}

export interface StkPushParams {
  creds: TenantCreds;
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
  callbackUrl: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(p: StkPushParams): Promise<StkPushResponse> {
  const token = await getDarajaToken(p.creds);
  const ts = getTimestamp();
  const pwd = generatePassword(p.creds.shortcode, p.creds.passkey, ts);
  const phone = formatPhone(p.phone);
  const base = DARAJA_BASE[p.creds.environment];

  const body = {
    BusinessShortCode: p.creds.shortcode,
    Password: pwd,
    Timestamp: ts,
    TransactionType: p.creds.shortcode_type === 'till'
      ? 'CustomerBuyGoodsOnline'
      : 'CustomerPayBillOnline',
    Amount: String(Math.ceil(p.amount)),
    PartyA: phone,
    PartyB: p.creds.shortcode,
    PhoneNumber: phone,
    CallBackURL: p.callbackUrl,
    AccountReference: p.accountRef.slice(0, 12),
    TransactionDesc: p.description.slice(0, 13),
  };

  const resp = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || `STK Push error: ${JSON.stringify(data)}`);
  }
  return data as StkPushResponse;
}

export interface StkQueryParams {
  creds: TenantCreds;
  checkoutRequestId: string;
}

export async function queryStkStatus(p: StkQueryParams): Promise<Record<string, string>> {
  const token = await getDarajaToken(p.creds);
  const ts = getTimestamp();
  const pwd = generatePassword(p.creds.shortcode, p.creds.passkey, ts);
  const base = DARAJA_BASE[p.creds.environment];

  const resp = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: p.creds.shortcode,
      Password: pwd,
      Timestamp: ts,
      CheckoutRequestID: p.checkoutRequestId,
    }),
  });
  return resp.json();
}
