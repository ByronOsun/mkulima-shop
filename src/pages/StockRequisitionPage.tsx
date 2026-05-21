import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Product } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/StockRequisitionPage.css';


export default function StockRequisitionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stagedItems, setStagedItems] = useState<Record<string, number>>({});
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    void loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getProducts();
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();

    for (const product of products) {
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
  }, [products]);

  const stagedProducts = useMemo(() => {
    return products.filter(p => stagedItems[p.id]);
  }, [products, stagedItems]);

  const totalStockValue = useMemo(() => {
    return stagedProducts.reduce((sum, product) => {
      const qty = stagedItems[product.id] || 0;
      return sum + qty * product.unit_price;
    }, 0);
  }, [stagedProducts, stagedItems]);

  const handleStageProduct = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setStagedItems(current => {
        const updated = { ...current };
        delete updated[productId];
        return updated;
      });
    } else {
      setStagedItems(current => ({
        ...current,
        [productId]: Math.max(1, quantity),
      }));
    }
    setMessage(null);
  };

  const handleRemoveStaged = (productId: string) => {
    setStagedItems(current => {
      const updated = { ...current };
      delete updated[productId];
      return updated;
    });
  };

  const confirmRequisition = async (productId: string) => {
    const quantity = stagedItems[productId];
    if (!quantity) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      setProcessingIds(current => ({ ...current, [productId]: true }));
      setError(null);
      setMessage(null);

      await supabaseService.receiveStock(
        productId,
        quantity,
        'Stock Requisition',
        `Restocked ${quantity} units`
      );

      handleRemoveStaged(productId);
      setMessage(`${product.name} confirmed and inventory updated.`);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm stock');
    } finally {
      setProcessingIds(current => ({ ...current, [productId]: false }));
    }
  };

  const confirmAllRequisitions = async () => {
    if (stagedProducts.length === 0) return;

    try {
      setError(null);
      setMessage(null);

      for (const product of stagedProducts) {
        if (processingIds[product.id]) continue;
        const quantity = stagedItems[product.id];
        await supabaseService.receiveStock(
          product.id,
          quantity,
          'Stock Requisition',
          `Restocked ${quantity} units`
        );
      }

      setStagedItems({});
      setMessage('All staged items confirmed and inventory updated.');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm stock');
    }
  };

  const downloadRequisitionPdf = () => {
    if (stagedProducts.length === 0) {
      setError('No staged items to download.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 7;
    let y = 14;

    const ensureSpace = (spaceNeeded = 12) => {
      if (y + spaceNeeded > pageHeight - 14) {
        doc.addPage();
        y = 14;
      }
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MKULIMA AGROVET', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Farm Supply & Distribution', margin, y);
    y += 4;
    doc.text('Phone: +254 701 234 567', margin, y);
    y += 4;
    doc.text('Email: orders@mkulima.co.ke', margin, y);
    y += 4;
    doc.text('Location: Nairobi, Kenya', margin, y);
    y += 8;

    // Line separator
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('STOCK REQUISITION', margin, y);
    y += 8;

    // Details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const now = new Date();
    doc.text(`Date: ${now.toLocaleDateString()}`, margin, y);
    y += 4;
    doc.text(`Time: ${now.toLocaleTimeString()}`, margin, y);
    y += 4;
    doc.text(`Prepared by: Administrator`, margin, y);
    y += 8;

    // Grouped products by category
    const categorizedStagedProducts = new Map<string, Product[]>();
    for (const product of stagedProducts) {
      const items = categorizedStagedProducts.get(product.category) ?? [];
      items.push(product);
      categorizedStagedProducts.set(product.category, items);
    }

    const sortedCategories = Array.from(categorizedStagedProducts.entries()).sort(
      ([left], [right]) => left.localeCompare(right)
    );

    for (const [category, categoryProducts] of sortedCategories) {
      ensureSpace(20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(category, margin, y);
      y += 6;

      // Headers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Product', margin, y);
      doc.text('Qty', margin + 90, y);
      doc.text('Unit Price', margin + 120, y);
      doc.text('Total', pageWidth - margin - 20, y, { align: 'right' });
      y += 4;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // Products
      doc.setFont('helvetica', 'normal');
      let categoryTotal = 0;
      for (const product of categoryProducts) {
        const qty = stagedItems[product.id] || 0;
        const itemTotal = qty * product.unit_price;
        categoryTotal += itemTotal;

        ensureSpace(10);
        doc.text(product.name, margin, y);
        doc.text(String(qty), margin + 90, y, { align: 'right' });
        doc.text(`KES ${product.unit_price.toFixed(2)}`, margin + 120, y, { align: 'right' });
        doc.text(`KES ${itemTotal.toFixed(2)}`, pageWidth - margin - 20, y, { align: 'right' });
        y += lineHeight;
      }

      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text(`Category Total: KES ${categoryTotal.toFixed(2)}`, pageWidth - margin - 20, y, {
        align: 'right',
      });
      y += 8;
    }

    // Grand total
    ensureSpace(12);
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`GRAND TOTAL: KES ${totalStockValue.toFixed(2)}`, pageWidth - margin - 20, y, {
      align: 'right',
    });

    // Footer
    y = pageHeight - 16;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('This requisition is valid for 30 days from date of issue.', margin, y);
    y += 4;
    doc.text(`Generated: ${now.toLocaleString()}`, margin, y);

    doc.save(`stock-requisition-${now.toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <div className="page-loader">Loading products...</div>;

  return (
    <div className="stock-requisition-page">
      <div className="requisition-header">
        <h2>Stock Requisition</h2>
        <p>Select products to restock and prepare supplier orders</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="requisition-container">
        <div className="products-section">
          <h3>Available Products</h3>
          <div className="products-list">
            {groupedProducts.map(group => (
              <div key={group.category} className="product-category">
                <button
                  className="category-header"
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === group.category ? null : group.category
                    )
                  }
                >
                  <span className="category-arrow">
                    {expandedCategory === group.category ? '▼' : '▶'}
                  </span>
                  <span className="category-name">{group.category}</span>
                  <span className="category-count">({group.items.length})</span>
                </button>

                {expandedCategory === group.category && (
                  <div className="products-dropdown">
                    {group.items.map(product => {
                      const stagedQty = stagedItems[product.id];
                      const isStaged = !!stagedQty;

                      return (
                        <div
                          key={product.id}
                          className={`product-item ${isStaged ? 'staged' : ''}`}
                        >
                          <div className="product-info">
                            <strong>{product.name}</strong>
                            <span className="product-sku">SKU: {product.sku}</span>
                            <div className="product-details">
                              <span>Stock: {product.quantity_in_stock}</span>
                              <span>Reorder: {product.reorder_level}</span>
                              <span className="product-price">
                                KES {product.unit_price.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="product-controls">
                            <input
                              type="number"
                              min="0"
                              placeholder="Qty"
                              value={stagedQty || ''}
                              onChange={e =>
                                handleStageProduct(
                                  product.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="qty-input"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="staged-section">
          <div className="staged-header">
            <h3>Staged Items ({stagedProducts.length})</h3>
            <div className="staged-actions">
              <button
                className="btn btn-secondary"
                onClick={downloadRequisitionPdf}
                disabled={stagedProducts.length === 0}
              >
                📥 Download PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmAllRequisitions}
                disabled={stagedProducts.length === 0}
              >
                ✓ Confirm All
              </button>
            </div>
          </div>

          <div className="staged-summary">
            <div className="summary-card">
              <span className="summary-label">Total Items</span>
              <span className="summary-value">{stagedProducts.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Est. Total Value</span>
              <span className="summary-value">{formatCurrency(totalStockValue)}</span>
            </div>
          </div>

          <div className="staged-items">
            {stagedProducts.length === 0 ? (
              <p className="no-staged">No items staged yet. Select products above to get started.</p>
            ) : (
              stagedProducts.map(product => {
                const qty = stagedItems[product.id];
                const itemTotal = qty * product.unit_price;

                return (
                  <div key={product.id} className="staged-item">
                    <div className="item-info">
                      <strong>{product.name}</strong>
                      <span className="item-sku">SKU: {product.sku}</span>
                      <div className="item-pricing">
                        <span>Qty: {qty}</span>
                        <span>×</span>
                        <span>KES {product.unit_price.toFixed(2)}</span>
                        <span>=</span>
                        <span className="item-total">KES {itemTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="item-actions">
                      <button
                        className="btn btn-danger"
                        onClick={() => handleRemoveStaged(product.id)}
                      >
                        ✕
                      </button>
                      <button
                        className="btn btn-confirm"
                        onClick={() => confirmRequisition(product.id)}
                        disabled={processingIds[product.id]}
                      >
                        {processingIds[product.id] ? '...' : '✓'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
