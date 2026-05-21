import { useEffect, useState } from 'react';
import { Sale } from '../types';
import { supabaseService, supabase } from '../services/supabase';
import '../styles/CreditSalesPage.css';

export default function CreditSalesPage() {
  const [creditSales, setCreditSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethodForRecord, setPaymentMethodForRecord] = useState<'cash' | 'mobile_money'>('cash');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<{
    saleId: string;
    customerName: string;
    amount: number;
    method: 'cash' | 'mobile_money';
    remaining: number;
    paidAt: string;
  } | null>(null);

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
      const creditOnlySales = allSales.filter((sale) => {
        if (sale.payment_method !== 'credit') return false;
        const paid = sale.amount_paid || 0;
        const remaining = (sale.total_amount || 0) - paid;
        // include if DB marks pending OR there is still remaining amount > 0
        return sale.status === 'pending' || remaining > 0;
      });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale details');
    }
  };

  const printReceipt = () => {
    if (!latestReceipt) {
      return;
    }

    const padCenter = (text: string, width: number = 40) => {
      const padding = Math.max(0, width - text.length);
      const left = Math.floor(padding / 2);
      return ' '.repeat(left) + text + ' '.repeat(padding - left);
    };

    const padRight = (left: string, right: string, width: number = 40) => {
      const gap = Math.max(1, width - left.length - right.length);
      return left + ' '.repeat(gap) + right;
    };

    const receiptText = `${padCenter('='.repeat(40), 40)}
${padCenter('MKULIMA AGROVET POS', 40)}
${padCenter('Point of Sale System', 40)}
${padCenter('='.repeat(40), 40)}
${padCenter('Off Kisumu-Kakamega Road', 40)}
${padCenter('Kiboswa, Kenya', 40)}
${padCenter('Tel: 0722 843 544', 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter('SETTLEMENT RECEIPT', 40)}
${padCenter('-'.repeat(40), 40)}
${padRight('Sale ID:', latestReceipt.saleId, 40)}
${padRight('Customer:', latestReceipt.customerName || 'Walk-in Customer', 40)}
${padRight('Payment Method:', latestReceipt.method.replace('_', ' ').toUpperCase(), 40)}
${padRight('Amount Paid:', formatCurrency(latestReceipt.amount), 40)}
${padRight('Remaining Balance:', formatCurrency(latestReceipt.remaining), 40)}
${padRight('Paid At:', new Date(latestReceipt.paidAt).toLocaleString('en-KE'), 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter('Thank you for shopping with us!', 40)}
${padCenter('Visit us again soon', 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter(new Date().toLocaleString('en-KE'), 40)}
${padCenter('='.repeat(40), 40)}`;

    const content = `
      <html>
        <head>
          <title>Settlement Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 10px 8px; font-family: monospace; background: #fff; }
            pre { margin: 0; white-space: pre-wrap; font-size: 12px; line-height: 1.35; }
          </style>
        </head>
        <body>
          <pre>${receiptText}</pre>
        </body>
      </html>
    `;

    const receiptWindow = window.open('', '_blank', 'width=360,height=700');
    if (receiptWindow) {
      receiptWindow.document.write(content);
      receiptWindow.document.close();
      receiptWindow.focus();
      receiptWindow.print();
    }
  };

  const handlePayment = async () => {
    if (!selectedSale) {
      setError('No sale selected');
      return;
    }

    const amount = parseFloat(paymentAmount || '0');
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

      // Create a credit payment record. createCreditPayment returns the payment and the updated sale when using Supabase.
      const result = await supabaseService.createCreditPayment(selectedSale.id, {
        amount,
        payment_method: paymentMethodForRecord,
        payment_channel: paymentMethodForRecord,
      });

      // Prefer returned sale from the service (DB trigger may update sale). Fallback to re-fetch if necessary.
      const refreshed = result?.sale
        ? (result.sale as Sale)
        : await supabaseService.getSaleById(selectedSale.id);

      const newPaid = refreshed.amount_paid || 0;
      const remaining = Math.max(0, refreshed.total_amount - newPaid);
      const isFullyPaid = newPaid >= refreshed.total_amount;

      setLatestReceipt({
        saleId: refreshed.id,
        customerName: refreshed.customer_name || 'Walk-in Customer',
        amount,
        method: paymentMethodForRecord,
        remaining,
        paidAt: new Date().toISOString(),
      });

      const successMessage = isFullyPaid
        ? `Bill cleared successfully! Payment of ${formatCurrency(amount)} received.`
        : `Payment of ${formatCurrency(amount)} recorded. Remaining: ${formatCurrency(remaining)}`;
      setMessage(successMessage);

      // Refresh list and UI
      await loadCreditSales();

      if (isFullyPaid) {
        // If fully paid, remove selection to clear the panel
        setSelectedSale(null);
      } else {
        setSelectedSale(refreshed);
      }

      setPaymentAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

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
              <h3>Settle Credit Sale</h3>
              <div style={{ padding: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <div><strong>Customer:</strong> {selectedSale.customer_name || 'Walk-in'}</div>
                  <div><strong>Contact:</strong> {selectedSale.customer_contact || '-'}</div>
                  <div><strong>Original:</strong> {formatCurrency(selectedSale.total_amount)}</div>
                  <div><strong>Paid:</strong> {formatCurrency(selectedSale.amount_paid || 0)}</div>
                  <div><strong>Balance:</strong> {formatCurrency(Math.max(0, selectedSale.total_amount - (selectedSale.amount_paid || 0)))}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Enter amount"
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
                  <button
                    className="btn btn-primary"
                    onClick={handlePayment}
                    disabled={processingId === selectedSale.id || (selectedSale.total_amount - (selectedSale.amount_paid || 0)) <= 0}
                  >
                    {processingId === selectedSale.id ? 'Processing...' : 'Submit Payment'}
                  </button>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => printReceipt()}
                    disabled={!latestReceipt || latestReceipt.saleId !== selectedSale.id}
                  >
                    Print Receipt
                  </button>
                  <button
                    className="btn"
                    onClick={() => (window.location.href = '/')}
                  >
                    Back to POS
                  </button>
                </div>
              </div>
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
