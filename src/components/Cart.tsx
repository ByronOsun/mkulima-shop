import { useState } from 'react';
import { CartItem, Product } from '../types';
import BarcodeScannerModal from './BarcodeScannerModal';
import '../styles/Cart.css';

interface CartProps {
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onProceedToCheckout: (items: CartItem[]) => void;
  products?: Product[];
  onAddToCart?: (product: Product, quantity: number) => void;
}

export default function Cart({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onProceedToCheckout,
  products,
  onAddToCart,
}: CartProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});

  const effectivePrice = (item: CartItem) => {
    const v = parseFloat(priceOverrides[item.productId]);
    return !isNaN(v) && v >= 0 ? v : item.unit_price;
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

  const handleCheckout = () => {
    const itemsWithPrices = items.map(item => {
      const ep = effectivePrice(item);
      return { ...item, unit_price: ep, subtotal: ep * item.quantity };
    });
    onProceedToCheckout(itemsWithPrices);
  };

  return (
    <div className="cart-container">
      <div className="cart-heading-row">
        <h2>Shopping Cart</h2>
        {products && onAddToCart && (
          <button
            className="cart-scan-btn"
            onClick={() => setShowScanner(true)}
            title="Scan product barcode"
            type="button"
          >
            <BarcodeIcon />
            Scan
          </button>
        )}
      </div>

      {showScanner && products && onAddToCart && (
        <BarcodeScannerModal
          products={products}
          onAddToCart={onAddToCart}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="cart-items">
        {items.length === 0 ? (
          <p className="empty-cart">Cart is empty</p>
        ) : (
          items.map(item => (
            <div key={item.productId} className="cart-item">
              <div className="item-top-row">
                <div className="item-details">
                  <strong>{item.product.name}</strong>
                </div>
                <div className="item-controls">
                  <button
                    className="qty-btn"
                    onClick={() => onUpdateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                    title="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => onUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                    className="qty-input"
                  />
                  <button
                    className="qty-btn"
                    onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                    title="Increase quantity"
                  >
                    +
                  </button>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveItem(item.productId)}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="item-pricing">
                <div className="price-row">
                  <span className="price-ksh-prefix">Ksh</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="price-override-input"
                    value={priceOverrides[item.productId] ?? item.unit_price}
                    onChange={e => setPriceOverrides(prev => ({ ...prev, [item.productId]: e.target.value }))}
                  />
                  <span>×</span>
                  <span>{item.quantity}</span>
                </div>
                <div className="subtotal">{fmt(effectivePrice(item) * item.quantity)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <button className="checkout-btn" onClick={handleCheckout}>
          Checkout →
        </button>
      )}
    </div>
  );
}

function BarcodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="1" y="4" width="2" height="16"/>
      <rect x="5" y="4" width="1" height="16"/>
      <rect x="8" y="4" width="2" height="16"/>
      <rect x="12" y="4" width="1" height="16"/>
      <rect x="15" y="4" width="2" height="16"/>
      <rect x="19" y="4" width="1" height="16"/>
      <rect x="22" y="4" width="1" height="16"/>
    </svg>
  );
}
