// AES-256-GCM credential encryption for M-Pesa tenant credentials.
// Key is derived from the MPESA_ENCRYPTION_KEY env var via PBKDF2 so the
// raw env value does not need to be exactly 32 bytes.

const SALT = new TextEncoder().encode('mkulima-mpesa-v1');

async function deriveKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('MPESA_ENCRYPTION_KEY');
  if (!raw) throw new Error('MPESA_ENCRYPTION_KEY is not set');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(raw),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts a plaintext string. Returns base64(12-byte IV || ciphertext). */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypts a value produced by encrypt(). */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await deriveKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}
