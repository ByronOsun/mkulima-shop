import { useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale, SalePaymentMethod } from '../services/checkout';
import { mpesaService } from '../services/mpesa';
import MpesaPaymentModal from '../components/MpesaPaymentModal';
import '../styles/CheckoutPage.css';

// 'mpesa_stk' is a UI-only method — it maps to 'mobile_money' in the DB
// but triggers the STK Push modal instead of completing immediately.
type LocalMethod = SalePaymentMethod | 'mpesa_stk';

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
  onCreditCheckout: () => void;
}

export default function CheckoutPage({ items, onBack, onCheckoutSuccess, onCreditCheckout }: CheckoutPageProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<LocalMethod>('cash');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaConfigured, setMpesaConfigured] = useState<boolean | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, parseFloat(discountInput) || 0));
  const total = Math.max(0, subtotal - discountAmount);

  const handlePaymentChange = (value: string) => {
    if (value === 'credit') { onCreditCheckout(); return; }
    setPaymentMethod(value as LocalMethod);
    setError(null);
    setMpesaConfigured(null);

    // Pre-check credentials when M-Pesa STK Push is selected
    if (value === 'mpesa_stk' && user?.tenant_id) {
      mpesaService.getCredentialStatus(user.tenant_id).then((s) => {
        setMpesaConfigured(s.configured);
      }).catch(() => setMpesaConfigured(false));
    }
  };

  const handleComplete = async () => {
    setError(null);

    // ── M-Pesa STK Push path ──────────────────────────────────────────────────
    if (paymentMethod === 'mpesa_stk') {
      if (!user?.tenant_id) {
        setError('Tenant not configured. Contact your administrator.');
        return;
      }

      if (mpesaConfigured === null) {
        setProcessing(true);
        try {
          const status = await mpesaService.getCredentialStatus(user.tenant_id);
          setMpesaConfigured(status.configured);
          if (!status.configured) {
            setError('M-Pesa not set up. Ask your admin to add Daraja credentials in Settings → M-Pesa.');
            return;
          }
        } catch {
          setMpesaConfigured(false);
          setError('M-Pesa not set up. Ask your admin to add Daraja credentials in Settings → M-Pesa.');
          return;
        } finally {
          setProcessing(false);
        }
      } else if (!mpesaConfigured) {
        setError('M-Pesa not set up. Ask your admin to add Daraja credentials in Settings → M-Pesa.');
        return;
      }

      setShowMpesaModal(true);
      return;
    }

    // ── All other methods (cash, card, mobile_money) ──────────────────────────
    try {
      setProcessing(true);
      const dbMethod = paymentMethod as SalePaymentMethod;
      const receipt = await completeSale({ items, total, discountAmount, paymentMethod: dbMethod, user });
      onCheckoutSuccess(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const completeLabel = () => {
    if (processing) return 'Processing…';
    if (paymentMethod === 'mpesa_stk') return 'Send M-Pesa Prompt';
    return 'Complete Sale';
  };

  return (
    <>
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
              <option value="mpesa_stk">M-Pesa Prompt (STK Push)</option>
              <option value="credit">Credit</option>
            </select>

            {paymentMethod === 'mpesa_stk' && mpesaConfigured === false && (
              <p className="checkout-mpesa-warning">
                M-Pesa not configured. Add credentials in Settings → M-Pesa.
              </p>
            )}
            {paymentMethod === 'mpesa_stk' && mpesaConfigured === true && (
              <p className="checkout-mpesa-ready">
                Customer will receive a payment prompt on their phone.
              </p>
            )}
          </div>

          {error && <div className="checkout-error">{error}</div>}

          <button
            className="checkout-complete-btn"
            onClick={handleComplete}
            disabled={processing}
          >
            {completeLabel()}
          </button>
        </div>
      </div>

      {showMpesaModal && user && (
        <MpesaPaymentModal
          items={items}
          total={total}
          discountAmount={discountAmount}
          user={user}
          onSuccess={(receipt) => {
            setShowMpesaModal(false);
            onCheckoutSuccess(receipt);
          }}
          onCancel={() => setShowMpesaModal(false)}
        />
      )}
    </>
  );
}
