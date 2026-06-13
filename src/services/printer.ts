import { Capacitor, registerPlugin } from '@capacitor/core';

export interface PairedPrinter {
  name: string;
  address: string;
}

interface ThermalPrinterPlugin {
  isSupported(): Promise<{ value: boolean; builtIn: boolean }>;
  listPairedPrinters(): Promise<{ printers: PairedPrinter[] }>;
  connect(options: { address: string }): Promise<void>;
  printText(options: { text: string; cut?: boolean }): Promise<void>;
  disconnect(): Promise<void>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');

const PRINTER_STORAGE_KEY = 'mkulima-printer-address';

export const isNativePrinterSupported = () => Capacitor.isNativePlatform();

export const getSavedPrinterAddress = (): string | null => {
  try {
    return window.localStorage.getItem(PRINTER_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const savePrinterAddress = (address: string) => {
  try {
    window.localStorage.setItem(PRINTER_STORAGE_KEY, address);
  } catch {
    // Ignore storage errors.
  }
};

export const listPairedPrinters = async (): Promise<PairedPrinter[]> => {
  if (!Capacitor.isNativePlatform()) return [];
  const { printers } = await ThermalPrinter.listPairedPrinters();
  return printers;
};

/**
 * Prints receipt text on the device's built-in thermal printer (e.g. Sunmi
 * POS terminals) or a paired Bluetooth thermal printer when running as a
 * native app. Falls back to the browser print dialog (window.print) when
 * running in a regular browser or when no printer is available.
 */
export const printReceipt = async (text: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const { builtIn } = await ThermalPrinter.isSupported();

    if (builtIn) {
      await ThermalPrinter.printText({ text, cut: true });
      return;
    }

    const address = getSavedPrinterAddress();
    if (address) {
      await ThermalPrinter.connect({ address });
      await ThermalPrinter.printText({ text, cut: true });
      await ThermalPrinter.disconnect();
      return;
    }
  }

  window.print();
};
