import { useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale, SalePaymentMethod } from '../services/checkout';
import '../styles/Cart.css';

interface CartProps {
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
  onCreditCheckout: () => void;
}

export default function Cart({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onCheckoutSuccess,
  onCreditCheckout,
}: CartProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<Exclude<SalePaymentMethod, 'credit'>>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  const discountAmount = (() => {
    const val = parseFloat(discountInput) || 0;
    if (val <= 0) return 0;
    if (discountType === 'percent') return Math.min(subtotal, (subtotal * Math.min(val, 100)) / 100);
    return Math.min(subtotal, val);
  })();

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

      const receipt = await completeSale({
        items,
        total,
        paymentMethod,
        user,
      });

      setDiscountInput('');
      setDiscountType('fixed');
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
      <h2>Shopping Cart</h2>

      <div className="cart-items">
        {items.length === 0 ? (
          <p className="empty-cart">Cart is empty</p>
        ) : (
          items.map(item => (
            <div key={item.productId} className="cart-item">
              <div className="item-details">
                <strong>{item.product.name}</strong>
                <p className="item-sku">{item.product.sku}</p>
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
                  max={item.product.quantity_in_stock}
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
                  onClick={() => onUpdateQuantity(item.productId, Math.min(item.product.quantity_in_stock, item.quantity + 1))}
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
                  <span>{fmt(item.unit_price)}</span>
                  <span>×</span>
                  <span>{item.quantity}</span>
                </div>
                <div className="subtotal">{fmt(item.subtotal)}</div>
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

            <div className="discount-row">
              <span className="discount-label">Discount</span>
              <div className="discount-controls">
                <input
                  type="number"
                  min="0"
                  className="discount-input"
                  placeholder="0"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  disabled={processingPayment}
                />
                <button
                  className={`disc-type-btn${discountType === 'fixed' ? ' active' : ''}`}
                  onClick={() => setDiscountType('fixed')}
                  type="button"
                >Ksh</button>
                <button
                  className={`disc-type-btn${discountType === 'percent' ? ' active' : ''}`}
                  onClick={() => setDiscountType('percent')}
                  type="button"
                >%</button>
              </div>
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
