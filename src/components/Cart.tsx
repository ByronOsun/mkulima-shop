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

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

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
                  className="remove-btn"
                  onClick={() => onRemoveItem(item.productId)}
                  title="Remove item"
                >
                  ✕
                </button>
              </div>
              <div className="item-pricing">
                <div className="price-row">
                  <span>
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                    }).format(item.unit_price)}
                  </span>
                  <span>×</span>
                  <span>{item.quantity}</span>
                </div>
                <div className="subtotal">
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                  }).format(item.subtotal)}
                </div>
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
              <span>
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                }).format(total)}
              </span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span className="total-amount">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                }).format(total)}
              </span>
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
