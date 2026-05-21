import { useEffect, useState } from 'react';
import { Sale } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/HistoryPage.css';

export default function HistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  useEffect(() => {
    void loadSales();
  }, [selectedDate]);

  const loadSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getSalesForDate(selectedDate);
      setSales(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const paymentBreakdown = sales.reduce(
    (breakdown, sale) => {
      const method = sale.payment_method;
      breakdown[method] = (breakdown[method] || 0) + sale.total_amount;
      return breakdown;
    },
    {} as Record<string, number>
  );

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

  return (
    <div className="history-page">
      <div className="history-header">
        <h2>Daily Sales History</h2>
        <div className="date-picker">
          <label htmlFor="date-input">Select Date:</label>
          <input
            id="date-input"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="history-summary">
        <div className="summary-item">
          <span className="summary-label">Transactions</span>
          <span className="summary-value">{sales.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>

      {Object.keys(paymentBreakdown).length > 0 && (
        <div className="payment-breakdown">
          <h3>Payment Methods</h3>
          <div className="breakdown-grid">
            {Object.entries(paymentBreakdown).map(([method, amount]) => (
              <div key={method} className="breakdown-item">
                <span className="breakdown-method">{method.replace('_', ' ')}</span>
                <span className="breakdown-amount">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading sales...</div>
      ) : sales.length === 0 ? (
        <div className="empty-state">
          <p>No sales found for {selectedDate}</p>
        </div>
      ) : (
        <div className="sales-list">
          <h3>Itemized Transactions</h3>
          {sales.map((sale) => (
            <div key={sale.id} className="sale-item-container">
              <button
                className="sale-item-header"
                onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
              >
                <div className="sale-info">
                  <span className="sale-time">{formatTime(sale.created_at)}</span>
                  <span className="sale-amount">{formatCurrency(sale.total_amount)}</span>
                  <span className="sale-method">{sale.payment_method}</span>
                </div>
                <span className="expand-icon">{expandedSale === sale.id ? '▼' : '▶'}</span>
              </button>

              {expandedSale === sale.id && (
                <div className="sale-details">
                  <div className="details-grid">
                    {sale.items && sale.items.length > 0 ? (
                      <>
                        <div className="items-header">
                          <span>Product</span>
                          <span>Qty</span>
                          <span>Price</span>
                          <span>Subtotal</span>
                        </div>
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="item-row">
                            <span className="item-name">{item.product?.name || 'Unknown'}</span>
                            <span className="item-qty">{item.quantity}</span>
                            <span className="item-price">{formatCurrency(item.unit_price)}</span>
                            <span className="item-subtotal">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p>No items in this transaction</p>
                    )}
                  </div>
                  {sale.customer_name && (
                    <div className="customer-info">
                      <span>Customer: {sale.customer_name}</span>
                      {sale.customer_contact && <span>Contact: {sale.customer_contact}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
