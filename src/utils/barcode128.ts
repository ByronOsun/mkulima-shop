// Code 128B barcode encoder + renderer
// Encodes ASCII 32–127. Each pattern is an 11-bit binary string (1=bar, 0=space).
// The STOP symbol is 13 bits.

const PATTERNS: readonly string[] = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100",
  "10011001000","10011000100","10001100100","11001001000","11001000100","11000100100",
  "10110011100","10011011100","10011001110","10111001100","10011101100","10011100110",
  "11001110010","11001011100","11001001110","11011100100","11001110100","11101101110",
  "11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110",
  "10110001000","10001101000","10001100010","11010001000","11000101000","11000100010",
  "10110111000","10110001110","10001101110","10111011000","10111000110","10001110110",
  "11101110110","11010001110","11000101110","11011101000","11011100010","11011101110",
  "11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000",
  "10010000110","10000101100","10000100110","10110010000","10110000100","10011010000",
  "10011000010","10000110100","10000110010","11000010010","11001010000","11110111010",
  "11000010100","10001111010","10100111100","10010111100","10010011110","10111100100",
  "10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000",
  "10111100010","11110101000","11110100010","10111011110","10111101110","11101011110",
  "11110101110","11010000100","11010010000","11010011100",
];

const START_B = 104;           // value for START Code B symbol
const STOP_PATTERN = "1100011101011"; // 13-bit stop

// Returns the raw bit string for the encoded text
function encodeBits(text: string): string {
  const safe = text.replace(/[^\x20-\x7E]/g, '?'); // guard non-ASCII

  let bits = PATTERNS[START_B];
  let checksum = START_B;

  for (let i = 0; i < safe.length; i++) {
    const v = safe.charCodeAt(i) - 32; // 0–95
    bits += PATTERNS[v];
    checksum += v * (i + 1);
  }

  bits += PATTERNS[checksum % 103]; // check character
  bits += STOP_PATTERN;
  return bits;
}

/**
 * Returns an inline SVG string for the barcode.
 *
 * The SVG always uses width="100%" + preserveAspectRatio="none" so it stretches
 * to fill whatever container width is available — bars stay proportionally correct
 * (Code 128 is decoded by bar-width ratios, not absolute widths).
 * shape-rendering="crispEdges" eliminates anti-aliasing so bars print/scan as
 * sharp black edges rather than blurry grey gradients.
 */
export function barcodeToSVG(
  text: string,
  opts: { height?: number; quietZone?: number } = {}
): string {
  // quietZone in module units (spec minimum = 10 modules on each side)
  const { height = 80, quietZone = 10 } = opts;
  const bits = encodeBits(text);

  // Use 1 unit per module. The SVG will be stretched by the browser to fill
  // the container, so absolute pixel widths don't matter — only ratios.
  const totalWidth = bits.length + quietZone * 2;

  let rects = '';
  let x = quietZone; // start after left quiet zone

  for (let i = 0; i < bits.length; ) {
    const bit = bits[i];
    let run = 0;
    while (i < bits.length && bits[i] === bit) { i++; run++; }
    if (bit === '1') {
      rects += `<rect x="${x}" y="0" width="${run}" height="${height}"/>`;
    }
    x += run;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="100%" height="${height}" ` +
    `viewBox="0 0 ${totalWidth} ${height}" ` +
    `preserveAspectRatio="none" ` +
    `shape-rendering="crispEdges" ` +
    `fill="black">${rects}</svg>`
  );
}

/** Draws the barcode onto a canvas 2D context at (offsetX, offsetY). Returns drawn width. */
export function drawBarcodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { barWidth?: number; height?: number; quietZone?: number; offsetX?: number; offsetY?: number } = {}
): number {
  const { barWidth = 2, height = 64, quietZone = 10, offsetX = 0, offsetY = 0 } = opts;
  const bits = encodeBits(text);

  ctx.fillStyle = '#000';
  let x = offsetX + quietZone * barWidth;

  for (let i = 0; i < bits.length; ) {
    const bit = bits[i];
    let run = 0;
    while (i < bits.length && bits[i] === bit) { i++; run++; }
    const w = run * barWidth;
    if (bit === '1') {
      ctx.fillRect(x, offsetY, w, height);
    }
    x += w;
  }

  return x + quietZone * barWidth - offsetX; // total drawn width
}

/**
 * Draws barcode bars directly into a jsPDF doc using doc.rect().
 * @param doc      jsPDF instance
 * @param text     barcode content
 * @param xMM      left edge in mm
 * @param yMM      top edge in mm
 * @param totalWidthMM  total width to fit into (bars are scaled to fill this)
 * @param heightMM barcode bar height in mm
 */
export function drawBarcodeInPDF(
  doc: { rect: (x: number, y: number, w: number, h: number, style: string) => void;
         setFillColor: (...args: number[]) => void },
  text: string,
  xMM: number,
  yMM: number,
  totalWidthMM: number,
  heightMM: number
): void {
  const bits = encodeBits(text);
  const unitW = totalWidthMM / bits.length; // mm per bit-unit

  let cursor = xMM;
  doc.setFillColor(0, 0, 0);

  for (let i = 0; i < bits.length; ) {
    const bit = bits[i];
    let run = 0;
    while (i < bits.length && bits[i] === bit) { i++; run++; }
    const w = run * unitW;
    if (bit === '1') {
      doc.rect(cursor, yMM, w, heightMM, 'F');
    }
    cursor += w;
  }
}
