import { User } from '../types';
import { supabase } from './supabase';

const AUTH_STORAGE_KEY = 'mkulima-auth';
const USERS_STORAGE_KEY = 'mkulima-users';

// Demo users - can be extended in localStorage
const DEMO_ADMIN: User = {
  id: 'admin-001',
  username: 'admin',
  role: 'admin',
  fullName: 'Admin User',
};

const DEMO_CASHIERS: User[] = [
  {
    id: 'cashier-001',
    username: 'john.arap@wakulima.com',
    role: 'cashier',
    firstName: 'John',
    lastName: 'Arap',
    fullName: 'John Arap',
  },
  {
    id: 'cashier-002',
    username: 'mary.omondi@wakulima.com',
    role: 'cashier',
    firstName: 'Mary',
    lastName: 'Omondi',
    fullName: 'Mary Omondi',
  },
  {
    id: 'cashier-003',
    username: 'david.kipchoge@wakulima.com',
    role: 'cashier',
    firstName: 'David',
    lastName: 'Kipchoge',
    fullName: 'David Kipchoge',
  },
];

// Demo credentials - in production, these would be hashed and stored securely
const DEMO_CREDENTIALS: Record<string, string> = {
  'admin': '123456',
  'john.arap@wakulima.com': '111111',
  'mary.omondi@wakulima.com': '222222',
  'david.kipchoge@wakulima.com': '333333',
};

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

const saveDemoUsers = () => {
  if (!canUseStorage()) return;
  try {
    const users = [DEMO_ADMIN, ...DEMO_CASHIERS];
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    console.error('Failed to save users to localStorage');
  }
};

const loadDemoUsers = (): User[] => {
  if (!canUseStorage()) {
    return [DEMO_ADMIN, ...DEMO_CASHIERS];
  }

  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as User[];
    }
  } catch {
    console.error('Failed to load users from localStorage');
  }

  saveDemoUsers();
  return [DEMO_ADMIN, ...DEMO_CASHIERS];
};

const saveCurrentUser = (user: User | null) => {
  if (!canUseStorage()) return;
  try {
    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    console.error('Failed to save current user to localStorage');
  }
};

const loadCurrentUser = (): User | null => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as User;
    }
  } catch {
    console.error('Failed to load current user from localStorage');
  }

  return null;
};

export const authService = {
  async login(username: string, pin: string): Promise<User> {
    // Try Supabase first
    if (supabase) {
      try {
        // For Supabase integration, you would use:
        // const { data, error } = await supabase.auth.signInWithPassword({
        //   email: username,
        //   password: pin,
        // });
        // This is a placeholder for actual Supabase auth
      } catch {
        // fall through to demo auth
      }
    }

    // Demo authentication
    const users = loadDemoUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      throw new Error(`User not found: ${username}`);
    }

    const expectedPin = DEMO_CREDENTIALS[username];
    if (!expectedPin || expectedPin !== pin) {
      throw new Error('Invalid credentials');
    }

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
      return user;
    }

    // Check Supabase session if available
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          // Map Supabase user to our User type
          // This is a placeholder for actual implementation
        }
      } catch {
        // fall through
      }
    }

    return null;
  },

  async createCashier(
    email: string,
    firstName: string,
    lastName: string,
    pin: string
  ): Promise<User> {
    const newUser: User = {
      id: `cashier-${Date.now()}`,
      username: email,
      role: 'cashier',
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
    };

    // Add to demo credentials
    DEMO_CREDENTIALS[email] = pin;

    // Save to localStorage
    if (canUseStorage()) {
      const users = loadDemoUsers();
      users.push(newUser);
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // For Supabase, this would create an auth user
    // const { error } = await supabase.auth.admin.createUser({...})

    return newUser;
  },

  getAllCashiers(): User[] {
    const users = loadDemoUsers();
    return users.filter(u => u.role === 'cashier');
  },

  async changePin(username: string, oldPin: string, newPin: string): Promise<void> {
    // Validate old pin
    const expectedPin = DEMO_CREDENTIALS[username];
    if (!expectedPin || expectedPin !== oldPin) {
      throw new Error('Invalid current PIN');
    }

    // Update pin
    DEMO_CREDENTIALS[username] = newPin;

    // In production, save to secure backend
  },
};
