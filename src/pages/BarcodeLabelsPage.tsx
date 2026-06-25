import { useState, useEffect, useRef, useCallback } from 'react';
import { Product } from '../types';
import { supabaseService } from '../services/supabase';
import { renderBarcodeToSVG, createBarcodeCanvas } from '../utils/barcodeGen';
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
async function generateLabelsPDF(products: Product[]) {
  const { jsPDF } = await import('jspdf');

  // A4 portrait — 2 columns of labels
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 8;
  const MARGIN_Y = 10;
  const GAP_X = 5;
  const GAP_Y = 4;
  const COLS = 2;
  const LABEL_W = (PAGE_W - MARGIN_X * 2 - GAP_X * (COLS - 1)) / COLS; // ≈ 96.5 mm
  const LABEL_H = 46;
  const rowsPerPage = Math.floor((PAGE_H - MARGIN_Y * 2 + GAP_Y) / (LABEL_H + GAP_Y));

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let col = 0;
  let row = 0;

  for (let i = 0; i < products.length; i++) {
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
    doc.setLineWidth(0.25);
    doc.rect(x, y, LABEL_W, LABEL_H, 'FD');

    // ── Barcode image from canvas (verified Code 128 via JsBarcode) ──
    const barcodeX = x + 3;
    const barcodeW = LABEL_W - 6;
    const barcodeY = y + 2.5;
    const barcodeH = 20;

    try {
      const canvas = createBarcodeCanvas(p.sku, 120);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);
    } catch {
      // If barcode generation fails for this SKU, leave blank and continue
      doc.setFillColor(240, 240, 240);
      doc.rect(barcodeX, barcodeY, barcodeW, barcodeH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(150);
      doc.text('(barcode error)', x + LABEL_W / 2, barcodeY + barcodeH / 2, { align: 'center' });
    }

    // ── SKU — monospace, centred under barcode ────────────────────
    const skuY = barcodeY + barcodeH + 3.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text(p.sku, x + LABEL_W / 2, skuY, { align: 'center' });

    // ── Product name ──────────────────────────────────────────────
    const nameY = skuY + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 15, 15);
    const nameLines = doc.splitTextToSize(p.name, LABEL_W - 6) as string[];
    doc.text(nameLines.slice(0, 2), x + LABEL_W / 2, nameY, { align: 'center' });

    // ── Price ─────────────────────────────────────────────────────
    const priceY = nameY + nameLines.slice(0, 2).length * 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(39, 174, 96);
    doc.text(fmt(p.unit_price), x + LABEL_W / 2, priceY, { align: 'center' });

    // ── Category ──────────────────────────────────────────────────
    const catY = priceY + 4.2;
    if (catY < y + LABEL_H - 0.5) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(p.category, x + LABEL_W / 2, catY, { align: 'center' });
    }

    col++;
    if (col >= COLS) { col = 0; row++; }
  }

  doc.save('mkulima-barcode-labels.pdf');
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
    try {
      await new Promise(r => setTimeout(r, 30));
      await generateLabelsPDF(toExport);
    } finally {
      setGenerating(false);
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
          <button
            className="bl-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={selectedCount === 0 || generating}
          >
            {generating ? 'Generating…' : `⬇ Download PDF (${selectedCount})`}
          </button>
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
        <span>PDF: A4 portrait · 2 columns · 46 mm × ~96 mm · ~{Math.ceil(selectedCount / 12)} page(s)</span>
        <span className="bl-footer-hint">New products appear automatically — hit ↻ Refresh if you just added one.</span>
      </div>

    </div>
  );
}
