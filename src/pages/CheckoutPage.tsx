import { useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale, SalePaymentMethod } from '../services/checkout';
import '../styles/CheckoutPage.css';

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
  onCreditCheckout: () => void;
}

export default function CheckoutPage({ items, onBack, onCheckoutSuccess, onCreditCheckout }: CheckoutPageProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<Exclude<SalePaymentMethod, 'credit'>>('cash');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, parseFloat(discountInput) || 0));
  const total = Math.max(0, subtotal - discountAmount);

  const handlePaymentChange = (value: string) => {
    if (value === 'credit') { onCreditCheckout(); return; }
    setPaymentMethod(value as Exclude<SalePaymentMethod, 'credit'>);
  };

  const handleComplete = async () => {
    try {
      setProcessing(true);
      setError(null);
      const receipt = await completeSale({ items, total, discountAmount, paymentMethod, user });
      onCheckoutSuccess(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-header">
        <button className="checkout-back-btn" onClick={onBack}>← Back</button>
        <h2>Checkout</h2>
      </div>

      <div className="checkout-body">
        <div className="checkout-order-summary">
          <h3>Order Summary</h3>
          {items.map(item => (
            <div key={item.productId} className="checkout-item-row">
              <span className="checkout-item-name">{item.product.name}</span>
              <span className="checkout-item-qty">× {item.quantity}</span>
              <span className="checkout-item-price">{fmt(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="checkout-totals">
          <div className="checkout-summary-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>

          <div className="checkout-discount-row">
            <input
              type="number"
              min="0"
              className="checkout-discount-input"
              placeholder="Discount"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              disabled={processing}
            />
            <span className="checkout-ksh-label">Ksh</span>
            {discountAmount > 0 && (
              <span className="checkout-discount-saved">−{fmt(discountAmount)}</span>
            )}
          </div>

          <div className="checkout-summary-row checkout-total-row">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        <div className="checkout-payment">
          <label>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={e => handlePaymentChange(e.target.value)}
            className="checkout-payment-select"
            disabled={processing}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="credit">Credit</option>
          </select>
        </div>

        {error && <div className="checkout-error">{error}</div>}

        <button
          className="checkout-complete-btn"
          onClick={handleComplete}
          disabled={processing}
        >
          {processing ? 'Processing…' : 'Complete Sale'}
        </button>
      </div>
    </div>
  );
}
