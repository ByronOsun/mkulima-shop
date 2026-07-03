import { useState } from 'react';
import { CartItem, Product, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale, SalePaymentMethod } from '../services/checkout';
import BarcodeScannerModal from './BarcodeScannerModal';
import '../styles/Cart.css';

interface CartProps {
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
  onCreditCheckout: () => void;
  products?: Product[];
  onAddToCart?: (product: Product, quantity: number) => void;
}

export default function Cart({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onCheckoutSuccess,
  onCreditCheckout,
  products,
  onAddToCart,
}: CartProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<Exclude<SalePaymentMethod, 'credit'>>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});

  const effectivePrice = (item: CartItem) => {
    const v = parseFloat(priceOverrides[item.productId]);
    return !isNaN(v) && v >= 0 ? v : item.unit_price;
  };

  const subtotal = items.reduce((sum, item) => sum + effectivePrice(item) * item.quantity, 0);

  const discountAmount = Math.min(subtotal, Math.max(0, parseFloat(discountInput) || 0));

  const total = Math.max(0, subtotal - discountAmount);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);



  const handlePaymentMethodChange = (value: string) => {
    if (value === 'credit') {
      onCreditCheckout();
      return;
    }
    setPaymentMethod(value as Exclude<SalePaymentMethod, 'credit'>);
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    try {
      setProcessingPayment(true);
      setError(null);

      const itemsToSell = items.map(item => {
        const ep = effectivePrice(item);
        return { ...item, unit_price: ep, subtotal: ep * item.quantity };
      });

      const receipt = await completeSale({
        items: itemsToSell,
        total,
        discountAmount,
        paymentMethod,
        user,
      });

      setDiscountInput('');
      setPriceOverrides({});
      onCheckoutSuccess(receipt);
      setSuccess(`Sale completed! Sale ID: ${receipt.saleId.substring(0, 8)}...`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessingPayment(false);
    }
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
                  onChange={e =>
                    onUpdateQuantity(
                      item.productId,
                      parseInt(e.target.value) || 0
                    )
                  }
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
                    disabled={processingPayment}
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
        <>
          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{fmt(subtotal)}</span>
            </div>

            <div className="discount-controls">
              <input
                type="number"
                min="0"
                className="discount-input"
                placeholder="Discount"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                disabled={processingPayment}
              />
              <span className="disc-ksh-label">Ksh</span>
              {discountAmount > 0 && (
                <span className="discount-saved">−{fmt(discountAmount)}</span>
              )}
            </div>

            <div className="summary-row total">
              <span>Total:</span>
              <span className="total-amount">{fmt(total)}</span>
            </div>
          </div>

          <div className="payment-section">
            <label>Payment Method:</label>
            <select
              value={paymentMethod}
              onChange={e => handlePaymentMethodChange(e.target.value)}
              className="payment-select"
              disabled={processingPayment}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="credit">Credit</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            className="checkout-btn"
            onClick={handleCheckout}
            disabled={processingPayment || items.length === 0}
          >
            {processingPayment ? 'Processing...' : 'Complete Sale'}
          </button>
        </>
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
