import { useEffect, useMemo, useState } from 'react';
import { Sale, UserRole } from '../types';
import { supabaseService } from '../services/supabase';
import { savePdf } from '../services/pdf';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ReportsPage.css';

const today = new Date().toISOString().split('T')[0];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

const formatPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

type CashierOption = { key: string; name: string; role: UserRole | 'unknown'; label: string };

const getCashierName = (sale: Sale) => {
  const s = sale as Sale & Record<string, any>;
  return s.cashier_name || s.created_by_name || s.cashiers?.display_name || s.created_by || s.username || 'Unknown';
};

const getCashierRole = (sale: Sale): UserRole | 'unknown' => {
  const s = sale as Sale & Record<string, any>;
  return s.cashier_role || s.role || 'unknown';
};

const getCashierKey = (sale: Sale) =>
  `${getCashierName(sale).trim().toLowerCase()}__${getCashierRole(sale)}`;

const buildCashierOptions = (sales: Sale[]): CashierOption[] => {
  const options = new Map<string, CashierOption>();
  for (const sale of sales) {
    const name = getCashierName(sale);
    const role = getCashierRole(sale);
    const key = getCashierKey(sale);
    const label = role === 'unknown' ? name : `${name} (${role})`;
    if (!options.has(key)) options.set(key, { key, name, role, label });
  }
  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export default function ReportsPage() {
  const { user } = useAuth();
  const tc = user?.tenantConfig;

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCashierKey, setSelectedCashierKey] = useState<string>('all');

  useEffect(() => {
    void loadSales();
  }, [fromDate, toDate]);

  const loadSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getSalesBetweenDates(fromDate, toDate);
      setSales(data || []);
      const options = buildCashierOptions(data || []);
      setSelectedCashierKey(prev => {
        const stillExists = options.some(o => o.key === prev);
        return stillExists ? prev : (options.length > 0 ? options[0].key : 'all');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = useMemo(() => sales.reduce((s, sale) => s + sale.total_amount, 0), [sales]);

  const paymentBreakdown = useMemo(() =>
    sales.reduce((acc, sale) => {
      acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total_amount;
      return acc;
    }, {} as Record<string, number>),
    [sales]
  );

  const cashierOptions = useMemo(() => buildCashierOptions(sales), [sales]);

  const filteredSales = useMemo(() =>
    selectedCashierKey === 'all'
      ? sales
      : sales.filter(s => getCashierKey(s) === selectedCashierKey),
    [sales, selectedCashierKey]
  );

  const daysInPeriod = useMemo(() => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return Math.max(Math.round((to.getTime() - from.getTime()) / 86400000) + 1, 1);
  }, [fromDate, toDate]);

  const productSummary = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      unitsSold: number;
      sellingPrice: number;
      buyingPrice: number | undefined;
      totalRevenue: number;
    }>();

    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const key = item.productId;
        const existing = map.get(key);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.totalRevenue += item.subtotal;
        } else {
          map.set(key, {
            productId: item.productId,
            productName: item.product?.name || 'Unknown Product',
            unitsSold: item.quantity,
            sellingPrice: item.unit_price,
            buyingPrice: item.product?.buying_price,
            totalRevenue: item.subtotal,
          });
        }
      }
    }

    return Array.from(map.values())
      .map(p => {
        const cogs = p.buyingPrice !== undefined ? p.buyingPrice * p.unitsSold : undefined;
        const grossProfit = cogs !== undefined ? p.totalRevenue - cogs : undefined;
        const margin = grossProfit !== undefined && p.totalRevenue > 0
          ? (grossProfit / p.totalRevenue) * 100 : undefined;
        const markup = p.buyingPrice !== undefined && p.buyingPrice > 0
          ? ((p.sellingPrice - p.buyingPrice) / p.buyingPrice) * 100 : undefined;
        const velocity = p.unitsSold / daysInPeriod;
        return { ...p, cogs, grossProfit, margin, markup, velocity };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [sales, daysInPeriod]);

  const summaryTotals = useMemo(() => {
    const withBP = productSummary.filter(p => p.cogs !== undefined);
    const grossProfit = withBP.reduce((s, p) => s + (p.grossProfit ?? 0), 0);
    const cogs = withBP.reduce((s, p) => s + (p.cogs ?? 0), 0);
    const revenue = productSummary.reduce((s, p) => s + p.totalRevenue, 0);
    const overallMargin = revenue > 0 && withBP.length > 0 ? (grossProfit / revenue) * 100 : undefined;
    return {
      units: productSummary.reduce((s, p) => s + p.unitsSold, 0),
      revenue,
      cogs,
      grossProfit,
      overallMargin,
      hasBPData: withBP.length > 0,
    };
  }, [productSummary]);

  const selectedCashierLabel = useMemo(() =>
    selectedCashierKey === 'all'
      ? 'All Cashiers'
      : cashierOptions.find(o => o.key === selectedCashierKey)?.label || 'Selected Cashier',
    [cashierOptions, selectedCashierKey]
  );

  const selectedCashierName = useMemo(() =>
    selectedCashierKey === 'all'
      ? 'All'
      : cashierOptions.find(o => o.key === selectedCashierKey)?.name || 'Unknown',
    [cashierOptions, selectedCashierKey]
  );

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    // Landscape A4 gives 273 mm usable width — enough for all columns without clipping
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();   // 297 mm
    const ph = doc.internal.pageSize.getHeight();  // 210 mm
    const mg = 12;
    const uw = pw - mg * 2;  // 273 mm

    const ensureSpace = (need: number, curY: number) => {
      if (curY + need > ph - mg) { doc.addPage(); return mg; }
      return curY;
    };

    let y = mg;

    const centerText = (text: string, fs = 12, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fs);
      const lines = doc.splitTextToSize(text, uw);
      y = ensureSpace(lines.length * 6 + 2, y);
      doc.text(lines, pw / 2, y, { align: 'center' });
      y += lines.length * 6 + 1;
    };

    const leftText = (text: string, fs = 10, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fs);
      const lines = doc.splitTextToSize(text, uw);
      y = ensureSpace(lines.length * 6 + 2, y);
      doc.text(lines, mg, y);
      y += lines.length * 6 + 1;
    };

    // ── Report header ──
    if (tc?.shopName) centerText(tc.shopName, 15, true);
    centerText('Point of Sale System', 10);
    if (tc?.address) centerText(tc.address, 9);
    if (tc?.phone) centerText(tc.phone, 9);
    centerText(`Cashier Report: ${selectedCashierLabel}`, 12, true);
    const pdfPeriodLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
    centerText(`Period: ${pdfPeriodLabel}`, 10);
    y += 4;

    // ── Helper: draw a table header row ──
    const drawHeader = (
      cols: { label: string; w: number }[],
      fillR: number, fillG: number, fillB: number,
      fs = 8
    ) => {
      const rowH = 8;
      y = ensureSpace(rowH + 4, y);
      const totalW = cols.reduce((s, c) => s + c.w, 0);
      // Fill entire header band in one rect first
      doc.setFillColor(fillR, fillG, fillB);
      doc.rect(mg, y - 5, totalW, rowH, 'F');
      // Draw text on top
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fs);
      let x = mg;
      for (const col of cols) {
        doc.text(col.label, x + 1.5, y);
        x += col.w;
      }
      // Draw column dividers
      doc.setDrawColor(255, 255, 255);
      x = mg;
      for (const col of cols) {
        doc.line(x, y - 5, x, y - 5 + rowH);
        x += col.w;
      }
      doc.line(x, y - 5, x, y - 5 + rowH);
      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);
      y += 5;
    };

    // ── Helper: draw a data row ──
    const drawRow = (
      cols: { label: string; w: number }[],
      vals: string[],
      fs = 8,
      lineH = 5,
      altShade = false
    ) => {
      const wrapped = vals.map((v, i) => doc.splitTextToSize(v, cols[i].w - 3));
      const rh = Math.max(...wrapped.map(l => l.length)) * lineH + 4;
      y = ensureSpace(rh + 2, y);
      const ry = y;
      const totalW = cols.reduce((s, c) => s + c.w, 0);
      if (altShade) {
        doc.setFillColor(248, 249, 252);
        doc.rect(mg, ry - 4, totalW, rh, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fs);
      let x = mg;
      for (let i = 0; i < cols.length; i++) {
        doc.rect(x, ry - 4, cols[i].w, rh);
        doc.text(wrapped[i], x + 1.5, ry);
        x += cols[i].w;
      }
      y += rh;
    };

    // ── Transaction log ──
    // Total = 22+25+35+131+30+30 = 273 mm
    const txCols = [
      { label: 'Time',       w: 22 },
      { label: 'Receipt',    w: 25 },
      { label: 'Cashier',    w: 35 },
      { label: 'Items Sold', w: 131 },
      { label: 'Amount',     w: 30 },
      { label: 'Payment',    w: 30 },
    ];

    centerText('Transaction Log', 11, true);
    drawHeader(txCols, 30, 41, 59);  // dark navy

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    if (filteredSales.length === 0) {
      leftText('No transactions found for this period.', 9);
    } else {
      filteredSales.forEach((sale, idx) => {
        const vals = [
          new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sale.id.substring(0, 8).toUpperCase(),
          getCashierName(sale),
          (sale.items || []).map(i => `${i.product?.name || 'Item'} ×${i.quantity}`).join('; '),
          formatCurrency(sale.total_amount),
          sale.payment_method.replace(/_/g, ' '),
        ];
        drawRow(txCols, vals, 8, 5, idx % 2 === 1);
      });
    }

    // ── Product Performance & Profitability ──
    // Total = 8+50+16+26+26+22+28+26+28+20+23 = 273 mm
    const prCols = [
      { label: '#',             w: 8  },
      { label: 'Product',       w: 50 },
      { label: 'Units',         w: 16 },
      { label: 'Buy Price',     w: 26 },
      { label: 'Sell Price',    w: 26 },
      { label: 'Markup %',      w: 22 },
      { label: 'Revenue',       w: 28 },
      { label: 'COGS',          w: 26 },
      { label: 'Gross Profit',  w: 28 },
      { label: 'Margin %',      w: 20 },
      { label: 'Daily Velocity',w: 23 },
    ];

    y += 6;
    y = ensureSpace(20, y);
    centerText('Product Performance & Profitability', 11, true);
    centerText(
      `Gross profit and margin require buying prices to be set per product. Velocity = units/day.`,
      8
    );
    y += 2;
    drawHeader(prCols, 55, 65, 140);  // indigo

    if (productSummary.length === 0) {
      leftText('No products sold in this period.', 9);
    } else {
      productSummary.forEach((p, idx) => {
        const vals = [
          String(idx + 1),
          p.productName,
          String(p.unitsSold),
          p.buyingPrice !== undefined ? formatCurrency(p.buyingPrice) : '—',
          formatCurrency(p.sellingPrice),
          p.markup !== undefined ? formatPct(p.markup) : '—',
          formatCurrency(p.totalRevenue),
          p.cogs !== undefined ? formatCurrency(p.cogs) : '—',
          p.grossProfit !== undefined ? formatCurrency(p.grossProfit) : '—',
          p.margin !== undefined ? `${p.margin.toFixed(1)}%` : '—',
          `${p.velocity.toFixed(1)}/day`,
        ];
        drawRow(prCols, vals, 7.5, 4.5, idx % 2 === 1);
      });

      // Totals row
      y = ensureSpace(12, y);
      const totalW = prCols.reduce((s, c) => s + c.w, 0);
      doc.setFillColor(230, 232, 255);
      doc.rect(mg, y - 5, totalW, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 120);
      const totVals = [
        '',
        'TOTALS',
        String(summaryTotals.units),
        '', '', '',
        formatCurrency(summaryTotals.revenue),
        summaryTotals.hasBPData ? formatCurrency(summaryTotals.cogs) : '—',
        summaryTotals.hasBPData ? formatCurrency(summaryTotals.grossProfit) : '—',
        summaryTotals.overallMargin !== undefined
          ? `${summaryTotals.overallMargin.toFixed(1)}%` : '—',
        '',
      ];
      let x = mg;
      for (let i = 0; i < prCols.length; i++) {
        doc.rect(x, y - 5, prCols[i].w, 9);
        doc.text(totVals[i], x + 1.5, y);
        x += prCols[i].w;
      }
      doc.setTextColor(0, 0, 0);
      y += 7;
    }

    await savePdf(doc, `report-${selectedCashierName}-${fromDate}-${toDate}.pdf`);
  };

  if (loading) return <div className="page-loader">Loading report...</div>;

  const periodLabel = fromDate === toDate ? fromDate : `${fromDate} — ${toDate}`;

  return (
    <div className="reports-page">

      {/* ── Header ── */}
      <div className="report-header">
        <h2>Sales Reports</h2>
        <div className="date-range-picker">
          <div className="date-field">
            <label>From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="date-input"
            />
          </div>
          <span className="date-sep">→</span>
          <div className="date-field">
            <label>To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={e => setToDate(e.target.value)}
              className="date-input"
            />
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── KPI Cards ── */}
      <div className="kpi-row">
        <div className="kpi-card accent-green">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value">{formatCurrency(totalRevenue)}</div>
          <div className="kpi-sub">{daysInPeriod} day{daysInPeriod !== 1 ? 's' : ''}</div>
        </div>
        <div className="kpi-card accent-blue">
          <div className="kpi-label">Transactions</div>
          <div className="kpi-value">{sales.length}</div>
          <div className="kpi-sub">total sales</div>
        </div>
        <div className="kpi-card accent-purple">
          <div className="kpi-label">Products Sold</div>
          <div className="kpi-value">{productSummary.length}</div>
          <div className="kpi-sub">unique items</div>
        </div>
        {summaryTotals.hasBPData && (
          <div className={`kpi-card ${summaryTotals.grossProfit >= 0 ? 'accent-teal' : 'accent-red'}`}>
            <div className="kpi-label">Gross Profit</div>
            <div className="kpi-value">{formatCurrency(summaryTotals.grossProfit)}</div>
            <div className="kpi-sub">
              {summaryTotals.overallMargin !== undefined
                ? `${summaryTotals.overallMargin.toFixed(1)}% margin`
                : '—'}
            </div>
          </div>
        )}
      </div>

      {/* ── Payment Breakdown ── */}
      <div className="report-section">
        <h3 className="section-title">Payment Methods Breakdown</h3>
        {Object.keys(paymentBreakdown).length === 0 ? (
          <p className="empty-msg">No payments recorded for this period.</p>
        ) : (
          <div className="payment-grid">
            {Object.entries(paymentBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([method, amount]) => {
                const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                return (
                  <div key={method} className="payment-row">
                    <span className={`pay-badge pay-${method}`}>{method.replace(/_/g, ' ')}</span>
                    <div className="pay-bar-wrap">
                      <div className="pay-bar" style={{ width: `${pct.toFixed(1)}%` }} />
                    </div>
                    <span className="pay-pct">{pct.toFixed(1)}%</span>
                    <span className="pay-amount">{formatCurrency(amount)}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Transaction Log ── */}
      <div className="report-section">
        <div className="section-topbar">
          <h3 className="section-title">Transaction Log</h3>
          <div className="cashier-controls">
            <label htmlFor="cashier-select">Cashier:</label>
            <select
              id="cashier-select"
              value={selectedCashierKey}
              onChange={e => setSelectedCashierKey(e.target.value)}
              className="cashier-select"
            >
              <option value="all">All Cashiers</option>
              {cashierOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={downloadPdf}>
              ⬇ Download PDF
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table tx-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Receipt</th>
                <th>Cashier</th>
                <th>Items Sold</th>
                <th>Amount</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No transactions found for this period.</td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id}>
                    <td className="nowrap">
                      {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="nowrap mono">{sale.id.substring(0, 8).toUpperCase()}</td>
                    <td>{getCashierName(sale)}</td>
                    <td className="items-cell">
                      <ul className="items-list">
                        {(sale.items || []).map((item, i) => (
                          <li key={i}>
                            <span className="item-name">{item.product?.name || 'Item'}</span>
                            <span className="item-qty"> × {item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="nowrap amount">{formatCurrency(sale.total_amount)}</td>
                    <td>
                      <span className={`pay-badge pay-${sale.payment_method}`}>
                        {sale.payment_method.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Product Profitability Summary ── */}
      <div className="report-section">
        <div className="section-topbar">
          <div>
            <h3 className="section-title">Product Performance &amp; Profitability</h3>
            <p className="section-desc">
              Aggregated sales per product for <strong>{periodLabel}</strong>.
              Gross profit, markup, and margin are derived from the buying price set per product.
              Daily velocity = units sold ÷ days in period.
            </p>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table profit-table">
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <th>Product</th>
                <th className="num-col">Units Sold</th>
                <th className="num-col">Buy Price</th>
                <th className="num-col">Sell Price</th>
                <th className="num-col">Markup</th>
                <th className="num-col">Total Revenue</th>
                <th className="num-col">Total COGS</th>
                <th className="num-col">Gross Profit</th>
                <th className="num-col">Margin</th>
                <th className="num-col">Daily Velocity</th>
              </tr>
            </thead>
            <tbody>
              {productSummary.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-row">No products sold in this period.</td>
                </tr>
              ) : (
                productSummary.map((p, i) => (
                  <tr
                    key={p.productId}
                    className={
                      p.grossProfit !== undefined
                        ? p.grossProfit >= 0 ? 'row-profit' : 'row-loss'
                        : ''
                    }
                  >
                    <td className="rank-col">{i + 1}</td>
                    <td className="product-col">{p.productName}</td>
                    <td className="num-col">{p.unitsSold}</td>
                    <td className="num-col">
                      {p.buyingPrice !== undefined
                        ? formatCurrency(p.buyingPrice)
                        : <span className="dash">—</span>}
                    </td>
                    <td className="num-col">{formatCurrency(p.sellingPrice)}</td>
                    <td className="num-col">
                      {p.markup !== undefined
                        ? <span className={`markup-tag ${p.markup >= 0 ? 'pos' : 'neg'}`}>{formatPct(p.markup)}</span>
                        : <span className="dash">—</span>}
                    </td>
                    <td className="num-col strong">{formatCurrency(p.totalRevenue)}</td>
                    <td className="num-col">
                      {p.cogs !== undefined
                        ? formatCurrency(p.cogs)
                        : <span className="dash">—</span>}
                    </td>
                    <td className={`num-col strong ${p.grossProfit !== undefined ? (p.grossProfit >= 0 ? 'text-profit' : 'text-loss') : ''}`}>
                      {p.grossProfit !== undefined
                        ? formatCurrency(p.grossProfit)
                        : <span className="dash">—</span>}
                    </td>
                    <td className="num-col">
                      {p.margin !== undefined
                        ? (
                          <span className={`margin-pill ${
                            p.margin >= 30 ? 'pill-high'
                            : p.margin >= 15 ? 'pill-mid'
                            : p.margin >= 0 ? 'pill-low'
                            : 'pill-neg'
                          }`}>
                            {p.margin.toFixed(1)}%
                          </span>
                        )
                        : <span className="dash">—</span>}
                    </td>
                    <td className="num-col velocity">{p.velocity.toFixed(1)}<span className="unit">/day</span></td>
                  </tr>
                ))
              )}
            </tbody>
            {productSummary.length > 0 && (
              <tfoot>
                <tr className="totals-row">
                  <td colSpan={2} className="totals-label">TOTALS</td>
                  <td className="num-col"><strong>{summaryTotals.units}</strong></td>
                  <td colSpan={3} />
                  <td className="num-col strong">{formatCurrency(summaryTotals.revenue)}</td>
                  <td className="num-col">
                    {summaryTotals.hasBPData ? <strong>{formatCurrency(summaryTotals.cogs)}</strong> : '—'}
                  </td>
                  <td className={`num-col strong ${summaryTotals.hasBPData ? (summaryTotals.grossProfit >= 0 ? 'text-profit' : 'text-loss') : ''}`}>
                    {summaryTotals.hasBPData ? formatCurrency(summaryTotals.grossProfit) : '—'}
                  </td>
                  <td className="num-col">
                    {summaryTotals.overallMargin !== undefined
                      ? <strong>{summaryTotals.overallMargin.toFixed(1)}%</strong>
                      : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {productSummary.some(p => p.buyingPrice === undefined) && (
          <div className="notice-bar">
            <span className="notice-icon">ℹ</span>
            Some products show "—" because no buying price has been set.
            Edit those products to unlock full profitability tracking.
          </div>
        )}
      </div>
    </div>
  );
}
