import { useState, useEffect, useRef } from 'react';
import { CartItem, ReceiptData, User } from '../types';
import { completeSale } from '../services/checkout';
import { mpesaService } from '../services/mpesa';
import '../styles/MpesaPaymentModal.css';

interface Props {
  items: CartItem[];
  total: number;
  discountAmount: number;
  user: User;
  onSuccess: (receipt: ReceiptData) => void;
  onCancel: () => void;
}

type Stage = 'input' | 'initiating' | 'waiting' | 'success' | 'failed';

const POLL_INTERVAL_MS = 4_000;
const MAX_WAIT_SECONDS = 90;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

export default function MpesaPaymentModal({ items, total, discountAmount, user, onSuccess, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>('input');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(MAX_WAIT_SECONDS);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [mpesaReceipt, setMpesaReceipt] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof mpesaService.subscribeToTransaction>>(null);
  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const tenantId = user.tenant_id ?? '';

  // Clean up subscriptions and timers
  const cleanup = () => {
    if (channelRef.current) {
      mpesaService.unsubscribe(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  useEffect(() => () => cleanup(), []);

  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) {
      setPhoneError('Enter a valid Kenyan phone number (e.g. 0712345678)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSuccess = (receipt: ReceiptData, receipt_number?: string) => {
    cleanup();
    setMpesaReceipt(receipt_number ?? null);
    setStage('success');
    setReceiptData(receipt);
  };

  const handleFailed = (desc?: string) => {
    cleanup();
    setErrorMessage(desc || 'Payment was not completed. Please try again.');
    setStage('failed');
  };

  const startWaiting = (checkoutId: string, receipt: ReceiptData) => {
    setStage('waiting');
    setCountdown(MAX_WAIT_SECONDS);

    // Realtime subscription
    channelRef.current = mpesaService.subscribeToTransaction(checkoutId, (tx) => {
      if (tx.status === 'completed') handleSuccess(receipt, tx.mpesa_receipt_number ?? undefined);
      else if (['failed', 'cancelled', 'timeout'].includes(tx.status)) {
        handleFailed(tx.result_description ?? undefined);
      }
    });

    // Polling fallback (in case realtime misses the update)
    pollRef.current = window.setInterval(async () => {
      const result = await mpesaService.queryStatus(checkoutId);
      if (result.status === 'completed') handleSuccess(receipt, result.mpesa_receipt_number);
      else if (['failed', 'cancelled', 'timeout'].includes(result.status)) {
        handleFailed(result.result_description);
      }
    }, POLL_INTERVAL_MS);

    // Countdown timer
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          cleanup();
          handleFailed('Payment timed out. Please check your M-Pesa messages and try again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (!validatePhone(phone)) return;
    if (!tenantId) {
      setErrorMessage('No tenant configured. Please contact support.');
      setStage('failed');
      return;
    }

    setStage('initiating');
    setErrorMessage('');

    try {
      // 1. Create the sale as pending (stock is decremented now)
      const receipt = await completeSale({
        items,
        total,
        discountAmount,
        paymentMethod: 'mobile_money',
        user,
        initialStatus: 'pending',
      });

      setSaleId(receipt.saleId);
      setReceiptData(receipt);

      // 2. Initiate STK Push using tenant's own Daraja credentials
      const stkResult = await mpesaService.initiateStkPush({
        tenant_id: tenantId,
        sale_id: receipt.saleId,
        amount: total,
        phone,
        description: `Sale ${receipt.receiptNumber}`,
      });

      if (!stkResult.success || !stkResult.checkout_request_id) {
        // STK push failed — mark sale as cancelled so cashier can retry
        throw new Error(stkResult.error || 'Failed to send payment request to phone');
      }

      startWaiting(stkResult.checkout_request_id, receipt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setErrorMessage(msg);
      setStage('failed');
    }
  };

  const handleRetry = () => {
    // Retry STK push on same sale (if we have a sale_id)
    if (!saleId || !receiptData) {
      setStage('input');
      return;
    }
    setStage('initiating');
    setErrorMessage('');

    mpesaService
      .initiateStkPush({
        tenant_id: tenantId,
        sale_id: saleId,
        amount: total,
        phone,
        description: `Sale ${receiptData.receiptNumber}`,
      })
      .then((stkResult) => {
        if (!stkResult.success || !stkResult.checkout_request_id) {
          throw new Error(stkResult.error || 'Failed to send payment request');
        }
        startWaiting(stkResult.checkout_request_id, receiptData);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Retry failed');
        setStage('failed');
      });
  };

  const handleProceedWithReceipt = () => {
    if (receiptData) onSuccess(receiptData);
  };

  return (
    <div className="mpesa-overlay" role="dialog" aria-modal="true">
      <div className="mpesa-modal">
        {/* Header */}
        <div className="mpesa-header">
          <div className="mpesa-logo">
            <span className="mpesa-logo-icon">M</span>
            <span className="mpesa-logo-text">-PESA</span>
          </div>
          <div className="mpesa-amount-display">
            <span className="mpesa-amount-label">Amount</span>
            <span className="mpesa-amount-value">{fmt(total)}</span>
          </div>
        </div>

        {/* Body: input stage */}
        {stage === 'input' && (
          <div className="mpesa-body">
            <p className="mpesa-instructions">
              Enter the customer's M-Pesa registered phone number. They will receive a payment prompt on their phone.
            </p>
            <div className="mpesa-field">
              <label htmlFor="mpesa-phone">Phone Number</label>
              <div className="mpesa-phone-row">
                <span className="mpesa-prefix">+254</span>
                <input
                  id="mpesa-phone"
                  type="tel"
                  autoFocus
                  placeholder="7XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className={phoneError ? 'input-error' : ''}
                />
              </div>
              {phoneError && <span className="field-error">{phoneError}</span>}
            </div>
            <div className="mpesa-actions">
              <button className="btn-ghost" onClick={onCancel}>Cancel</button>
              <button className="btn-mpesa-primary" onClick={handleSend}>
                Send to Phone
              </button>
            </div>
          </div>
        )}

        {/* Initiating */}
        {stage === 'initiating' && (
          <div className="mpesa-body mpesa-centered">
            <div className="mpesa-spinner" />
            <p className="mpesa-status-text">Sending payment request…</p>
          </div>
        )}

        {/* Waiting for customer */}
        {stage === 'waiting' && (
          <div className="mpesa-body mpesa-centered">
            <div className="mpesa-pulse-ring">
              <div className="mpesa-pulse-inner">
                <span>M</span>
              </div>
            </div>
            <p className="mpesa-status-text">Check phone for M-Pesa prompt</p>
            <p className="mpesa-sub-text">Ask the customer to enter their M-Pesa PIN on their phone</p>
            <div className="mpesa-countdown">
              <div
                className="mpesa-countdown-bar"
                style={{ width: `${(countdown / MAX_WAIT_SECONDS) * 100}%` }}
              />
            </div>
            <span className="mpesa-countdown-label">{countdown}s remaining</span>
            <button
              className="btn-ghost mpesa-cancel-waiting"
              onClick={() => {
                cleanup();
                onCancel();
              }}
            >
              Cancel Payment
            </button>
          </div>
        )}

        {/* Success */}
        {stage === 'success' && (
          <div className="mpesa-body mpesa-centered">
            <div className="mpesa-success-icon">✓</div>
            <h3 className="mpesa-success-title">Payment Confirmed!</h3>
            {mpesaReceipt && (
              <p className="mpesa-receipt-ref">M-Pesa Ref: <strong>{mpesaReceipt}</strong></p>
            )}
            <p className="mpesa-sub-text">KES {total.toLocaleString()} received via M-Pesa</p>
            <button className="btn-mpesa-primary mpesa-done-btn" onClick={handleProceedWithReceipt}>
              View Receipt
            </button>
          </div>
        )}

        {/* Failed */}
        {stage === 'failed' && (
          <div className="mpesa-body mpesa-centered">
            <div className="mpesa-fail-icon">✕</div>
            <h3 className="mpesa-fail-title">Payment Failed</h3>
            <p className="mpesa-error-detail">{errorMessage}</p>
            <div className="mpesa-actions">
              <button className="btn-ghost" onClick={onCancel}>Close</button>
              <button className="btn-mpesa-primary" onClick={handleRetry}>
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
