const CRED_ID_KEY = 'vizia-biometric-cred-id';
const CRED_USER_KEY = 'vizia-biometric-user-id';

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(str: string): ArrayBuffer {
  const bytes = Uint8Array.from(atob(str), c => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function getRpId(): string {
  return window.location.hostname || 'localhost';
}

export const biometricAuth = {
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  isRegistered(): boolean {
    return !!localStorage.getItem(CRED_ID_KEY);
  },

  /** Called after a successful PIN login to register the device fingerprint. */
  async register(userId: string, displayName: string): Promise<void> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { id: getRpId(), name: 'Vizia POS' },
        user: {
          id: new TextEncoder().encode(userId),
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) throw new Error('Fingerprint setup was cancelled');

    localStorage.setItem(CRED_ID_KEY, toBase64(credential.rawId));
    localStorage.setItem(CRED_USER_KEY, userId);
  },

  /**
   * Prompts the device fingerprint sensor.
   * Returns the stored userId if successful, throws on failure/cancel.
   */
  async authenticate(): Promise<string> {
    const storedCredId = localStorage.getItem(CRED_ID_KEY);
    const storedUserId = localStorage.getItem(CRED_USER_KEY);
    if (!storedCredId || !storedUserId) throw new Error('Fingerprint not set up on this device');

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: getRpId(),
        allowCredentials: [{
          type: 'public-key',
          id: fromBase64(storedCredId),
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!assertion) throw new Error('Fingerprint authentication was cancelled');

    return storedUserId;
  },

  clear(): void {
    localStorage.removeItem(CRED_ID_KEY);
    localStorage.removeItem(CRED_USER_KEY);
  },
};
