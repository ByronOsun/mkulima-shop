import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const { login, error: authError, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'cashier' | 'admin'>('cashier');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your username/email');
      return;
    }

    if (!pin || pin.length !== 6) {
      setError('PIN must be exactly 6 digits');
      return;
    }

    try {
      await login(username, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleFillDemo = () => {
    if (selectedRole === 'admin') {
      setUsername('admin');
      setPin('123456');
    } else {
      setUsername('john.arap@wakulima.com');
      setPin('111111');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="login-logo">
              <span className="logo-icon">🌾</span>
            </div>
            <h1>Mkulima Agrovet</h1>
            <p>POS System</p>
          </div>

          {/* Role Selector */}
          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${selectedRole === 'cashier' ? 'active' : ''}`}
              onClick={() => setSelectedRole('cashier')}
              disabled={loading}
            >
              📱 Cashier Login
            </button>
            <button
              type="button"
              className={`role-btn ${selectedRole === 'admin' ? 'active' : ''}`}
              onClick={() => setSelectedRole('admin')}
              disabled={loading}
            >
              👤 Admin Login
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {(error || authError) && (
              <div className="form-error alert">
                ⚠️ {error || authError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">
                {selectedRole === 'admin' ? 'Admin Username' : 'Email Address'}
              </label>
              <input
                id="username"
                type={selectedRole === 'admin' ? 'text' : 'email'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={
                  selectedRole === 'admin'
                    ? 'admin'
                    : 'john.arap@wakulima.com'
                }
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="pin">6-Digit PIN</label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(value);
                }}
                placeholder="••••••"
                disabled={loading}
              />
              <small>Enter your 6-digit PIN (numbers only)</small>
            </div>

            <button
              type="submit"
              className="btn-login"
              disabled={loading || !username || pin.length !== 6}
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>

            <button
              type="button"
              className="btn-demo"
              onClick={handleFillDemo}
              disabled={loading}
            >
              Fill Demo Credentials
            </button>
          </form>

          {/* Demo Credentials Info */}
          <div className="demo-info">
            <h4>Demo Credentials</h4>
            <div className="demo-list">
              <div className="demo-item">
                <strong>Admin:</strong>
                <div>Username: <code>admin</code></div>
                <div>PIN: <code>123456</code></div>
              </div>
              <div className="demo-item">
                <strong>Cashiers:</strong>
                <div>Email: <code>john.arap@wakulima.com</code> | PIN: <code>111111</code></div>
                <div>Email: <code>mary.omondi@wakulima.com</code> | PIN: <code>222222</code></div>
                <div>Email: <code>david.kipchoge@wakulima.com</code> | PIN: <code>333333</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
