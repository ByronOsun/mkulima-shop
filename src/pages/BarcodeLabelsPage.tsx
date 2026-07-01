import { useState, useEffect, useRef, useCallback } from 'react';
import { Product } from '../types';
import { supabaseService } from '../services/supabase';
import { renderBarcodeToSVG, getBarcodePattern } from '../utils/barcodeGen';
import { savePdf } from '../services/pdf';
import '../styles/BarcodeLabelsPage.css';

interface Props {
  onBack: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

// ── Single label card (screen preview) ───────────────────────────────
interface LabelCardProps {
  product: Product;
  selected: boolean;
  onToggle: () => void;
}

function LabelCard({ product, selected, onToggle }: LabelCardProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      renderBarcodeToSVG(svgRef.current, product.sku, 80);
    }
  }, [product.sku]);

  return (
    <div
      className={`bl-label-card${selected ? ' bl-label-card--selected' : ''}`}
      onClick={onToggle}
      title={selected ? 'Click to deselect' : 'Click to select for PDF'}
    >
      <div className={`bl-check${selected ? ' bl-check--on' : ''}`}>
        {selected ? '✓' : ''}
      </div>

      {/* JsBarcode renders into this SVG element */}
      <div className="bl-barcode">
        <svg ref={svgRef} />
      </div>

      <div className="bl-sku">{product.sku}</div>

      <div className="bl-info">
        <div className="bl-name">{product.name}</div>
        <div className="bl-price">{fmt(product.unit_price)}</div>
        <div className="bl-meta">
          <span className="bl-cat">{product.category}</span>
          {product.description && (
            <span className="bl-desc">{product.description}</span>
          )}
        </div>
        <div className="bl-stock">
          Stock: {product.quantity_in_stock}&nbsp;|&nbsp;Reorder: {product.reorder_level}
        </div>
      </div>
    </div>
  );
}

// ── PDF generation ────────────────────────────────────────────────────
// Yields to the event loop every CHUNK_SIZE labels so the Android WebView
// watchdog doesn't kill the app during long generations.
const CHUNK_SIZE = 5;

async function generateLabelsPDF(
  products: Product[],
  onProgress: (pct: number) => void,
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  // A4 portrait — 4 columns of labels
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 6;
  const MARGIN_Y = 8;
  const GAP_X = 3;
  const GAP_Y = 3;
  const COLS = 4;
  const LABEL_W = (PAGE_W - MARGIN_X * 2 - GAP_X * (COLS - 1)) / COLS; // ≈ 45.75 mm
  const LABEL_H = 34;
  const rowsPerPage = Math.floor((PAGE_H - MARGIN_Y * 2 + GAP_Y) / (LABEL_H + GAP_Y));

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let col = 0;
  let row = 0;

  for (let i = 0; i < products.length; i++) {
    // Yield every CHUNK_SIZE labels so the JS event loop stays responsive
    if (i > 0 && i % CHUNK_SIZE === 0) {
      onProgress(Math.round((i / products.length) * 90)); // 0–90% during render
      await new Promise<void>(r => setTimeout(r, 15));
    }

    const p = products[i];

    if (i > 0 && col === 0 && row === rowsPerPage) {
      doc.addPage();
      row = 0;
    }

    const x = MARGIN_X + col * (LABEL_W + GAP_X);
    const y = MARGIN_Y + row * (LABEL_H + GAP_Y);

    // Label border + white fill
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, LABEL_W, LABEL_H, 'FD');

    // ── Barcode (vector — no PNG encoding, no image data in PDF) ─────
    const barcodeX = x + 2;
    const barcodeW = LABEL_W - 4;
    const barcodeY = y + 2;
    const barcodeH = 14;

    const pattern = getBarcodePattern(p.sku);
    if (pattern && pattern.length > 0) {
      const moduleW = barcodeW / pattern.length;
      doc.setFillColor(0, 0, 0);
      // Merge consecutive black modules into single rects (cleaner + fewer ops)
      let j = 0;
      while (j < pattern.length) {
        if (pattern[j]) {
          let run = 1;
          while (j + run < pattern.length && pattern[j + run]) run++;
          doc.rect(barcodeX + j * moduleW, barcodeY, run * moduleW + 0.01, barcodeH, 'F');
          j += run;
        } else {
          j++;
        }
      }
    } else {
      doc.setFillColor(240, 240, 240);
      doc.rect(barcodeX, barcodeY, barcodeW, barcodeH, 'F');
      doc.setFontSize(5);
      doc.setTextColor(150, 150, 150);
      doc.text('—', x + LABEL_W / 2, barcodeY + barcodeH / 2, { align: 'center' });
    }

    // ── SKU ───────────────────────────────────────────────────────
    const skuY = barcodeY + barcodeH + 2.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(60, 60, 60);
    doc.text(p.sku, x + LABEL_W / 2, skuY, { align: 'center' });

    // ── Product name ──────────────────────────────────────────────
    const nameY = skuY + 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 15, 15);
    const nameLines = doc.splitTextToSize(p.name, LABEL_W - 4) as string[];
    doc.text(nameLines.slice(0, 2), x + LABEL_W / 2, nameY, { align: 'center' });

    // ── Price ─────────────────────────────────────────────────────
    const priceY = nameY + nameLines.slice(0, 2).length * 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(39, 174, 96);
    doc.text(fmt(p.unit_price), x + LABEL_W / 2, priceY, { align: 'center' });

    // ── Category ──────────────────────────────────────────────────
    const catY = priceY + 3.5;
    if (catY < y + LABEL_H - 0.5) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(130, 130, 130);
      doc.text(p.category, x + LABEL_W / 2, catY, { align: 'center' });
    }

    col++;
    if (col >= COLS) { col = 0; row++; }
  }

  onProgress(92); // Render done — now saving
  await savePdf(doc, 'vizia-barcode-labels.pdf');
  onProgress(100);
}

// ── Main page ─────────────────────────────────────────────────────────
export default function BarcodeLabelsPage({ onBack }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);

  const loadProducts = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    supabaseService.getProducts()
      .then(data => {
        const sorted = (data || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        setProducts(sorted);
        setSelectedIds(prev => {
          const next = new Set(prev);
          sorted.forEach(p => next.add(p.id));
          return next;
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load products'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  const toggleProduct = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(p => n.delete(p.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(p => n.add(p.id)); return n; });
    }
  };

  const handleDownloadPDF = async () => {
    const toExport = products.filter(p => selectedIds.has(p.id));
    if (toExport.length === 0) return;
    setGenerating(true);
    setGenProgress(0);
    try {
      // Small delay so the progress UI renders before the heavy work begins
      await new Promise<void>(r => setTimeout(r, 60));
      await generateLabelsPDF(toExport, setGenProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF generation failed. Try selecting fewer products.');
    } finally {
      setGenerating(false);
      setGenProgress(0);
    }
  };

  const selectedCount = products.filter(p => selectedIds.has(p.id)).length;

  if (loading) return <div className="page-loader">Loading products…</div>;

  return (
    <div className="bl-page">

      <div className="bl-toolbar">
        <button className="bl-back-btn" onClick={onBack}>← Inventory</button>
        <div className="bl-toolbar-center">
          <h2 className="bl-title">Barcode Labels</h2>
          <span className="bl-sub">{products.length} products · {selectedCount} selected</span>
        </div>
        <div className="bl-toolbar-right">
          <button
            className="bl-refresh-btn"
            onClick={() => loadProducts(true)}
            disabled={refreshing}
            title="Reload — picks up any products added since you opened this page"
          >
            {refreshing ? '…' : '↻ Refresh'}
          </button>
          <div className="bl-pdf-btn-wrap">
            <button
              className="bl-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={selectedCount === 0 || generating}
            >
              {generating
                ? `Building… ${genProgress}%`
                : `⬇ PDF (${selectedCount})`}
            </button>
            {generating && (
              <div className="bl-progress-bar">
                <div className="bl-progress-fill" style={{ width: `${genProgress}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bl-filterbar">
        <input
          className="bl-search"
          type="search"
          placeholder="Filter by name, SKU or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="bl-toggle-all" onClick={toggleAll}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {filtered.length === 0 ? (
        <p className="bl-empty">No products match your search.</p>
      ) : (
        <div className="bl-grid">
          {filtered.map(product => (
            <LabelCard
              key={product.id}
              product={product}
              selected={selectedIds.has(product.id)}
              onToggle={() => toggleProduct(product.id)}
            />
          ))}
        </div>
      )}

      <div className="bl-footer">
        <span>PDF: A4 portrait · 4 columns · 34 mm × ~46 mm · ~{Math.ceil(selectedCount / 32)} page(s)</span>
        <span className="bl-footer-hint">New products appear automatically — hit ↻ Refresh if you just added one.</span>
      </div>

    </div>
  );
}
