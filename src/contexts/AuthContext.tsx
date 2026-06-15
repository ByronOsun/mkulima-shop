import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContext as IAuthContext } from '../types';
import { authService } from '../services/auth';

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.validateSession();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to validate session:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await authService.login(username, pin);
      setUser(currentUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithPin = async (pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = await authService.loginByPin(pin);
      setUser(currentUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setError(null);
  };

  const value: IAuthContext = {
    user,
    loading,
    error,
    login,
    loginWithPin,
    logout,
    isAuthenticated: user !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
