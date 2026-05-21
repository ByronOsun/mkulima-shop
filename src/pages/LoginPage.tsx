import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const { login, loading, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError('Username is required.');
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setLocalError('PIN must be 6 digits.');
      return;
    }

    try {
      await login(username.trim(), pin);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const displayError = localError || authError;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">🌾</div>
          <h1>Mkulima Agrovet</h1>
          <p>POS System</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {displayError && <div className="form-error">{displayError}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
