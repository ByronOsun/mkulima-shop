import { useState } from 'react';
import { Product, Category } from '../types';
import '../styles/EditProductModal.css';

interface EditProductModalProps {
  product: Product;
  categories: Category[];
  onSave: (updatedProduct: Partial<Product>) => void;
  onClose: () => void;
}

export default function EditProductModal({
  product,
  categories,
  onSave,
  onClose,
}: EditProductModalProps) {
  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    sku: product.sku,
    unit_price: product.unit_price,
    quantity_in_stock: product.quantity_in_stock,
    reorder_level: product.reorder_level,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const parsedNumber = parseFloat(value) || 0;

    setFormData(prev => ({
      ...prev,
      [name]: name === 'unit_price' || name === 'quantity_in_stock' || name === 'reorder_level'
        ? name === 'unit_price'
          ? Math.round(parsedNumber)
          : parsedNumber
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }

    if (formData.unit_price <= 0) {
      setError('Unit price must be greater than 0');
      return;
    }

    if (formData.quantity_in_stock < 0) {
      setError('Stock quantity cannot be negative');
      return;
    }

    if (formData.reorder_level < 0) {
      setError('Reorder level cannot be negative');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        ...formData,
        unit_price: Math.round(formData.unit_price),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Product</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Product Name *</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Product description (optional)"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sku">SKU *</label>
              <input
                id="sku"
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Stock Keeping Unit"
                required
                disabled
              />
              <small>SKU cannot be changed</small>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="unit_price">Unit Price (KES) *</label>
              <input
                id="unit_price"
                type="number"
                name="unit_price"
                value={formData.unit_price}
                onChange={handleChange}
                placeholder="0"
                step="1"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="quantity_in_stock">Stock Quantity *</label>
              <input
                id="quantity_in_stock"
                type="number"
                name="quantity_in_stock"
                value={formData.quantity_in_stock}
                onChange={handleChange}
                placeholder="0"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reorder_level">Reorder Level *</label>
              <input
                id="reorder_level"
                type="number"
                name="reorder_level"
                value={formData.reorder_level}
                onChange={handleChange}
                placeholder="0"
                min="0"
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
