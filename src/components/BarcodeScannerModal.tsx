import { useEffect, useRef, useState, useCallback } from 'react';
import { Product } from '../types';
import { playBeep } from '../utils/beep';
import '../styles/BarcodeScannerModal.css';

declare global {
  class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    static getSupportedFormats(): Promise<string[]>;
  }
}

interface Props {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
  onClose: () => void;
}

interface Toast {
  type: 'added' | 'not-found';
  message: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

export default function BarcodeScannerModal({ products, onAddToCart, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanActiveRef = useRef(true);
  const frameCounter = useRef(0);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-current refs so the tick loop (created once) never uses stale closures
  const productsRef = useRef(products);
  const onAddToCartRef = useRef(onAddToCart);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { onAddToCartRef.current = onAddToCart; }, [onAddToCart]);

  const [unavailable, setUnavailable] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    scanActiveRef.current = false;
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  const showToast = useCallback((t: Toast, durationMs: number) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

  const resumeScanning = useCallback((delayMs: number) => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => {
      scanActiveRef.current = true;
    }, delayMs);
  }, []);

  // Reads from refs — always sees the latest products and onAddToCart
  const handleDetectedCode = useCallback((raw: string) => {
    if (!scanActiveRef.current) return;
    scanActiveRef.current = false;

    const code = raw.trim();
    const normalized = code.toLowerCase();
    const product = productsRef.current.find(p =>
      p.sku?.toLowerCase() === normalized ||
      p.name.toLowerCase() === normalized
    );

    if (product) {
      playBeep('success');
      onAddToCartRef.current(product, 1);
      showToast({ type: 'added', message: `${product.name}  ${fmt(product.unit_price)}` }, 2200);
      resumeScanning(2500);
    } else {
      playBeep('error');
      showToast({ type: 'not-found', message: `Not found: "${code}"` }, 2500);
      resumeScanning(2500);
    }
  }, [showToast, resumeScanning]); // no products/onAddToCart deps — read from refs

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setStatusMsg('Camera barcode scanning requires Chrome or a Chromium-based browser.');
      setUnavailable(true);
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        detectorRef.current = new BarcodeDetector({ formats });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (cancelled || !detectorRef.current || !videoRef.current) return;

          frameCounter.current++;
          if (scanActiveRef.current && frameCounter.current % 10 === 0 &&
              videoRef.current.readyState >= 2) {
            try {
              const hits = await detectorRef.current.detect(videoRef.current);
              // handleDetectedCode reads productsRef/onAddToCartRef — always fresh
              if (hits.length > 0 && scanActiveRef.current) {
                handleDetectedCode(hits[0].rawValue);
              }
            } catch { /* ignore per-frame decode errors */ }
          }
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatusMsg(`Camera error: ${msg}`);
          setUnavailable(true);
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('code') as HTMLInputElement;
    const val = input.value.trim();
    if (val) {
      handleDetectedCode(val);
      input.value = '';
    }
  };

  return (
    <div className="bsm-overlay" onMouseDown={e => e.target === e.currentTarget && handleClose()}>
      <div className="bsm-modal">

        <div className="bsm-header">
          <span className="bsm-title">
            <BarcodeIcon /> Scan Product
          </span>
          <button className="bsm-close" onClick={handleClose} aria-label="Close scanner">✕</button>
        </div>

        {/* Viewfinder — always live, never dimmed */}
        <div className="bsm-viewfinder">
          <video ref={videoRef} className="bsm-video" playsInline muted />

          <div className="bsm-reticle">
            <div className="bsm-reticle-inner" />
            <p className="bsm-hint">Aim at product barcode</p>
          </div>

          {toast && (
            <div className={`bsm-toast bsm-toast--${toast.type}`}>
              <span className="bsm-toast-icon">{toast.type === 'added' ? '✓' : '✕'}</span>
              {toast.message}
            </div>
          )}
        </div>

        {unavailable && (
          <div className="bsm-status bsm-status--warn">
            <p>{statusMsg || 'Camera unavailable.'}</p>
            <p className="bsm-status-sub">
              Use a USB / Bluetooth barcode scanner — it works automatically on the POS screen.
              Or enter a barcode manually below.
            </p>
          </div>
        )}

        <form className="bsm-manual" onSubmit={handleManualSubmit}>
          <input
            name="code"
            className="bsm-manual-input"
            placeholder="Barcode / SKU — type or scan here"
            autoComplete="off"
            autoFocus={unavailable}
          />
          <button type="submit" className="bsm-manual-btn">Look up</button>
        </form>

      </div>
    </div>
  );
}

function BarcodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }}>
      <rect x="1" y="4" width="2" height="16"/>
      <rect x="5" y="4" width="1" height="16"/>
      <rect x="8" y="4" width="2" height="16"/>
      <rect x="12" y="4" width="1" height="16"/>
      <rect x="15" y="4" width="2" height="16"/>
      <rect x="19" y="4" width="1" height="16"/>
      <rect x="22" y="4" width="1" height="16"/>
    </svg>
  );
}
