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
 * Creates an off-screen canvas with the barcode at high pixel density.
 * width:4 = 4 px per module → stays readable at 300 DPI print resolution.
 * Call canvas.toDataURL('image/png') to embed in jsPDF.
 */
export function createBarcodeCanvas(value: string, heightPx = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, { ...BASE_OPTIONS, height: heightPx, margin: 8, width: 4 });
  return canvas;
}
