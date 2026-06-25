import { ReceiptData } from '../types';
import { printReceipt } from '../services/printer';
import '../styles/ReceiptPage.css';

interface ReceiptPageProps {
  receipt: ReceiptData | null;
  onBackToPos: () => void;
}

export default function ReceiptPage({ receipt, onBackToPos }: ReceiptPageProps) {
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

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(date));
  };

  // 32 columns matches the printable width of a standard 58mm thermal
  // roll (the size used by built-in POS printers like the Sunmi V2 Pro).
  // Sending wider lines causes the printer to wrap them onto extra lines,
  // wasting paper.
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

  const shopName = receipt.tenantConfig?.shopName || '';
  const shopAddress = receipt.tenantConfig?.address || '';
  const shopPhone = receipt.tenantConfig?.phone ? `Tel: ${receipt.tenantConfig.phone}` : '';

  const headerLines = [shopName, shopAddress, shopPhone].filter(Boolean).map(l => padCenter(l)).join('\n');

  const receiptText = `${padCenter('='.repeat(WIDTH))}
${headerLines}
${padCenter('-'.repeat(WIDTH))}
Receipt #${receipt.receiptNumber.toString().padStart(6, '0')}
${formatDate(receipt.saleDate)}
Cashier: ${receipt.cashierName} (${receipt.cashierRole.toUpperCase()})
${padCenter('-'.repeat(WIDTH))}
${receipt.items
  .map(
    (item) =>
      `${item.name.substring(0, WIDTH)}\n${padRight(
        `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
        formatCurrency(item.subtotal)
      )}`
  )
  .join('\n')}
${padCenter('-'.repeat(WIDTH))}
${receipt.discountAmount && receipt.discountAmount > 0
  ? `${padRight('SUBTOTAL:', formatCurrency(receipt.totalAmount + receipt.discountAmount))}\n${padRight('DISCOUNT:', `-${formatCurrency(receipt.discountAmount)}`)}\n`
  : ''}${padRight('TOTAL:', formatCurrency(receipt.totalAmount))}
${padRight('PAYMENT:', receipt.paymentMethod.toUpperCase())}
${padCenter('='.repeat(WIDTH))}
${padCenter('Thank you for shopping with us!')}
${padCenter('='.repeat(WIDTH))}
${padCenter(' VIZIA Technologies')}
${padCenter('='.repeat(WIDTH))}`;

  const handlePrint = () => printReceipt(receiptText);

  return (
    <div className="receipt-page">
      <div className="receipt-thermal-wrapper">
        <pre className="receipt-thermal" id="receipt-print-area">
          {receiptText}
        </pre>
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