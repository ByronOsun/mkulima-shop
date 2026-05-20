import { useState, useEffect } from 'react';
import { DaySalesReport } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/ReportsPage.css';

export default function ReportsPage() {
  const [report, setReport] = useState<DaySalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadReport();
  }, [selectedDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getDaySalesReport(selectedDate);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loader">Loading report...</div>;

  if (!report) {
    return (
      <div className="reports-page">
        <div className="report-header">
          <h2>Sales Reports</h2>
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
        <p className="no-data">No data available for the selected date</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="report-header">
        <h2>Sales Reports</h2>
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

      {error && <div className="error-message">{error}</div>}

      <div className="report-summary">
        <div className="report-card">
          <h3>Total Sales</h3>
          <div className="card-value">
            {new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
            }).format(report.total_revenue)}
          </div>
        </div>
        <div className="report-card">
          <h3>Transactions</h3>
          <div className="card-value">{report.transactions_count}</div>
        </div>
        <div className="report-card">
          <h3>Average Sale</h3>
          <div className="card-value">
            {report.transactions_count > 0
              ? new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                }).format(report.total_revenue / report.transactions_count)
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="report-grid">
        <div className="report-section">
          <h3>Payment Methods Breakdown</h3>
          <div className="payment-breakdown">
            {Object.entries(report.payment_breakdown).map(([method, amount]) => (
              <div key={method} className="breakdown-row">
                <span className="method-label">{method}</span>
                <span className="method-amount">
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                  }).format(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-section">
          <h3>Top Selling Products</h3>
          <table className="top-products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {report.top_products?.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                    }).format(product.unit_price)}
                  </td>
                  <td>{product.quantity_in_stock} units</td>
                </tr>
              )) || []}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
