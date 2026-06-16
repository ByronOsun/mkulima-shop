import { useState, useEffect } from 'react';
import { Product, Category } from '../types';
import { supabaseService } from '../services/supabase';
import AddProductForm from '../components/AddProductForm';
import EditProductModal from '../components/EditProductModal';
import '../styles/InventoryPage.css';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
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

  const loadCategories = async () => {
    try {
      const data = await supabaseService.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleProductAdded = (newProduct: Product) => {
    setProducts([newProduct, ...products]);
    setShowAddForm(false);
  };

  const handleEditProduct = async (updatedProduct: Partial<Product>) => {
    if (!editingProduct) return;
    
    try {
      await supabaseService.updateProduct(editingProduct.id, updatedProduct);
      setProducts(products.map(p => 
        p.id === editingProduct.id 
          ? { ...p, ...updatedProduct }
          : p
      ));
      setEditingProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await supabaseService.deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockProducts = filteredProducts.filter(
    p => p.quantity_in_stock <= p.reorder_level
  );

  if (loading) return <div className="page-loader">Loading inventory...</div>;

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <button
          className="btn-add-product"
          onClick={() => setShowAddForm(true)}
          title="Add new product to inventory"
        >
          + Add Product
        </button>
        <div className="inventory-stats">
          <div className="stat-card">
            <span className="stat-label">Total Products</span>
            <span className="stat-value">{products.length}</span>
          </div>
          <div className="stat-card alert">
            <span className="stat-label">Low Stock Items</span>
            <span className="stat-value">{lowStockProducts.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Stock Value</span>
            <span className="stat-value">
              {new Intl.NumberFormat('en-KE', {
                style: 'currency',
                currency: 'KES',
              }).format(
                products.reduce(
                  (sum, p) => sum + p.quantity_in_stock * p.unit_price,
                  0
                )
              )}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-section">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="inventory-table">
        <table>
          <thead>
            <tr>
              <th className="sku-col">SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>In Stock</th>
              <th>Reorder Level</th>
              <th>Stock Value</th>
              <th>Status</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className={
                product.quantity_in_stock <= product.reorder_level ? 'low-stock' : ''
              }>
                <td className="sku-col">{product.sku}</td>
                <td>
                  <strong>{product.name}</strong>
                  {product.description && (
                    <p className="description">{product.description}</p>
                  )}
                </td>
                <td>{product.category}</td>
                <td>
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                  }).format(product.unit_price)}
                </td>
                <td className="quantity">{product.quantity_in_stock}</td>
                <td>{product.reorder_level}</td>
                <td>
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                  }).format(product.quantity_in_stock * product.unit_price)}
                </td>
                <td>
                  <span className={`status-badge ${
                    product.quantity_in_stock > product.reorder_level
                      ? 'in-stock'
                      : 'low-stock'
                  }`}>
                    {product.quantity_in_stock > product.reorder_level
                      ? '✓ In Stock'
                      : '⚠ Low Stock'}
                  </span>
                </td>
                <td className="actions-cell">
                  <button
                    className="btn-edit"
                    onClick={() => setEditingProduct(product)}
                    title="Edit product"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteProduct(product.id)}
                    title="Delete product"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="alert-section">
          <h3>Items Below Reorder Level</h3>
          <div className="alert-items">
            {lowStockProducts.map(product => (
              <div key={product.id} className="alert-item">
                <span>{product.name}</span>
                <span className="quantity">{product.quantity_in_stock}/{product.reorder_level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <AddProductForm
          categories={categories}
          onProductAdded={handleProductAdded}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          categories={categories}
          onSave={handleEditProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}
