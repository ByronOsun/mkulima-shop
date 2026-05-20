import { useState } from 'react';
import { Product } from '../types';
import '../styles/ProductCard.css';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductList({ products, onAddToCart }: ProductListProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAddClick = (product: Product) => {
    const qty = quantities[product.id] || 1;
    if (qty > 0 && qty <= product.quantity_in_stock) {
      onAddToCart(product, qty);
      setQuantities({ ...quantities, [product.id]: 0 });
    }
  };

  const handleQuantityChange = (productId: string, value: number) => {
    setQuantities({ ...quantities, [productId]: Math.max(0, value) });
  };

  if (products.length === 0) {
    return (
      <div className="empty-products">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map(product => (
        <div
          key={product.id}
          className={`product-card ${
            product.quantity_in_stock === 0 ? 'out-of-stock' : ''
          }`}
        >
          {product.image_url && (
            <div className="product-image">
              <img src={product.image_url} alt={product.name} />
            </div>
          )}
          <div className="product-info">
            <h3 className="product-name">{product.name}</h3>
            <p className="product-sku">SKU: {product.sku}</p>
            {product.description && (
              <p className="product-description">{product.description}</p>
            )}
            <div className="product-details">
              <span className="product-price">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                }).format(product.unit_price)}
              </span>
              <span className={`stock-badge ${
                product.quantity_in_stock > 5 ? 'in-stock' : 'low-stock'
              }`}>
                {product.quantity_in_stock} in stock
              </span>
            </div>
          </div>
          <div className="product-action">
            <input
              type="number"
              min="0"
              max={product.quantity_in_stock}
              value={quantities[product.id] || 0}
              onChange={e =>
                handleQuantityChange(product.id, parseInt(e.target.value) || 0)
              }
              className="quantity-input"
              disabled={product.quantity_in_stock === 0}
              placeholder="Qty"
            />
            <button
              className="add-btn"
              onClick={() => handleAddClick(product)}
              disabled={
                product.quantity_in_stock === 0 ||
                (quantities[product.id] || 0) === 0
              }
            >
              Add to Cart
            </button>
          </div>
          {product.quantity_in_stock === 0 && (
            <div className="out-of-stock-overlay">Out of Stock</div>
          )}
        </div>
      ))}
    </div>
  );
}
