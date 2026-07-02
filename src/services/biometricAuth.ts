import { Capacitor } from '@capacitor/core';

const CRED_ID_KEY = 'vizia-biometric-cred-id';
const CRED_USER_KEY = 'vizia-biometric-user-id';

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ── WebAuthn helpers (web only) ──────────────────────────────────────────────

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

async function webAuthnAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const biometricAuth = {
  async isAvailable(): Promise<boolean> {
    if (isNative()) {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const info = await BiometricAuth.checkBiometry();
        return info.isAvailable;
      } catch (e) {
        console.error('[BiometricAuth] checkBiometry threw:', e);
        return false;
      }
    }
    return webAuthnAvailable();
  },

  isRegistered(): boolean {
    return !!localStorage.getItem(CRED_USER_KEY);
  },

  /** Register fingerprint for the currently logged-in user. */
  async register(userId: string, displayName: string): Promise<void> {
    if (isNative()) {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate({
        reason: 'Verify your fingerprint to enable fingerprint login',
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
      });
      localStorage.setItem(CRED_USER_KEY, userId);
      return;
    }

    // Web: WebAuthn
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
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
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

  /** Prompt fingerprint and return the stored userId on success. */
  async authenticate(): Promise<string> {
    const storedUserId = localStorage.getItem(CRED_USER_KEY);
    if (!storedUserId) throw new Error('Fingerprint not set up on this device');

    if (isNative()) {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate({
        reason: 'Scan your fingerprint to log in',
        cancelTitle: 'Use PIN instead',
        allowDeviceCredential: false,
      });
      return storedUserId;
    }

    // Web: WebAuthn
    const storedCredId = localStorage.getItem(CRED_ID_KEY);
    if (!storedCredId) throw new Error('Fingerprint credential not found. Please set up fingerprint again in Settings → Security.');

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
