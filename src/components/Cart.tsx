import { useState } from 'react';
import { CartItem, ReceiptData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabaseService } from '../services/supabase';
import '../styles/Cart.css';

interface CartProps {
  items: CartItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onCheckoutSuccess: (receipt: ReceiptData) => void;
}

type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'credit';

export default function Cart({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onCheckoutSuccess,
}: CartProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerContact, setCustomerContact] = useState<string>('');
  const [initialPayment, setInitialPayment] = useState<string>('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'cash' | 'mobile_money'>('cash');
  

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = async () => {
    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    try {
      setProcessingPayment(true);
      setError(null);

      // Determine sale status and initial paid amount for credit
      let status: 'completed' | 'pending' = 'completed';
      let amountPaid = 0;
      if (paymentMethod === 'credit') {
        const parsed = parseFloat(initialPayment || '0') || 0;
        amountPaid = parsed;
        status = parsed >= total ? 'completed' : 'pending';
      }

      // Create sale record
      const sale = await supabaseService.createSale({
        sale_date: new Date().toISOString(),
        total_amount: total,
        payment_method: paymentMethod,
        status,
        customer_name: paymentMethod === 'credit' ? customerName || undefined : undefined,
        customer_contact: paymentMethod === 'credit' ? customerContact || undefined : undefined,
        amount_paid: amountPaid || undefined,
        payment_channel: paymentMethod === 'credit' && amountPaid > 0 ? initialPaymentMethod : undefined,
        cashier_name: user?.fullName || user?.username || 'Unknown User',
        cashier_role: user?.role ?? 'cashier',
      } as any);

      // Create sale items
      const saleItems = items.map(item => ({
        sale_id: sale.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      await supabaseService.createSaleItems(saleItems);

      // Update product stock
      for (const item of items) {
        const newStock = item.product.quantity_in_stock - item.quantity;
        await supabaseService.updateProductStock(
          item.productId,
          Math.max(0, newStock)
        );
      }

      onCheckoutSuccess({
        saleId: sale.id,
        receiptNumber: sale.id.substring(0, 8).toUpperCase(),
        saleDate: sale.sale_date,
        paymentMethod,
        totalAmount: total,
        cashierRole: user?.role ?? 'cashier',
        cashierName: user?.fullName || user?.username || 'Unknown User',
        items: items.map(item => ({
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
        })),
      });

      // If initial payment was provided, and payment method is cash/mobile_money, we'll keep UI message
      if (paymentMethod === 'credit' && amountPaid > 0) {
        setSuccess(`Credit sale created. Initial payment of ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amountPaid)} recorded.`);
      } else {
        setSuccess(`Sale completed! Sale ID: ${sale.id.substring(0, 8)}...`);
      }

      setSuccess(`Sale completed! Sale ID: ${sale.id.substring(0, 8)}...`);
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
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="payment-select"
              disabled={processingPayment}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="credit">Credit</option>
            </select>
          </div>

          {paymentMethod === 'credit' && (
            <div className="credit-customer-section">
              <h4>Credit Customer Details</h4>
              <div className="credit-row">
                <input
                  type="text"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="credit-input"
                />
                <input
                  type="text"
                  placeholder="Customer phone"
                  value={customerContact}
                  onChange={e => setCustomerContact(e.target.value)}
                  className="credit-input"
                />
              </div>

              <div className="credit-row">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Initial payment amount (optional)"
                  value={initialPayment}
                  onChange={e => setInitialPayment(e.target.value)}
                  className="credit-input"
                />
                <select
                  value={initialPaymentMethod}
                  onChange={e => setInitialPaymentMethod(e.target.value as 'cash' | 'mobile_money')}
                  className="credit-input"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
            </div>
          )}

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
