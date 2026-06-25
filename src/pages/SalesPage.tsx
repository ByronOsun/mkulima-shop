import { useState, useEffect } from 'react';
import { ReceiptData, Sale } from '../types';
import { supabaseService } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SalesPage.css';

interface SalesPageProps {
  onOpenReceipt: (receipt: ReceiptData) => void;
}

export default function SalesPage({ onOpenReceipt }: SalesPageProps) {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadSales();
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

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const paymentMethods = sales.reduce((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const buildReceiptFromSale = (sale: Sale): ReceiptData => ({
    saleId: sale.id,
    receiptNumber: sale.id.substring(0, 8).toUpperCase(),
    saleDate: sale.sale_date,
    paymentMethod: sale.payment_method,
    totalAmount: sale.total_amount,
    cashierRole: 'cashier',
    cashierName: 'Archived Transaction',
    tenantConfig: user?.tenantConfig,
    items: (sale.items || []).map(item => ({
      productId: item.productId,
      name: item.product?.name || 'Unknown Item',
      sku: item.product?.sku || '',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
  });

  const openReceipt = async (sale: Sale) => {
    try {
      const detailedSale = sale.items && sale.items.length > 0 ? sale : await supabaseService.getSaleById(sale.id);
      if (!detailedSale) {
        return;
      }
      onOpenReceipt(buildReceiptFromSale(detailedSale));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt');
    }
  };

  if (loading) return <div className="page-loader">Loading sales...</div>;

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h2>Sales Transactions</h2>
        <div className="date-selector">
          <label>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="date-input"
          />
        </div>
      </div>

      <div className="sales-summary">
        <div className="summary-card">
          <span className="summary-label">Total Transactions</span>
          <span className="summary-value">{sales.length}</span>
        </div>
        <div className="summary-card highlight">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">
            {new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
            }).format(totalRevenue)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average Transaction</span>
          <span className="summary-value">
            {sales.length > 0
              ? new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                }).format(totalRevenue / sales.length)
              : 'N/A'}
          </span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="payment-breakdown">
        <h3>Payment Methods</h3>
        <div className="payment-stats">
          {Object.entries(paymentMethods).map(([method, count]) => (
            <div key={method} className="payment-stat">
              <span className="method-name">{method}</span>
              <span className="method-count">{count} transactions</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sales-table">
        <h3>Sales Transactions</h3>
        {sales.length === 0 ? (
          <p className="no-data">No sales found for this date</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Receipt</th>
                <th>Items</th>
                <th>Total Amount</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr key={sale.id}>
                  <td>
                    {new Date(sale.sale_date).toLocaleTimeString()}
                  </td>
                  <td className="receipt-id">Receipt #{sale.id.substring(0, 8).toUpperCase()}</td>
                  <td>{sale.items?.length || 0} items</td>
                  <td className="amount">
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                    }).format(sale.total_amount)}
                  </td>
                  <td>{sale.payment_method}</td>
                  <td>
                    <span className={`status-badge ${sale.status}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="receipt-link-btn"
                      onClick={() => void openReceipt(sale)}
                    >
                      View / Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
