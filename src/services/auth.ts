import { User, TenantConfig } from '../types';
import { supabase, setCurrentTenant } from './supabase';
import { compare } from 'bcryptjs';

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

const extractLoginName = (value: string) => {
  const normalized = normalizeUsername(value);
  if (normalized.includes('@')) {
    const [localPart] = normalized.split('@');
    return localPart.split('.')[0] || normalized;
  }

  return normalized.split('.')[0] || normalized;
};

const deriveRoleFromUsername = (value: string) => {
  const normalized = normalizeUsername(value);
  const [, maybeRole] = normalized.split('.');
  if (maybeRole === 'cashier' || maybeRole === 'admin' || maybeRole === 'super_admin') {
    return maybeRole as User['role'];
  }

  return null;
};

async function fetchTenantConfig(tenantId: string): Promise<TenantConfig | undefined> {
  if (!supabase) return undefined;
  try {
    const { data } = await supabase
      .from('tenants')
      .select('shop_name, address, phone, header_text, footer_text')
      .eq('id', tenantId)
      .single();
    if (!data) return undefined;
    return {
      shopName: data.shop_name,
      address: data.address || undefined,
      phone: data.phone || undefined,
      headerText: data.header_text || undefined,
      footerText: data.footer_text || undefined,
    };
  } catch {
    return undefined;
  }
}

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

const verifyPin = async (pin: string, storedHash: string) => {
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return compare(pin, storedHash);
  }

  return hashPin(pin).then(hashed => hashed === storedHash);
};

export const authService = {
  async login(username: string, pin: string): Promise<User> {
    if (!supabase) {
      throw new Error('Authentication service is not configured');
    }

    const lookupUsername = extractLoginName(username);
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, pin_hash, role, display_name, created_at, is_active, tenant_id')
      .eq('username', lookupUsername)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !(await verifyPin(pin, data.pin_hash))) {
      throw new Error('Invalid username or PIN');
    }

    const inferredRole = deriveRoleFromUsername(username);
    const effectiveRole = (inferredRole ?? data.role) as User['role'];

    const tenantId: string | null = data.tenant_id || null;

    // For non-super_admin users with a tenant, verify the tenant is active
    if (effectiveRole !== 'super_admin' && tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('is_active')
        .eq('id', tenantId)
        .single();
      if (tenant && !tenant.is_active) {
        throw new Error('This shop account has been suspended. Please contact support.');
      }
    }

    const tenantConfig = tenantId ? await fetchTenantConfig(tenantId) : undefined;

    const user: User = {
      id: data.id,
      username: data.username,
      role: effectiveRole,
      fullName: data.display_name,
      created_at: data.created_at,
      is_active: data.is_active,
      tenant_id: tenantId || undefined,
      tenantConfig,
    };

    setCurrentTenant(tenantId, effectiveRole);
    saveCurrentUser(user);
    return user;
  },

  async loginByPin(pin: string): Promise<User> {
    if (!supabase) {
      throw new Error('Authentication service is not configured');
    }

    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, pin_hash, role, display_name, created_at, is_active, tenant_id')
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message);
    }

    for (const candidate of data ?? []) {
      if (await verifyPin(pin, candidate.pin_hash)) {
        const inferredRole = deriveRoleFromUsername(candidate.username);
        const effectiveRole = (inferredRole ?? candidate.role) as User['role'];

        const tenantId: string | null = candidate.tenant_id || null;

        if (effectiveRole !== 'super_admin' && tenantId) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('is_active')
            .eq('id', tenantId)
            .single();
          if (tenant && !tenant.is_active) {
            throw new Error('This shop account has been suspended. Please contact support.');
          }
        }

        const tenantConfig = tenantId ? await fetchTenantConfig(tenantId) : undefined;

        const user: User = {
          id: candidate.id,
          username: candidate.username,
          role: effectiveRole,
          fullName: candidate.display_name,
          created_at: candidate.created_at,
          is_active: candidate.is_active,
          tenant_id: tenantId || undefined,
          tenantConfig,
        };

        setCurrentTenant(tenantId, effectiveRole);
        saveCurrentUser(user);
        return user;
      }
    }

    throw new Error('Invalid PIN');
  },

  async loginByUserId(userId: string): Promise<User> {
    if (!supabase) {
      throw new Error('Authentication service is not configured');
    }

    const { data, error } = await supabase
      .from('staff_users')
      .select('id, username, pin_hash, role, display_name, created_at, is_active, tenant_id')
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Account not found or has been deactivated');

    const inferredRole = deriveRoleFromUsername(data.username);
    const effectiveRole = (inferredRole ?? data.role) as User['role'];
    const tenantId: string | null = data.tenant_id || null;

    if (effectiveRole !== 'super_admin' && tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('is_active')
        .eq('id', tenantId)
        .single();
      if (tenant && !tenant.is_active) {
        throw new Error('This shop account has been suspended. Please contact support.');
      }
    }

    const tenantConfig = tenantId ? await fetchTenantConfig(tenantId) : undefined;

    const user: User = {
      id: data.id,
      username: data.username,
      role: effectiveRole,
      fullName: data.display_name,
      created_at: data.created_at,
      is_active: data.is_active,
      tenant_id: tenantId || undefined,
      tenantConfig,
    };

    setCurrentTenant(tenantId, effectiveRole);
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
    const user = loadCurrentUser();
    if (user) {
      setCurrentTenant(user.tenant_id ?? null, user.role);
    }
    return user;
  },
};
