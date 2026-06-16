import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

const PIN_LENGTH = 6;

export default function LoginPage() {
  const { loginWithPin, loading, error: authError } = useAuth();
  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleKeypadDigit = (digit: string) => {
    if (loading) return;
    setLocalError(null);
    setPin(prev => (prev + digit).slice(0, PIN_LENGTH));
  };

  const handleKeypadBackspace = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading) {
      loginWithPin(pin).catch((err) => {
        setLocalError(err instanceof Error ? err.message : 'Incorrect PIN. Try again.');
        setPin('');
      });
    }
  }, [pin]);

  const displayError = localError || authError;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">🌾</div>
          <p>POS System</p>
        </div>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          {loading
            ? <div className="pin-loading">Verifying…</div>
            : displayError && <div className="form-error">{displayError}</div>
          }

          <div className="pin-dots-container" aria-label="PIN entry">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
            ))}
          </div>

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
            <span className="keypad-spacer" aria-hidden="true" />
          </div>
        </form>
      </div>
    </div>
  );
}
