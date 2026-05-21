import { User } from '../types';
import { supabase } from './supabase';

const AUTH_STORAGE_KEY = 'mkulima-auth-user';

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

const saveCurrentUser = (user: User | null) => {
  if (!canUseStorage()) return;

  try {
    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
};

const loadCurrentUser = (): User | null => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const normalizeUsername = (username: string) => username.trim().toLowerCase();

const hashPin = async (pin: string) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser crypto is unavailable');
  }

  const bytes = new TextEncoder().encode(pin);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const authService = {
  async login(username: string, pin: string): Promise<User> {
    if (!supabase) {
      throw new Error('Authentication service is not configured');
    }

    const lookupUsername = normalizeUsername(username);
    const hashedPin = await hashPin(pin);

    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, pin_hash, role, display_name, created_at, is_active')
      .eq('username', lookupUsername)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.pin_hash !== hashedPin) {
      throw new Error('Invalid username or PIN');
    }

    const user: User = {
      id: data.id,
      username: data.username,
      role: data.role,
      fullName: data.display_name,
      created_at: data.created_at,
      is_active: data.is_active,
    };

    saveCurrentUser(user);
    return user;
  },

  logout(): void {
    saveCurrentUser(null);
  },

  getCurrentUser(): User | null {
    return loadCurrentUser();
  },

  async validateSession(): Promise<User | null> {
    return loadCurrentUser();
  },
};
