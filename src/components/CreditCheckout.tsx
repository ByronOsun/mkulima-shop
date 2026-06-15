import { useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale } from '../services/checkout';
import '../styles/Cart.css';
import '../styles/CreditCheckout.css';

interface CreditCheckoutProps {
  items: CartItem[];
  onBack: () => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
}

export default function CreditCheckout({ items, onBack, onCheckoutSuccess }: CreditCheckoutProps) {
  const { user } = useAuth();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'cash' | 'mobile_money'>('cash');

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  const handleCompleteSale = async () => {
    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    try {
      setProcessingPayment(true);
      setError(null);

      const amountPaid = parseFloat(initialPayment || '0') || 0;

      const receipt = await completeSale({
        items,
        total,
        paymentMethod: 'credit',
        user,
        customerName,
        customerContact,
        amountPaid,
        initialPaymentMethod,
      });

      onCheckoutSuccess(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="credit-checkout-page">
      <div className="credit-checkout-header">
        <button type="button" className="credit-back-btn" onClick={onBack} disabled={processingPayment}>
          ← Back to Cart
        </button>
        <h2>Credit Sale</h2>
      </div>

      <div className="credit-checkout-content">
        <div className="credit-checkout-panel">
          <h3>Order Summary</h3>
          <div className="credit-checkout-items">
            {items.length === 0 ? (
              <p className="empty-cart">Cart is empty</p>
            ) : (
              items.map(item => (
                <div key={item.productId} className="credit-checkout-item">
                  <div className="credit-checkout-item-name">
                    {item.product.name}
                    <span className="credit-checkout-item-qty"> × {item.quantity}</span>
                  </div>
                  <div className="credit-checkout-item-subtotal">{formatCurrency(item.subtotal)}</div>
                </div>
              ))
            )}
          </div>
          <div className="credit-checkout-total">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="credit-checkout-panel">
          <h3>Customer Details</h3>

          <div className="credit-field">
            <label htmlFor="cc-customer-name">Customer Name</label>
            <input
              id="cc-customer-name"
              type="text"
              placeholder="e.g. John Mwangi"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="credit-input"
              disabled={processingPayment}
            />
          </div>

          <div className="credit-field">
            <label htmlFor="cc-customer-phone">Customer Phone</label>
            <input
              id="cc-customer-phone"
              type="text"
              placeholder="e.g. 0712 345 678"
              value={customerContact}
              onChange={e => setCustomerContact(e.target.value)}
              className="credit-input"
              disabled={processingPayment}
            />
          </div>

          <div className="credit-row">
            <div className="credit-field">
              <label htmlFor="cc-initial-payment">Initial Payment (optional)</label>
              <input
                id="cc-initial-payment"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={initialPayment}
                onChange={e => setInitialPayment(e.target.value)}
                className="credit-input"
                disabled={processingPayment}
              />
            </div>
            <div className="credit-field">
              <label htmlFor="cc-initial-payment-method">Payment Method</label>
              <select
                id="cc-initial-payment-method"
                value={initialPaymentMethod}
                onChange={e => setInitialPaymentMethod(e.target.value as 'cash' | 'mobile_money')}
                className="credit-input"
                disabled={processingPayment}
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="checkout-btn"
            onClick={handleCompleteSale}
            disabled={processingPayment || items.length === 0}
          >
            {processingPayment ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}
