import { useEffect, useMemo, useState } from 'react';
import { DaySalesReport, Sale, UserRole } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/ReportsPage.css';

type CashierOption = {
  key: string;
  name: string;
  role: UserRole | 'unknown';
  label: string;
};

const COMPANY_NAME = 'MKULIMA AGROVET FARM LTD';
const COMPANY_ADDRESS = 'Off Kisumu-Kakamega Road, Kiboswa, Kenya';
const COMPANY_CONTACT = 'Tel: 0722 843 544';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(value);

  const getCashierName = (sale: Sale) => {
  const anySale = sale as Sale & {
    cashier_name?: string;
    created_by_name?: string;
    created_by?: string;
    username?: string;
    cashiers?: { display_name?: string; username?: string };
  };
  return anySale.cashier_name || anySale.created_by_name || anySale.cashiers?.display_name || anySale.created_by || anySale.username || 'Unknown';
};

const getCashierRole = (sale: Sale): UserRole | 'unknown' => {
  const anySale = sale as Sale & {
    cashier_role?: UserRole;
    role?: UserRole;
  };
  return anySale.cashier_role || anySale.role || 'unknown';
};

const getCashierKey = (sale: Sale) => `${getCashierName(sale).trim().toLowerCase()}__${getCashierRole(sale)}`;

const buildCashierOptions = (sales: Sale[]): CashierOption[] => {
  const options = new Map<string, CashierOption>();

  for (const sale of sales) {
    const name = getCashierName(sale);
    const role = getCashierRole(sale);
    const key = getCashierKey(sale);
    const label = role === 'unknown' ? name : `${name} (${role})`;

    if (!options.has(key)) {
      options.set(key, { key, name, role, label });
    }
  }

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export default function ReportsPage() {
  const [report, setReport] = useState<DaySalesReport | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCashierKey, setSelectedCashierKey] = useState<string>('all');

  useEffect(() => {
    void loadReportAndSales();
  }, [selectedDate]);

  const loadReportAndSales = async () => {
    try {
      setLoadingReport(true);
      setReportError(null);

      const [reportData, salesData] = await Promise.all([
        supabaseService.getDaySalesReport(selectedDate),
        supabaseService.getSalesForDate(selectedDate),
      ]);

      setReport(reportData);
      setSales(salesData || []);
      const cashierOptions = buildCashierOptions(salesData || []);
      if (cashierOptions.length > 0) {
        setSelectedCashierKey(current => (current === 'all' ? cashierOptions[0].key : current));
      } else {
        setSelectedCashierKey('all');
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  };

  const cashierOptions = useMemo(() => buildCashierOptions(sales), [sales]);

  const filteredSales = useMemo(() => {
    if (selectedCashierKey === 'all') {
      return sales;
    }
    return sales.filter(sale => getCashierKey(sale) === selectedCashierKey);
  }, [sales, selectedCashierKey]);

  const selectedCashierLabel = useMemo(() => {
    if (selectedCashierKey === 'all') {
      return 'All Cashiers';
    }
    return cashierOptions.find(option => option.key === selectedCashierKey)?.label || 'Selected Cashier';
  }, [cashierOptions, selectedCashierKey]);

  const selectedCashierName = useMemo(() => {
    if (selectedCashierKey === 'all') {
      return 'All Cashiers';
    }
    return cashierOptions.find(option => option.key === selectedCashierKey)?.name || 'Unknown';
  }, [cashierOptions, selectedCashierKey]);

  const generatePrintableReport = () => {
    const rows = filteredSales.map(sale => {
      const items = (sale.items || []).map(item => `${item.product?.name || 'Item'} x ${item.quantity}`).join('; ');
      return `<tr><td>${new Date(sale.sale_date).toLocaleTimeString()}</td><td>${sale.id.substring(0, 8).toUpperCase()}</td><td>${getCashierName(sale)}</td><td>${items}</td><td>${formatCurrency(sale.total_amount)}</td><td>${sale.payment_method}</td></tr>`;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Cashier Report - ${selectedCashierLabel} - ${selectedDate}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #1f2937; }
            .header { text-align: center; margin-bottom: 18px; }
            .title { margin: 0; font-size: 22px; font-weight: 800; }
            .subtitle { margin-top: 6px; font-size: 13px; color: #555; }
            .meta { margin-top: 4px; font-size: 13px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { padding: 8px 10px; border: 1px solid #d1d5db; text-align: left; vertical-align: top; }
            th { background: #2c3e50; color: #fff; }
            .small { font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${COMPANY_NAME}</h1>
            <div class="subtitle">Point of Sale System</div>
            <div class="meta">${COMPANY_ADDRESS}</div>
            <div class="meta">${COMPANY_CONTACT}</div>
            <div class="meta"><strong>Cashier Report:</strong> ${selectedCashierLabel}</div>
            <div class="meta small">Date: ${selectedDate}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Receipt</th>
                <th>Cashier</th>
                <th>Items Sold</th>
                <th>Amount</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>`;

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const downloadReportPdf = async () => {
    // jsPDF (and its html2canvas/DOMPurify dependencies) are loaded on demand
    // to keep them out of the initial bundle for low-end devices.
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const usableWidth = pageWidth - margin * 2;
    const lineHeight = 6;

    const ensureSpace = (neededHeight: number, y: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        return margin;
      }
      return y;
    };

    let y = margin;

    const addCenteredLine = (text: string, fontSize = 12, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, usableWidth);
      y = ensureSpace(lines.length * lineHeight + 2, y);
      doc.text(lines, pageWidth / 2, y, { align: 'center' });
      y += lines.length * lineHeight + 1;
    };

    const addLeftLine = (text: string, fontSize = 11, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, usableWidth);
      y = ensureSpace(lines.length * lineHeight + 2, y);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 1;
    };

    const drawTableHeader = () => {
      y = ensureSpace(14, y);
      doc.setFillColor(44, 62, 80);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      const columns = [
        { label: 'Time', width: 22 },
        { label: 'Receipt', width: 24 },
        { label: 'Cashier', width: 32 },
        { label: 'Items Sold', width: 70 },
        { label: 'Amount', width: 28 },
        { label: 'Payment', width: 24 },
      ];

      let x = margin;
      const headerY = y;
      const headerHeight = 8;

      for (const column of columns) {
        doc.rect(x, headerY - 5, column.width, headerHeight, 'F');
        doc.text(column.label, x + 1.5, headerY);
        x += column.width;
      }

      y += 8;
      doc.setTextColor(0, 0, 0);
    };

    const drawRow = (sale: Sale) => {
      const columns = [
        { value: new Date(sale.sale_date).toLocaleTimeString(), width: 22 },
        { value: sale.id.substring(0, 8).toUpperCase(), width: 24 },
        { value: getCashierName(sale), width: 32 },
        { value: (sale.items || []).map(item => `${item.product?.name || 'Item'} x ${item.quantity}`).join('; '), width: 70 },
        { value: formatCurrency(sale.total_amount), width: 28 },
        { value: sale.payment_method, width: 24 },
      ];

      const wrapped = columns.map(column => doc.splitTextToSize(column.value, column.width - 2));
      const rowHeight = Math.max(...wrapped.map(lines => lines.length)) * 5 + 4;
      y = ensureSpace(rowHeight + 2, y);

      let x = margin;
      const startY = y;
      for (let i = 0; i < columns.length; i += 1) {
        doc.rect(x, startY - 4, columns[i].width, rowHeight);
        doc.text(wrapped[i], x + 1.5, startY);
        x += columns[i].width;
      }
      y += rowHeight;
    };

    addCenteredLine(COMPANY_NAME, 15, true);
    addCenteredLine('Point of Sale System', 11, false);
    addCenteredLine(COMPANY_ADDRESS, 10, false);
    addCenteredLine(COMPANY_CONTACT, 10, false);
    addCenteredLine(`Cashier Report: ${selectedCashierLabel}`, 12, true);
    addCenteredLine(`Date: ${selectedDate}`, 10, false);
    addCenteredLine('Report includes items sold, amount, and payment method for each transaction.', 9, false);

    y += 3;
    drawTableHeader();

    if (filteredSales.length === 0) {
      addLeftLine('No sales found for the selected cashier/date.', 11, false);
    } else {
      for (const sale of filteredSales) {
        drawRow(sale);
      }
    }

    const fileName = `cashier-report-${selectedCashierName.replace(/\s+/g, '_')}-${selectedDate}.pdf`;
    doc.save(fileName);
  };

  if (loadingReport) return <div className="page-loader">Loading report...</div>;

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

      {reportError && <div className="error-message">{reportError}</div>}

      <div className="report-summary">
        <div className="report-card">
          <h3>Total Sales</h3>
          <div className="card-value">{formatCurrency(report.total_revenue)}</div>
        </div>
        <div className="report-card">
          <h3>Transactions</h3>
          <div className="card-value">{report.transactions_count}</div>
        </div>
      </div>

      <div className="report-grid">
        <div className="report-section">
          <h3>Payment Methods Breakdown</h3>
          <div className="payment-breakdown">
            {Object.entries(report.payment_breakdown).map(([method, amount]) => (
              <div key={method} className="breakdown-row">
                <span className="method-label">{method}</span>
                <span className="method-amount">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-section">
          <h3>Reports Per Cashier</h3>
          <div className="cashier-controls">
            <label htmlFor="cashier-select" className="cashier-label">Cashier:</label>
            <select
              id="cashier-select"
              value={selectedCashierKey}
              onChange={e => setSelectedCashierKey(e.target.value)}
              className="cashier-select"
            >
              <option value="all">All Cashiers</option>
              {cashierOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={generatePrintableReport}>
              Open Printable
            </button>
            <button className="btn btn-primary" onClick={downloadReportPdf}>
              Download PDF
            </button>
          </div>

          <table className="top-products-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Receipt</th>
                <th>Cashier</th>
                <th>Items Sold</th>
                <th>Amount</th>
                <th>Payment Method</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => (
                <tr key={sale.id}>
                  <td>{new Date(sale.sale_date).toLocaleTimeString()}</td>
                  <td>{sale.id.substring(0, 8).toUpperCase()}</td>
                  <td>{getCashierName(sale)}</td>
                  <td>{(sale.items || []).map(i => `${i.product?.name || 'Item'} x ${i.quantity}`).join('; ')}</td>
                  <td>{formatCurrency(sale.total_amount)}</td>
                  <td>{sale.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
