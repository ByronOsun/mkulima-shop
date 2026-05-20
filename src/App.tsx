import { useState, useEffect } from 'react';
import './styles/App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import ReceiptPage from './pages/ReceiptPage';
import { ReceiptData } from './types';

type PageType = 'pos' | 'inventory' | 'sales' | 'reports' | 'receipt';

function AppContent() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>('pos');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleReceiptReady = (receiptData: ReceiptData) => {
    setReceipt(receiptData);
    setCurrentPage('receipt');
  };

  const handleBackToPos = () => {
    setReceipt(null);
    setCurrentPage('pos');
  };

  const isCashier = user?.role === 'cashier';
  const isAdmin = user?.role === 'admin';

  const renderPage = () => {
    switch (currentPage) {
      case 'pos':
        return <POSPage onCheckoutSuccess={handleReceiptReady} />;
      case 'inventory':
        return isAdmin ? <InventoryPage /> : null;
      case 'sales':
        return isAdmin ? <SalesPage /> : null;
      case 'reports':
        return isAdmin ? <ReportsPage /> : null;
      case 'receipt':
        return <ReceiptPage receipt={receipt} onBackToPos={handleBackToPos} />;
      default:
        return <POSPage onCheckoutSuccess={handleReceiptReady} />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Mkulima Agrovet POS</h1>
          <p className="app-subtitle">Point of Sale System</p>
        </div>
        <div className="header-center">
          <div className="clock">{time.toLocaleTimeString()}</div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-badge">
              {isCashier ? '💳 ' : '👤 '}
              {user?.fullName || user?.username}
            </span>
            <button className="btn-logout" onClick={logout} title="Logout">
              🚪 Logout
            </button>
          </div>
          <span className="date">{time.toLocaleDateString()}</span>
        </div>
      </header>

      <div className="app-container">
        <nav className="sidebar-nav">
          <button
            className={`nav-btn ${currentPage === 'pos' ? 'active' : ''}`}
            onClick={handleBackToPos}
          >
            <span className="nav-icon">🛒</span>
            <span className="nav-label">POS</span>
          </button>
          {isAdmin && (
            <>
              <button
                className={`nav-btn ${currentPage === 'inventory' ? 'active' : ''}`}
                onClick={() => setCurrentPage('inventory')}
              >
                <span className="nav-icon">📦</span>
                <span className="nav-label">Inventory</span>
              </button>
              <button
                className={`nav-btn ${currentPage === 'sales' ? 'active' : ''}`}
                onClick={() => setCurrentPage('sales')}
              >
                <span className="nav-icon">💵</span>
                <span className="nav-label">Sales</span>
              </button>
              <button
                className={`nav-btn ${currentPage === 'reports' ? 'active' : ''}`}
                onClick={() => setCurrentPage('reports')}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-label">Reports</span>
              </button>
            </>
          )}
        </nav>

        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
