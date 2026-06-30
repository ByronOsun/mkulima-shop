import { useEffect, useRef, useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { completeSale } from '../services/checkout';
import { supabaseService } from '../services/supabase';
import '../styles/Cart.css';
import '../styles/CreditCheckout.css';

interface CreditCheckoutProps {
  items: CartItem[];
  onBack: () => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
}

interface KnownCustomer {
  name: string;
  contact: string;
}

// ── Full-page customer picker ────────────────────────────────────────────────
function CustomerPickerPage({
  customers,
  onSelect,
  onClose,
}: {
  customers: KnownCustomer[];
  onSelect: (c: KnownCustomer) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = customers.filter(
    c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.contact.includes(query)
  );

  return (
    <div className="csp-page">
      <div className="csp-header">
        <button className="csp-back" onClick={onClose}>← Back</button>
        <h2 className="csp-title">Select Customer</h2>
        <span className="csp-count">{customers.length} on file</span>
      </div>

      <div className="csp-search-wrap">
        <span className="csp-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="csp-search"
          placeholder="Search by name or phone number…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="csp-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      <div className="csp-list">
        {filtered.length === 0 ? (
          <div className="csp-empty">
            <div className="csp-empty-icon">👤</div>
            <p>No customers match "{query}"</p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <button
              key={i}
              className="csp-item"
              onClick={() => onSelect(c)}
            >
              <div className="csp-avatar">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="csp-info">
                <span className="csp-name">{c.name}</span>
                {c.contact && <span className="csp-phone">{c.contact}</span>}
              </div>
              <span className="csp-arrow">›</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main CreditCheckout ──────────────────────────────────────────────────────
export default function CreditCheckout({ items, onBack, onCheckoutSuccess }: CreditCheckoutProps) {
  const { user } = useAuth();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'cash' | 'mobile_money'>('cash');

  const [knownCustomers, setKnownCustomers] = useState<KnownCustomer[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const to = new Date().toISOString().split('T')[0];
        const sales = await supabaseService.getSalesBetweenDates(from, to);
        const seen = new Map<string, KnownCustomer>();
        for (const sale of sales) {
          if (sale.payment_method === 'credit' && sale.customer_name?.trim()) {
            const key = sale.customer_name.trim().toLowerCase();
            if (!seen.has(key)) {
              seen.set(key, {
                name: sale.customer_name.trim(),
                contact: sale.customer_contact?.trim() || '',
              });
            }
          }
        }
        setKnownCustomers(
          Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch {
        // non-fatal
      }
    };
    void loadCustomers();
  }, []);

  const handleSelectCustomer = (c: KnownCustomer) => {
    setCustomerName(c.name);
    setCustomerContact(c.contact);
    setShowPicker(false);
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) { setError('Cart is empty'); return; }
    try {
      setProcessingPayment(true);
      setError(null);
      const amountPaid = parseFloat(initialPayment || '0') || 0;
      const receipt = await completeSale({
        items, total, paymentMethod: 'credit', user,
        customerName, customerContact, amountPaid, initialPaymentMethod,
      });
      onCheckoutSuccess(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Show full-page picker when requested
  if (showPicker) {
    return (
      <CustomerPickerPage
        customers={knownCustomers}
        onSelect={handleSelectCustomer}
        onClose={() => setShowPicker(false)}
      />
    );
  }

  return (
    <div className="credit-checkout-page">
      <div className="credit-checkout-header">
        <button type="button" className="credit-back-btn" onClick={onBack} disabled={processingPayment}>
          ← Back to Cart
        </button>
        <h2>Credit Sale</h2>
      </div>

      <div className="credit-checkout-content">
        {/* Order summary */}
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

        {/* Customer details */}
        <div className="credit-checkout-panel">
          <div className="customer-panel-header">
            <h3>Customer Details</h3>
            {knownCustomers.length > 0 && (
              <button
                type="button"
                className="btn-existing-customer"
                onClick={() => setShowPicker(true)}
                disabled={processingPayment}
              >
                👥 Existing ({knownCustomers.length})
              </button>
            )}
          </div>

          {customerName && (
            <div className="selected-customer-badge">
              <span className="scb-avatar">{customerName.charAt(0).toUpperCase()}</span>
              <div className="scb-info">
                <span className="scb-name">{customerName}</span>
                {customerContact && <span className="scb-phone">{customerContact}</span>}
              </div>
              <button className="scb-change" onClick={() => setShowPicker(true)} disabled={processingPayment}>
                Change
              </button>
            </div>
          )}

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
