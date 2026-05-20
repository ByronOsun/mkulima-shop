import { ReceiptData } from '../types';
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

  const handlePrint = () => window.print();

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

  const padCenter = (text: string, width: number = 40) => {
    const padding = Math.max(0, width - text.length);
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + text + ' '.repeat(padding - left);
  };

  const padRight = (left: string, right: string, width: number = 40) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const receiptText = `${padCenter('=' .repeat(40), 40)}
${padCenter('WAKULIMA AGROVET FARM LTD', 40)}
${padCenter('===============================', 40)}
${padCenter('Off Kisumu-Kakamega Road', 40)}
${padCenter('Kiboswa, Kenya', 40)}
${padCenter('Tel: 0722 843 544', 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter(`Receipt #${receipt.receiptNumber.toString().padStart(6, '0')}`, 40)}
${padCenter(formatDate(receipt.saleDate), 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter('SALES RECEIPT', 40)}
${padCenter('-'.repeat(40), 40)}

${padRight('ITEM', 'QTY', 40)}
${padRight('UNIT PRICE', 'TOTAL', 40)}
${padCenter('-'.repeat(40), 40)}
${receipt.items
  .map(
    (item) =>
      `${item.name.substring(0, 27).padEnd(27)}\n${padRight(
        `${item.quantity} x ${formatCurrency(item.unitPrice)}`,
        formatCurrency(item.subtotal),
        40
      )}`
  )
  .join('\n')}
${padCenter('-'.repeat(40), 40)}

${padRight('TOTAL:', formatCurrency(receipt.totalAmount), 40)}
${padRight('PAYMENT:', receipt.paymentMethod.toUpperCase(), 40)}
${padCenter('-'.repeat(40), 40)}

${padCenter('Thank you for shopping with us!', 40)}
${padCenter('Visit us again soon', 40)}
${padCenter('-'.repeat(40), 40)}
${padCenter(formatDate(new Date()), 40)}
${padCenter('=' .repeat(40), 40)}`;

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