import JsBarcode from 'jsbarcode';

const BASE_OPTIONS = {
  format: 'CODE128',
  displayValue: false,
  lineColor: '#000000',
  background: '#ffffff',
} as const;

/**
 * Renders a verified Code 128 barcode into an SVG DOM element.
 * Call from useEffect() — the element must already be in the DOM.
 *
 * The SVG is then made responsive:
 *  - width="100%"  fills the card
 *  - preserveAspectRatio="none"  stretches bars to fill width; valid because
 *    Code 128 scanners decode bar-width *ratios*, not absolute widths
 *  - shape-rendering="crispEdges"  stops anti-aliasing from blurring bar edges
 */
export function renderBarcodeToSVG(svg: SVGSVGElement, value: string, heightPx = 80): void {
  JsBarcode(svg, value, { ...BASE_OPTIONS, height: heightPx, margin: 10 });
  svg.setAttribute('width', '100%');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('shape-rendering', 'crispEdges');
}

/**
 * Returns the black/white bar pattern for a barcode as a boolean array.
 * Uses a minimal off-screen canvas (1px per module, 10px tall) just to read
 * the pixel pattern, then immediately releases the canvas. This avoids storing
 * any PNG data URLs in memory — callers draw the bars directly as PDF rectangles.
 */
export function getBarcodePattern(value: string): boolean[] | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, { ...BASE_OPTIONS, height: 10, margin: 0, width: 1 });
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const midY = Math.floor(canvas.height / 2);
    const imageData = ctx.getImageData(0, midY, canvas.width, 1);
    const pattern: boolean[] = [];
    for (let x = 0; x < canvas.width; x++) {
      pattern.push(imageData.data[x * 4] < 128); // true = black bar
    }
    canvas.width = 0;
    canvas.height = 0;
    return pattern;
  } catch {
    return null;
  }
}

/** @deprecated Use getBarcodePattern for PDF generation to avoid OOM on Android. */
export function createBarcodeCanvas(value: string, heightPx = 60): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, { ...BASE_OPTIONS, height: heightPx, margin: 6, width: 2 });
  return canvas;
}
