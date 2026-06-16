import { useState, useEffect } from 'react';
import './styles/App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import StockRequisitionPage from './pages/StockRequisitionPage';
import FinancePage from './pages/FinancePage';
import ReceiptPage from './pages/ReceiptPage';
import HistoryPage from './pages/HistoryPage';
import CreditSalesPage from './pages/CreditSalesPage';
import { ReceiptData } from './types';

type PageType = 'pos' | 'inventory' | 'sales' | 'reports' | 'stock-requisition' | 'finance' | 'receipt' | 'history' | 'credit-sales';

function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let current = 0;
    const timer = setInterval(() => {
      const remaining = 95 - current;
      const step = Math.max(0.5, remaining * 0.12);
      current = Math.min(95, current + step);
      setProgress(Math.round(current));
      if (current >= 95) clearInterval(timer);
    }, 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-loading">
      <div className="loading-content">
        <div className="loading-logo">🌾</div>
        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="loading-pct">{progress}%</span>
      </div>
    </div>
  );
}

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
    return <LoadingScreen />;
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
        return isAdmin ? <SalesPage onOpenReceipt={handleReceiptReady} /> : null;
      case 'reports':
        return isAdmin ? <ReportsPage /> : null;
      case 'stock-requisition':
        return isAdmin ? <StockRequisitionPage /> : null;
      case 'finance':
        return isAdmin ? <FinancePage /> : null;
      case 'history':
        return <HistoryPage />;
      case 'credit-sales':
        return <CreditSalesPage />;
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
              <button
                className={`nav-btn ${currentPage === 'finance' ? 'active' : ''}`}
                onClick={() => setCurrentPage('finance')}
              >
                <span className="nav-icon">💰</span>
                <span className="nav-label">Finance</span>
              </button>
                <button
                  className={`nav-btn ${currentPage === 'stock-requisition' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('stock-requisition')}
                >
                  <span className="nav-icon">📋</span>
                  <span className="nav-label">Stock</span>
                </button>
            </>
          )}
          {isCashier && (
            <>
              <button
                className={`nav-btn ${currentPage === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentPage('history')}
              >
                <span className="nav-icon">📜</span>
                <span className="nav-label">History</span>
              </button>
              <button
                className={`nav-btn ${currentPage === 'credit-sales' ? 'active' : ''}`}
                onClick={() => setCurrentPage('credit-sales')}
              >
                <span className="nav-icon">📑</span>
                <span className="nav-label">Credit</span>
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
