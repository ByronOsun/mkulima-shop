declare module 'jsbarcode' {
  function JsBarcode(
    target: SVGSVGElement | HTMLCanvasElement,
    value: string,
    options?: {
      format?: string;
      displayValue?: boolean;
      height?: number;
      margin?: number;
      width?: number;
      lineColor?: string;
      background?: string;
    }
  ): void;
  export = JsBarcode;
}
