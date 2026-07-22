import { Product, Category } from '../types';
import '../styles/InventoryValueModal.css';

interface Props {
  products: Product[];
  categories: Category[];
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

export default function InventoryValueModal({ products, categories, onClose }: Props) {
  const totalUnits = products.reduce((sum, p) => sum + p.quantity_in_stock, 0);
  const totalRetailValue = products.reduce((sum, p) => sum + p.unit_price * p.quantity_in_stock, 0);
  const totalCostValue = products.reduce((sum, p) => sum + (p.buying_price ?? 0) * p.quantity_in_stock, 0);
  const potentialProfit = totalRetailValue - totalCostValue;
  const missingCostData = products.some(p => !p.buying_price);

  const categoryBreakdown = categories
    .map(cat => {
      const catProducts = products.filter(p => p.category === cat.name);
      return {
        name: cat.name,
        count: catProducts.length,
        units: catProducts.reduce((sum, p) => sum + p.quantity_in_stock, 0),
        value: catProducts.reduce((sum, p) => sum + p.unit_price * p.quantity_in_stock, 0),
      };
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="value-modal-overlay" onClick={onClose}>
      <div className="value-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Total Inventory Value</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="value-modal-body">
          <div className="inventory-stats">
            <div className="stat-card">
              <span className="stat-label">Retail Value</span>
              <span className="stat-value">{fmt(totalRetailValue)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Cost Value</span>
              <span className="stat-value">{fmt(totalCostValue)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Potential Profit</span>
              <span className="stat-value">{fmt(potentialProfit)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Products</span>
              <span className="stat-value">{products.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Units In Stock</span>
              <span className="stat-value">{totalUnits.toLocaleString()}</span>
            </div>
          </div>

          {missingCostData && (
            <p className="value-caveat">
              * Cost value and profit exclude products with no recorded buying price.
            </p>
          )}

          {categoryBreakdown.length > 0 && (
            <div className="value-breakdown">
              <h4>By Category</h4>
              <div className="value-table-wrap">
                <table className="value-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Products</th>
                      <th>Units</th>
                      <th>Retail Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map(cat => (
                      <tr key={cat.name}>
                        <td>{cat.name}</td>
                        <td>{cat.count}</td>
                        <td>{cat.units.toLocaleString()}</td>
                        <td>{fmt(cat.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
