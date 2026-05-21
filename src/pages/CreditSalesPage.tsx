import { useEffect, useState } from 'react';
import { Sale } from '../types';
import { supabaseService, supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CreditSalesPage.css';

export default function CreditSalesPage() {
  const { user } = useAuth();
  const [creditSales, setCreditSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editableCustomerName, setEditableCustomerName] = useState<string>('');
  const [editableCustomerContact, setEditableCustomerContact] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethodForRecord, setPaymentMethodForRecord] = useState<'cash' | 'mobile_money'>('cash');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    void loadCreditSales();
  }, []);

  // Subscribe to sales changes (realtime) so new credit sales appear immediately.
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let channel: any = null;

    if (supabase) {
      try {
        // v2 realtime: use channel/postgres_changes where available
        // Fallback to from().on for older clients via any cast
        if ((supabase as any).channel) {
          channel = (supabase as any)
            .channel('public:sales')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload: any) => {
              const row = payload?.new || payload?.record || null;
              if (!row) return;
              if (row.payment_method === 'credit') {
                void loadCreditSales();
              }
            })
            .subscribe();
        } else if ((supabase as any).from) {
          // older API
          channel = (supabase as any)
            .from('sales')
            .on('*', (payload: any) => {
              const row = payload?.new || payload?.record || null;
              if (!row) return;
              if (row.payment_method === 'credit') {
                void loadCreditSales();
              }
            })
            .subscribe();
        }
      } catch (err) {
        // ignore and fall back to polling
        console.warn('Realtime subscription failed, falling back to polling', err);
      }
    }

    // polling fallback for demo mode or if realtime isn't available
    if (!channel) {
      pollInterval = setInterval(() => {
        void loadCreditSales();
      }, 10000);
    }

    return () => {
      try {
        if (channel && (supabase as any).removeChannel) {
          (supabase as any).removeChannel(channel);
        } else if (channel && (supabase as any).from && (channel as any).unsubscribe) {
          (channel as any).unsubscribe();
        }
      } catch (_) {
        // noop
      }
      if (pollInterval) clearInterval(pollInterval);
    };
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

  const loadSelectedSaleDetails = async (saleId: string) => {
    try {
      const detailedSale = await supabaseService.getSaleById(saleId);
      setSelectedSale(detailedSale);
      setEditableCustomerName(detailedSale.customer_name || '');
      setEditableCustomerContact(detailedSale.customer_contact || '');
      setEditingCustomer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale details');
    }
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

      // Create a credit payment record (trigger updates to sale via DB trigger or demo fallback)
      await supabaseService.createCreditPayment(selectedSale.id, {
        amount,
        payment_method: paymentMethodForRecord,
        payment_channel: paymentMethodForRecord,
      });

      // Refresh the list and selected sale
      await loadCreditSales();
      const refreshed = (await supabaseService.getSalesBetweenDates(new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0])).find(s => s.id === selectedSale.id);
      if (refreshed) {
        setSelectedSale(refreshed);
        const newPaid = refreshed.amount_paid || 0;
        const isFullyPaid = newPaid >= refreshed.total_amount;
        const successMessage = isFullyPaid
          ? `Bill cleared successfully! Payment of ${formatCurrency(amount)} received.`
          : `Payment of ${formatCurrency(amount)} recorded. Remaining: ${formatCurrency(refreshed.total_amount - newPaid)}`;
        setMessage(successMessage);
      }
      setPaymentAmount('');
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
                      setPaymentAmount('');
                      void loadSelectedSaleDetails(sale.id);
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

                    {isSelected && sale.items && sale.items.length > 0 && (
                      <div className="transaction-items-preview">
                        <div className="preview-title">Products sold</div>
                        {sale.items.map((item) => (
                          <div key={`${sale.id}-${item.productId}`} className="preview-item-row">
                            <span className="preview-item-name">
                              {item.product?.name || 'Unknown product'}
                            </span>
                            <span className="preview-item-meta">
                              {item.quantity} × {formatCurrency(item.unit_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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
                  {editingCustomer ? (
                    <div className="customer-edit">
                      <input
                        type="text"
                        value={editableCustomerName}
                        onChange={(e) => setEditableCustomerName(e.target.value)}
                        placeholder="Customer name"
                        className="credit-input"
                      />
                      <input
                        type="text"
                        value={editableCustomerContact}
                        onChange={(e) => setEditableCustomerContact(e.target.value)}
                        placeholder="Customer phone"
                        className="credit-input"
                      />
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={async () => {
                            if (!selectedSale) return;
                            try {
                              setProcessingId(selectedSale.id);
                              const updated = await supabaseService.updateSaleDetails(selectedSale.id, {
                                customer_name: editableCustomerName || undefined,
                                customer_contact: editableCustomerContact || undefined,
                                updated_at: new Date().toISOString(),
                              });
                              setSelectedSale({ ...selectedSale, ...updated });
                              setMessage('Customer details saved');
                              setEditingCustomer(false);
                              await loadCreditSales();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to save details');
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingCustomer(false);
                            if (selectedSale) {
                              setEditableCustomerName(selectedSale.customer_name || '');
                              setEditableCustomerContact(selectedSale.customer_contact || '');
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingCustomer(true);
                            setEditableCustomerName(selectedSale.customer_name || '');
                            setEditableCustomerContact(selectedSale.customer_contact || '');
                          }}
                        >
                          Edit Customer
                        </button>
                      </div>
                    </>
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

                {/* Show settle option when fully paid (available to cashier and admin) */}
                {selectedSale.amount_paid && selectedSale.amount_paid >= selectedSale.total_amount && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleMarkCleared(selectedSale.id)}
                      disabled={processingId === selectedSale.id}
                    >
                      Settle Bill
                    </button>
                  </div>
                )}
                <div className="payment-input-group">
                  <label>Record Payment:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      placeholder={`Max: ${formatCurrency(selectedSale.total_amount - (selectedSale.amount_paid || 0))}`}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="payment-input"
                      disabled={processingId === selectedSale.id}
                    />
                    <select
                      value={paymentMethodForRecord}
                      onChange={(e) => setPaymentMethodForRecord(e.target.value as 'cash' | 'mobile_money')}
                      className="payment-input"
                      disabled={processingId === selectedSale.id}
                    >
                      <option value="cash">Cash</option>
                      <option value="mobile_money">Mobile Money</option>
                    </select>
                  </div>
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
