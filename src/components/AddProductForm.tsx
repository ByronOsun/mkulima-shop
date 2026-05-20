import { useState } from 'react';
import { Category, Product } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/AddProductForm.css';

interface AddProductFormProps {
  categories: Category[];
  onProductAdded: (product: Product) => void;
  onClose: () => void;
}

type QuantityMode = 'single' | 'dozen';

export default function AddProductForm({
  categories,
  onProductAdded,
  onClose,
}: AddProductFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityMode, setQuantityMode] = useState<QuantityMode>('single');
  const [quantityPerDozen, setQuantityPerDozen] = useState('12');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    if (!category) {
      setError('Category is required');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (quantityMode === 'dozen' && (!quantityPerDozen || parseFloat(quantityPerDozen) <= 0)) {
      setError('Quantity per bulk unit must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      const finalQuantity =
        quantityMode === 'dozen'
          ? Math.round(parseFloat(quantity) * parseFloat(quantityPerDozen))
          : Math.round(parseFloat(quantity));

      const newProduct = await supabaseService.addProduct({
        name: name.trim(),
        category,
        unit_price: parseFloat(price),
        quantity_in_stock: finalQuantity,
        sku: `SKU-${Date.now()}`,
        description: '',
        reorder_level: Math.max(Math.round(finalQuantity * 0.2), 1),
      });

      onProductAdded(newProduct);
      setName('');
      setPrice('');
      setQuantity('');
      setQuantityPerDozen('12');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Product</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="form-layout">
          <div className="form-group">
            <label htmlFor="name">Product Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Dairy Meal 50kg"
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={loading}
              className="form-input"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="price">Price (KSH) *</label>
            <input
              id="price"
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="quantity-section">
            <div className="quantity-mode">
              <label>Quantity Mode *</label>
              <div className="mode-buttons">
                <button
                  type="button"
                  className={`mode-btn ${quantityMode === 'single' ? 'active' : ''}`}
                  onClick={() => setQuantityMode('single')}
                  disabled={loading}
                >
                  Single Items
                </button>
                <button
                  type="button"
                  className={`mode-btn ${quantityMode === 'dozen' ? 'active' : ''}`}
                  onClick={() => setQuantityMode('dozen')}
                  disabled={loading}
                >
                  Bulk
                </button>
              </div>
            </div>

            {quantityMode === 'single' ? (
              <div className="form-group">
                <label htmlFor="quantity">Quantity (Units) *</label>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="e.g., 100"
                  min="0"
                  step="1"
                  disabled={loading}
                  className="form-input"
                />
              </div>
            ) : (
              <div className="dozen-group">
                <div className="form-group">
                  <label htmlFor="quantity">Quantity *</label>
                  <input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="e.g., 5"
                    min="0"
                    step="1"
                    disabled={loading}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quantityPerDozen">Items Per Bulk Unit *</label>
                  <input
                    id="quantityPerDozen"
                    type="number"
                    value={quantityPerDozen}
                    onChange={e => setQuantityPerDozen(e.target.value)}
                    placeholder="12"
                    min="1"
                    step="1"
                    disabled={loading}
                    className="form-input"
                  />
                </div>

                <div className="total-display">
                  <span>Total Units:</span>
                  <span className="total-value">
                    {quantity && quantityPerDozen
                      ? Math.round(parseFloat(quantity) * parseFloat(quantityPerDozen))
                      : 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
