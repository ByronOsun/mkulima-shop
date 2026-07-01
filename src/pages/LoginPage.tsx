import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

const PIN_LENGTH = 6;

export default function LoginPage() {
  const {
    loginWithPin, loginWithBiometric, registerBiometric,
    isBiometricAvailable, isBiometricRegistered,
    loading, error: authError,
  } = useAuth();

  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricWorking, setBiometricWorking] = useState(false);

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
      loginWithPin(pin)
        .then(() => {
          // After PIN login succeeds: if biometric is available but not yet set up,
          // prompt the user to enable it.
          if (isBiometricAvailable && !isBiometricRegistered) {
            setShowBiometricSetup(true);
          }
        })
        .catch((err) => {
          setLocalError(err instanceof Error ? err.message : 'Incorrect PIN. Try again.');
          setPin('');
        });
    }
  }, [pin]);

  const handleFingerprintLogin = async () => {
    if (loading || biometricWorking) return;
    setBiometricWorking(true);
    setLocalError(null);
    try {
      await loginWithBiometric();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Fingerprint not recognised. Try PIN.');
    } finally {
      setBiometricWorking(false);
    }
  };

  const handleEnableBiometric = async () => {
    try {
      await registerBiometric();
      setShowBiometricSetup(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not set up fingerprint.');
      setShowBiometricSetup(false);
    }
  };

  const displayError = localError || authError;

  if (showBiometricSetup) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="biometric-setup-icon" aria-hidden="true">&#x1F4F1;</div>
            <h1>Enable Fingerprint Login?</h1>
            <p>Log in faster next time — no PIN needed</p>
          </div>
          <div className="biometric-setup-actions">
            <button className="biometric-enable-btn" onClick={handleEnableBiometric}>
              Enable Fingerprint
            </button>
            <button className="biometric-skip-btn" onClick={() => setShowBiometricSetup(false)}>
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">&#x1F33E;</div>
          <p>POS System</p>
        </div>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          {(loading || biometricWorking)
            ? <div className="pin-loading">{biometricWorking ? 'Verifying fingerprint…' : 'Verifying…'}</div>
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
                disabled={loading || biometricWorking}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="keypad-btn keypad-btn-secondary"
              onClick={handleKeypadBackspace}
              disabled={loading || biometricWorking}
              aria-label="Backspace"
            >
              &#x232B;
            </button>
            <button
              type="button"
              className="keypad-btn"
              onClick={() => handleKeypadDigit('0')}
              disabled={loading || biometricWorking}
            >
              0
            </button>
            <span className="keypad-spacer" aria-hidden="true" />
          </div>

          {isBiometricRegistered && (
            <button
              type="button"
              className="fingerprint-btn"
              onClick={handleFingerprintLogin}
              disabled={loading || biometricWorking}
              aria-label="Login with fingerprint"
            >
              <svg className="fingerprint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a9 9 0 0 1 9 9" />
                <path d="M3.6 9a9 9 0 0 1 1.5-4" />
                <path d="M12 5a5 5 0 0 1 5 5c0 4.5-2 7-5 9" />
                <path d="M7 10a5 5 0 0 1 3.3-4.7" />
                <path d="M12 9a1 1 0 0 1 1 1c0 2-.5 4.5-1 6" />
                <path d="M9 12.5c.2-1 .4-2 .4-2.5" />
              </svg>
              Use Fingerprint
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
