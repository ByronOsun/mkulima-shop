import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { DaySalesReport, Product } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/ReportsPage.css';

export default function ReportsPage() {
  const [report, setReport] = useState<DaySalesReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [stockMessage, setStockMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadReport();
    void loadStockItems();
  }, [selectedDate]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);

  const loadReport = async () => {
    try {
      setLoadingReport(true);
      setReportError(null);
      const data = await supabaseService.getDaySalesReport(selectedDate);
      setReport(data);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  };

  const loadStockItems = async () => {
    try {
      setLoadingStock(true);
      setStockError(null);
      const data = await supabaseService.getProducts();
      setProducts(data || []);

      const defaultSelections: Record<string, boolean> = {};
      const defaultQuantities: Record<string, number> = {};

      for (const product of data || []) {
        if (product.quantity_in_stock <= product.reorder_level) {
          defaultSelections[product.id] = true;
          defaultQuantities[product.id] = Math.max(product.reorder_level - product.quantity_in_stock, 1);
        }
      }

      setSelectedProducts(defaultSelections);
      setRestockQuantities(defaultQuantities);
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Failed to load stock items');
    } finally {
      setLoadingStock(false);
    }
  };

  const lowStockProducts = useMemo(
    () => products.filter(product => product.quantity_in_stock <= product.reorder_level),
    [products]
  );

  const groupedStock = useMemo(() => {
    const map = new Map<string, Product[]>();

    for (const product of lowStockProducts) {
      const items = map.get(product.category) ?? [];
      items.push(product);
      map.set(product.category, items);
    }

    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, items]) => ({
        category,
        items: items.sort((left, right) => left.name.localeCompare(right.name)),
      }));
  }, [lowStockProducts]);

  const selectedLowStockItems = lowStockProducts.filter(product => selectedProducts[product.id] !== false);
  const isLoading = loadingReport || loadingStock;

  const handleQuantityChange = (productId: string, value: number) => {
    setRestockQuantities(current => ({
      ...current,
      [productId]: Math.max(1, value),
    }));
    setSelectedProducts(current => ({
      ...current,
      [productId]: true,
    }));
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(current => ({
      ...current,
      [productId]: !(current[productId] ?? true),
    }));
  };

  const confirmStock = async (product: Product) => {
    const restockQty = restockQuantities[product.id] ?? Math.max(product.reorder_level - product.quantity_in_stock, 1);

    try {
      setProcessingIds(current => ({ ...current, [product.id]: true }));
      setStockMessage(null);
      await supabaseService.receiveStock(
        product.id,
        restockQty,
        `Requisition ${selectedDate}`,
        `Received for ${product.name}`
      );
      await Promise.all([loadStockItems(), loadReport()]);
      setStockMessage(`${product.name} restocked successfully.`);
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Failed to confirm stock');
    } finally {
      setProcessingIds(current => ({ ...current, [product.id]: false }));
    }
  };

  const confirmAllStock = async () => {
    if (selectedLowStockItems.length === 0) {
      return;
    }

    try {
      setStockError(null);
      setStockMessage(null);
      for (const product of selectedLowStockItems) {
        if (processingIds[product.id]) continue;
        const restockQty = restockQuantities[product.id] ?? Math.max(product.reorder_level - product.quantity_in_stock, 1);
        await supabaseService.receiveStock(
          product.id,
          restockQty,
          `Requisition ${selectedDate}`,
          `Received for ${product.name}`
        );
      }
      await Promise.all([loadStockItems(), loadReport()]);
      setStockMessage('All selected stock items confirmed and inventory updated.');
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Failed to confirm stock');
    }
  };

  const downloadRequisitionPdf = () => {
    if (selectedLowStockItems.length === 0) {
      setStockError('Select at least one product to download the requisition PDF.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 7;
    let y = 18;

    const ensureSpace = (spaceNeeded = 12) => {
      if (y + spaceNeeded > pageHeight - 14) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Mkulima Agrovet - Stock Requisition', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Date: ${selectedDate}`, margin, y);
    y += 7;
    doc.text('Prepared by: Administrator', margin, y);
    y += 10;

    for (const group of groupedStock) {
      const selectedGroupItems = group.items.filter(product => selectedProducts[product.id] !== false);
      if (selectedGroupItems.length === 0) continue;

      ensureSpace(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(group.category, margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Product', margin, y);
      doc.text('Qty Needed', pageWidth - margin - 10, y, { align: 'right' });
      y += 4;
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const product of selectedGroupItems) {
        const qty = restockQuantities[product.id] ?? Math.max(product.reorder_level - product.quantity_in_stock, 1);
        ensureSpace(14);
        doc.text(product.name, margin, y);
        doc.text(String(qty), pageWidth - margin - 10, y, { align: 'right' });
        y += lineHeight;
      }

      y += 4;
    }

    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, pageHeight - 10);
    doc.save(`stock-requisition-${selectedDate}.pdf`);
  };

  if (isLoading) return <div className="page-loader">Loading report...</div>;

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

      {(reportError || stockError) && <div className="error-message">{reportError || stockError}</div>}
      {stockMessage && <div className="success-message">{stockMessage}</div>}

      <div className="report-summary">
        <div className="report-card">
          <h3>Total Sales</h3>
          <div className="card-value">{formatCurrency(report.total_revenue)}</div>
        </div>
        <div className="report-card">
          <h3>Transactions</h3>
          <div className="card-value">{report.transactions_count}</div>
        </div>
        <div className="report-card">
          <h3>Average Sale</h3>
          <div className="card-value">
            {report.transactions_count > 0
              ? formatCurrency(report.total_revenue / report.transactions_count)
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="stock-section">
        <div className="stock-header">
          <div>
            <h3>Stock Requisition</h3>
            <p>Grouped by category, ready for supplier ordering and receiving.</p>
          </div>
          <div className="stock-actions">
            <button className="stock-btn secondary" onClick={downloadRequisitionPdf} disabled={selectedLowStockItems.length === 0}>
              Download PDF
            </button>
            <button className="stock-btn" onClick={confirmAllStock} disabled={selectedLowStockItems.length === 0}>
              Confirm All
            </button>
          </div>
        </div>

        <div className="stock-summary">
          <div className="stock-summary-card">
            <span className="stock-summary-label">Pending Items</span>
            <span className="stock-summary-value">{selectedLowStockItems.length}</span>
          </div>
          <div className="stock-summary-card">
            <span className="stock-summary-label">Categories</span>
            <span className="stock-summary-value">{groupedStock.length}</span>
          </div>
          <div className="stock-summary-card">
            <span className="stock-summary-label">Est. Stock Value</span>
            <span className="stock-summary-value">
              {formatCurrency(
                selectedLowStockItems.reduce((sum, product) => {
                  const qty = restockQuantities[product.id] ?? Math.max(product.reorder_level - product.quantity_in_stock, 1);
                  return sum + qty * product.unit_price;
                }, 0)
              )}
            </span>
          </div>
        </div>

        <div className="stock-groups">
          {groupedStock.map(group => {
            const selectedGroupItems = group.items.filter(product => selectedProducts[product.id] !== false);

            return (
              <section key={group.category} className="stock-group">
                <div className="stock-group-header">
                  <h4>{group.category}</h4>
                  <span>{selectedGroupItems.length} selected</span>
                </div>

                <div className="stock-items">
                  {group.items.map(product => {
                    const qty = restockQuantities[product.id] ?? Math.max(product.reorder_level - product.quantity_in_stock, 1);
                    const isSelected = selectedProducts[product.id] !== false;

                    return (
                      <div key={product.id} className={`stock-item ${isSelected ? 'selected' : ''}`}>
                        <div className="stock-item-main">
                          <label className="stock-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProduct(product.id)}
                            />
                          </label>
                          <div className="stock-item-info">
                            <strong>{product.name}</strong>
                            <span>SKU {product.sku}</span>
                            <span>
                              Current: {product.quantity_in_stock} / Reorder: {product.reorder_level}
                            </span>
                          </div>
                        </div>

                        <div className="stock-item-controls">
                          <label>
                            Qty to restock
                            <input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) => handleQuantityChange(product.id, Number(e.target.value) || 1)}
                            />
                          </label>
                          <button
                            className="stock-btn"
                            onClick={() => confirmStock(product)}
                            disabled={!isSelected || processingIds[product.id]}
                          >
                            {processingIds[product.id] ? 'Confirming...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
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
                  <td>{formatCurrency(product.unit_price)}</td>
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
