import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

const PIN_LENGTH = 6;

export default function LoginPage() {
  const { login, loginWithPin, loading, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!/^\d{6}$/.test(pin)) {
      setLocalError('PIN must be 6 digits.');
      return;
    }

    try {
      if (username.trim()) {
        await login(username.trim(), pin);
      } else {
        await loginWithPin(pin);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleKeypadDigit = (digit: string) => {
    if (loading) return;
    setPin(prev => (prev + digit).slice(0, PIN_LENGTH));
  };

  const handleKeypadBackspace = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (loading) return;
    setPin('');
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

          <div className="form-group hidden-field">
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
              tabIndex={-1}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="none"
              value={pin}
              readOnly
              onKeyDown={(e) => e.preventDefault()}
              autoComplete="off"
              disabled={loading}
            />
          </div>

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="pin-keypad" role="group" aria-label="PIN keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                type="button"
                className="keypad-btn"
                onClick={() => handleKeypadDigit(digit)}
                disabled={loading}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="keypad-btn keypad-btn-secondary"
              onClick={handleKeypadBackspace}
              disabled={loading}
              aria-label="Backspace"
            >
              ⌫
            </button>
            <button
              type="button"
              className="keypad-btn"
              onClick={() => handleKeypadDigit('0')}
              disabled={loading}
            >
              0
            </button>
            <button
              type="button"
              className="keypad-btn keypad-btn-secondary"
              onClick={handleKeypadClear}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
