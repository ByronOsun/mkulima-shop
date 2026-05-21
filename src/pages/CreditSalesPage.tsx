import { useEffect, useState } from 'react';
import { Sale } from '../types';
import { supabaseService } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CreditSalesPage.css';

export default function CreditSalesPage() {
  const { user } = useAuth();
  const [creditSales, setCreditSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    void loadCreditSales();
  }, []);

  const loadCreditSales = async () => {
    try {
      setLoading(true);
      setError(null);
      // Get all sales and filter for credit method ones with status pending
      const allSales = await supabaseService.getSalesBetweenDates(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      const creditOnlySales = allSales.filter(
        (sale) => sale.payment_method === 'credit' && sale.status === 'pending'
      );
      setCreditSales(creditOnlySales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credit sales');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePayment = async () => {
    if (!selectedSale || !paymentAmount) {
      setError('Please enter payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const currentBalance = selectedSale.total_amount - (selectedSale.amount_paid || 0);
    if (amount > currentBalance) {
      setError(`Payment cannot exceed remaining balance of ${formatCurrency(currentBalance)}`);
      return;
    }

    try {
      setProcessingId(selectedSale.id);
      setError(null);

      const amountPaid = (selectedSale.amount_paid || 0) + amount;
      const isFullyPaid = amountPaid >= selectedSale.total_amount;

      // Update sale with payment info
      await supabaseService.updateCreditSalePayment(selectedSale.id, {
        amount_paid: amountPaid,
        status: isFullyPaid ? 'completed' : 'pending',
        updated_at: new Date().toISOString(),
      });

      const successMessage = isFullyPaid
        ? `Bill cleared successfully! Payment of ${formatCurrency(amount)} received.`
        : `Payment of ${formatCurrency(amount)} recorded. Remaining: ${formatCurrency(selectedSale.total_amount - amountPaid)}`;

      setMessage(successMessage);

      // Update the selected sale with new payment info
      setSelectedSale({
        ...selectedSale,
        amount_paid: amountPaid,
        status: isFullyPaid ? 'completed' : 'pending',
        updated_at: new Date().toISOString(),
      });

      setPaymentAmount('');
      await loadCreditSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('Are you sure you want to delete this credit sale?')) {
      return;
    }

    try {
      setProcessingId(saleId);
      setError(null);
      await supabaseService.deleteCreditSale(saleId);
      setMessage('Credit sale deleted successfully');
      await loadCreditSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkCleared = async (saleId: string) => {
    try {
      setProcessingId(saleId);
      setError(null);
      await supabaseService.updateCreditSalePayment(saleId, {
        status: 'completed',
        updated_at: new Date().toISOString(),
      });
      setMessage('Sale marked as cleared');
      await loadCreditSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark cleared');
    } finally {
      setProcessingId(null);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="credit-sales-page">
      <div className="credit-header">
        <h2>Credit Sales Management</h2>
        <p className="subtitle">Track and manage credit sales with customer payment history</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="close-btn">
            ✕
          </button>
        </div>
      )}
      {message && (
        <div className="success-message">
          {message}
          <button onClick={() => setMessage(null)} className="close-btn">
            ✕
          </button>
        </div>
      )}

      <div className="credit-content">
        <div className="sales-list-panel">
          <h3>Pending Credit Sales ({creditSales.length})</h3>
          {loading ? (
            <div className="loading">Loading credit sales...</div>
          ) : creditSales.length === 0 ? (
            <div className="empty-state">No pending credit sales</div>
          ) : (
            <div className="sales-list">
              {creditSales.map((sale) => {
                const amountPaid = sale.amount_paid || 0;
                const balance = sale.total_amount - amountPaid;
                const isSelected = selectedSale?.id === sale.id;

                return (
                  <div
                    key={sale.id}
                    className={`sale-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedSale(sale);
                      setPaymentAmount('');
                    }}
                  >
                    <div className="sale-header-info">
                      <span className="sale-date">{formatDate(sale.sale_date)}</span>
                      <span className="sale-status">Pending</span>
                    </div>
                    {sale.customer_name && (
                      <div className="customer-block">
                        <span className="customer-name">{sale.customer_name}</span>
                        {sale.customer_contact && (
                          <span className="customer-contact">{sale.customer_contact}</span>
                        )}
                      </div>
                    )}
                    <div className="amount-info">
                      <div className="amount-row">
                        <span>Total:</span>
                        <span>{formatCurrency(sale.total_amount)}</span>
                      </div>
                      {amountPaid > 0 && (
                        <div className="amount-row paid">
                          <span>Paid:</span>
                          <span>{formatCurrency(amountPaid)}</span>
                        </div>
                      )}
                      <div className="amount-row balance">
                        <span>Balance:</span>
                        <span>{formatCurrency(balance)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="payment-panel">
          {selectedSale ? (
            <>
              <h3>Bill Details</h3>
              <div className="bill-details">
                <div className="customer-section">
                  <h4>Customer Information</h4>
                  {selectedSale.customer_name ? (
                    <div className="customer-details">
                      <div className="detail-row">
                        <span className="detail-label">Customer Name:</span>
                        <span className="detail-value">{selectedSale.customer_name}</span>
                      </div>
                      {selectedSale.customer_contact && (
                        <div className="detail-row">
                          <span className="detail-label">Contact:</span>
                          <span className="detail-value">{selectedSale.customer_contact}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="no-customer">No customer details recorded</p>
                  )}
                </div>

                <div className="transaction-section">
                  <h4>Transaction Summary</h4>
                  <div className="detail-row">
                    <span className="detail-label">Date & Time:</span>
                    <span className="detail-value">{formatDate(selectedSale.sale_date)}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Original Amount:</span>
                    <span className="detail-value amount">
                      {formatCurrency(selectedSale.total_amount)}
                    </span>
                  </div>

                  {selectedSale.amount_paid && selectedSale.amount_paid > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Amount Already Paid:</span>
                      <span className="detail-value paid">
                        {formatCurrency(selectedSale.amount_paid)}
                      </span>
                    </div>
                  )}

                  <div className="detail-row balance-row">
                    <span className="detail-label">Remaining Balance:</span>
                    <span className="detail-value balance">
                      {formatCurrency(selectedSale.total_amount - (selectedSale.amount_paid || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {selectedSale.items && selectedSale.items.length > 0 && (
                <div className="items-section">
                  <h4>Items Purchased</h4>
                  <div className="items-table">
                    <div className="items-header">
                      <span>Product</span>
                      <span>Qty</span>
                      <span>Price</span>
                    </div>
                    {selectedSale.items.map((item, idx) => (
                      <div key={idx} className="item-row">
                        <span>{item.product?.name || 'Unknown'}</span>
                        <span>{item.quantity}</span>
                        <span>{formatCurrency(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="payment-section">
                <div className="payment-input-group">
                  <label>Record Payment:</label>
                  <input
                    type="number"
                    placeholder={`Max: ${formatCurrency(selectedSale.total_amount - (selectedSale.amount_paid || 0))}`}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="payment-input"
                    disabled={processingId === selectedSale.id}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handlePayment}
                  disabled={processingId === selectedSale.id}
                >
                  {processingId === selectedSale.id ? 'Processing...' : 'Clear Bill'}
                </button>
              </div>

              {isAdmin && (
                <div className="admin-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleMarkCleared(selectedSale.id)}
                    disabled={processingId === selectedSale.id}
                  >
                    Mark as Cleared
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteSale(selectedSale.id)}
                    disabled={processingId === selectedSale.id}
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>Select a credit sale to manage payment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
