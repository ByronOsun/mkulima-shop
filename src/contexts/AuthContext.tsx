import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContext as IAuthContext } from '../types';
import { authService } from '../services/auth';
import { biometricAuth } from '../services/biometricAuth';

const AuthContext = createContext<IAuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricRegistered, setIsBiometricRegistered] = useState(false);

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

    const checkBiometric = async () => {
      const available = await biometricAuth.isAvailable();
      setIsBiometricAvailable(available);
      setIsBiometricRegistered(biometricAuth.isRegistered());
    };

    initAuth();
    checkBiometric();
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

  const loginWithBiometric = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await biometricAuth.authenticate();
      const currentUser = await authService.loginByUserId(userId);
      setUser(currentUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fingerprint authentication failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerBiometric = async () => {
    if (!user) throw new Error('You must be logged in to set up fingerprint');
    await biometricAuth.register(user.id, user.fullName || user.username);
    setIsBiometricRegistered(true);
  };

  const disableBiometric = () => {
    biometricAuth.clear();
    setIsBiometricRegistered(false);
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
    loginWithBiometric,
    registerBiometric,
    disableBiometric,
    isBiometricAvailable,
    isBiometricRegistered,
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
