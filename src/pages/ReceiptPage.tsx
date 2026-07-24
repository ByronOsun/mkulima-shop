import { useState } from 'react';
import { ReceiptData } from '../types';
import { printReceipt } from '../services/printer';
import '../styles/ReceiptPage.css';

const VAT_RATE = 0.16;

const toDateTimeLocal = (date: string | Date) => {
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PAYMENT_METHOD_LABELS: Record<ReceiptData['paymentMethod'], string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  credit: 'Credit',
};

interface ReceiptPageProps {
  receipt: ReceiptData | null;
  onBackToPos: () => void;
}

export default function ReceiptPage({ receipt, onBackToPos }: ReceiptPageProps) {
  const [editableDate, setEditableDate] = useState(() =>
    receipt ? toDateTimeLocal(receipt.saleDate) : ''
  );

  if (!receipt) {
    return (
      <div className="receipt-page empty">
        <div className="receipt-card">
          <h2>No receipt available</h2>
          <button className="receipt-back-btn" onClick={onBackToPos}>
            Back to POS
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (date: string | Date) => {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(date));
  };

  const effectiveDate = editableDate ? new Date(editableDate) : new Date(receipt.saleDate);

  const shopName = receipt.tenantConfig?.shopName || '';
  const shopAddress = receipt.tenantConfig?.address || '';
  const shopPhone = receipt.tenantConfig?.phone ? `Tel: ${receipt.tenantConfig.phone}` : '';

  // VAT is shown as a component already included within the charged amount
  // (frontend-only breakdown; does not change the amount actually
  // recorded/charged for the sale).
  const totalPaid = receipt.totalAmount;
  const vatAmount = (totalPaid * VAT_RATE) / (1 + VAT_RATE);
  const subtotal = totalPaid - vatAmount;

  const paymentLabel = PAYMENT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod;
  const receiptNumberDisplay = `#${receipt.receiptNumber.toString().padStart(6, '0')}`;

  // Plain-text version for native/Bluetooth thermal printers (58mm roll,
  // monospace hardware — can't render the styled card layout below).
  const WIDTH = 32;

  const padCenter = (text: string, width: number = WIDTH) => {
    const padding = Math.max(0, width - text.length);
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + text + ' '.repeat(padding - left);
  };

  const padRight = (left: string, right: string, width: number = WIDTH) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const headerLines = [shopName, shopAddress, shopPhone].filter(Boolean).map(l => padCenter(l)).join('\n');

  const receiptText = `${padCenter('='.repeat(WIDTH))}
${headerLines}
${padCenter('-'.repeat(WIDTH))}
Receipt ${receiptNumberDisplay}
${formatDateTime(effectiveDate)}
Cashier: ${receipt.cashierName} (${receipt.cashierRole.toUpperCase()})
${padCenter('-'.repeat(WIDTH))}
${receipt.items
  .map(
    (item) =>
      `${item.name}${
        item.description ? `\n${item.description}` : ''
      }\n${padRight(
        `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
        formatCurrency(item.subtotal)
      )}`
  )
  .join('\n')}
${padCenter('-'.repeat(WIDTH))}
${receipt.discountAmount && receipt.discountAmount > 0
  ? `${padRight('ITEMS TOTAL:', formatCurrency(receipt.totalAmount + receipt.discountAmount))}\n${padRight('DISCOUNT:', `-${formatCurrency(receipt.discountAmount)}`)}\n`
  : ''}${padRight('SUBTOTAL:', formatCurrency(subtotal))}
${padRight('VAT (16%):', formatCurrency(vatAmount))}
${padRight('TOTAL PAID:', formatCurrency(totalPaid))}
${padRight('PAYMENT:', paymentLabel.toUpperCase())}
${padCenter('='.repeat(WIDTH))}
${padCenter('Thank you for shopping with us!')}
${padCenter('='.repeat(WIDTH))}
${padCenter(' VIZIA Technologies')}
${padCenter('='.repeat(WIDTH))}`;

  const handlePrint = () => printReceipt(receiptText);

  return (
    <div className="receipt-page">
      <div className="receipt-card" id="receipt-print-area">
        <h1 className="receipt-title">RECEIPT</h1>

        <div className="receipt-shop-block">
          {shopName && <div className="receipt-shop-name">{shopName}</div>}
          {shopAddress && <div className="receipt-shop-address">{shopAddress}</div>}
          {shopPhone && <div className="receipt-shop-address">{shopPhone}</div>}
        </div>

        <div className="receipt-divider" />

        <div className="receipt-meta-row">
          <span>Payment Method</span>
          <span>Receipt Number</span>
        </div>
        <div className="receipt-meta-row receipt-meta-value">
          <span>{paymentLabel}</span>
          <span>{receiptNumberDisplay}</span>
        </div>

        <div className="receipt-line-row">
          <span className="receipt-line-label">Date &amp; Time</span>
          <span className="receipt-line-value">
            <input
              type="datetime-local"
              className="receipt-datetime-input no-print"
              value={editableDate}
              onChange={e => setEditableDate(e.target.value)}
            />
            <span className="print-only">{formatDateTime(effectiveDate)}</span>
          </span>
        </div>

        <div className="receipt-cashier-name">Cashier: {receipt.cashierName}</div>

        <div className="receipt-divider" />

        <div className="receipt-table-header">
          <span className="receipt-col-item">Item</span>
          <span className="receipt-col-qty">Qty</span>
          <span className="receipt-col-price">Unit Price</span>
        </div>

        {receipt.items.map((item, index) => (
          <div className="receipt-item-row" key={`${item.productId}-${index}`}>
            <div className="receipt-col-item">
              <div className="receipt-item-name">{item.name}</div>
              {item.description && <div className="receipt-item-desc">{item.description}</div>}
            </div>
            <span className="receipt-col-qty">{item.quantity}</span>
            <span className="receipt-col-price">{formatCurrency(item.unitPrice)}</span>
          </div>
        ))}

        <div className="receipt-divider" />

        {receipt.discountAmount && receipt.discountAmount > 0 && (
          <>
            <div className="receipt-total-row">
              <span>Items Total</span>
              <span>{formatCurrency(receipt.totalAmount + receipt.discountAmount)}</span>
            </div>
            <div className="receipt-total-row">
              <span>Discount</span>
              <span>-{formatCurrency(receipt.discountAmount)}</span>
            </div>
          </>
        )}
        <div className="receipt-total-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="receipt-total-row">
          <span>VAT (16%)</span>
          <span>{formatCurrency(vatAmount)}</span>
        </div>
        <div className="receipt-total-row receipt-total-grand">
          <span>Total Paid</span>
          <span>{formatCurrency(totalPaid)}</span>
        </div>

        <div className="receipt-divider receipt-divider-strong" />

        <div className="receipt-thank-you">Thank you for shopping with us!</div>

        <div className="receipt-divider" />

        <div className="receipt-footer-brand">VIZIA Technologies</div>

        <div className="receipt-divider receipt-divider-strong" />
      </div>

      <div className="receipt-actions no-print">
        <button className="receipt-print-btn" onClick={handlePrint}>
          🖨️ Print Receipt
        </button>
        <button className="receipt-back-btn" onClick={onBackToPos}>
          ← Back to POS
        </button>
      </div>
    </div>
  );
}
