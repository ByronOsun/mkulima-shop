import { useState, useEffect } from 'react';
import { Sale, SaleItem } from '../types';
import '../styles/TransactionHistory.css';

interface TransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  cashierName: string;
  date: string;
}

export default function TransactionHistory({
  isOpen,
  onClose,
  cashierName,
  date,
}: TransactionHistoryProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedSale, setSelectedSale] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen, date]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Load from localStorage (demo)
      const storageKey = 'mkulima-demo-backend';
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const state = JSON.parse(raw);
        // Filter sales for the date
        const daySales = state.sales.filter((s: Sale) =>
          s.sale_date.startsWith(date)
        );
        setSales(daySales);
        // Get all sale items for these sales
        const saleIds = new Set(daySales.map((s: Sale) => s.id));
        const relevantItems = state.saleItems.filter((item: SaleItem) =>
          saleIds.has(item.sale_id)
        );
        setSaleItems(relevantItems);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getItemsForSale = (saleId: string): SaleItem[] => {
    return saleItems.filter(item => item.sale_id === saleId);
  };

  const totals = {
    transactions: sales.length,
    revenue: sales.reduce((sum, s) => sum + s.total_amount, 0),
    items: saleItems.length,
    paymentBreakdown: sales.reduce(
      (acc, s) => {
        acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total_amount;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  if (!isOpen) return null;

  return (
    <div className="transaction-modal-overlay" onClick={onClose}>
      <div
        className="transaction-modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="transaction-header">
          <div>
            <h3>Transaction History</h3>
            <p className="transaction-date">
              {cashierName} • {new Date(date).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button className="transaction-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Summary Stats */}
        <div className="transaction-stats">
          <div className="stat-box">
            <span className="stat-label">Transactions</span>
            <span className="stat-value">{totals.transactions}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">
              Ksh {totals.revenue.toLocaleString('en-KE')}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Items Sold</span>
            <span className="stat-value">{totals.items}</span>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="payment-breakdown">
          <h4>Payment Methods</h4>
          <div className="breakdown-items">
            {Object.entries(totals.paymentBreakdown).map(([method, total]) => (
              <div key={method} className="breakdown-item">
                <span className="method-name">
                  {method.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="method-amount">
                  Ksh {total.toLocaleString('en-KE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="transactions-list">
          <h4>Detailed Transactions</h4>
          {loading ? (
            <div className="loading">Loading transactions...</div>
          ) : sales.length === 0 ? (
            <div className="empty">No transactions for this date</div>
          ) : (
            <div className="transaction-items">
              {sales.map(sale => (
                <div
                  key={sale.id}
                  className="transaction-item"
                  onClick={() =>
                    setSelectedSale(selectedSale === sale.id ? null : sale.id)
                  }
                >
                  <div className="transaction-header-row">
                    <div className="transaction-info">
                      <span className="transaction-time">
                        {new Date(sale.sale_date).toLocaleTimeString('en-KE')}
                      </span>
                      <span className="transaction-method">
                        {sale.payment_method.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="transaction-amount">
                      Ksh {sale.total_amount.toLocaleString('en-KE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <span className="expand-icon">
                      {selectedSale === sale.id ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* Itemized View */}
                  {selectedSale === sale.id && (
                    <div className="transaction-details">
                      <div className="items-table">
                        <div className="items-header">
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Price</span>
                          <span>Total</span>
                        </div>
                        {getItemsForSale(sale.id).map(item => (
                          <div key={item.id} className="items-row">
                            <span className="item-name">Product {item.product_id.slice(0, 8)}</span>
                            <span className="item-qty">{item.quantity}</span>
                            <span className="item-price">
                              Ksh {item.unit_price.toLocaleString('en-KE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="item-total">
                              Ksh {item.subtotal.toLocaleString('en-KE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="transaction-footer">
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
