import { Capacitor } from '@capacitor/core';

/**
 * Save a jsPDF document. On web this triggers a file download; on Android it
 * writes to the app cache directory and opens the system share sheet so the
 * user can view it in a PDF reader or save it to Downloads.
 */
export async function savePdf(doc: { output(t: 'datauristring'): string; save(name: string): void }, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const base64 = doc.output('datauristring').split(',')[1];

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: filename,
    url: uri,
    dialogTitle: 'Open PDF',
  });
}

/**
 * Print or share a thermal receipt.
 * On web: opens a small popup window and triggers the browser print dialog.
 * On native Android: renders the receipt text as a PDF and opens the share sheet.
 */
export async function printOrShareReceipt(
  receiptText: string,
  htmlContent: string,
  filename: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const w = window.open('', '_blank', 'width=360,height=700');
    if (w) {
      w.document.write(htmlContent);
      w.document.close();
      w.focus();
      w.print();
    }
    return;
  }

  // On native, build a minimal PDF from the pre-formatted receipt text.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: [80, 250] });
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  const pageH = doc.internal.pageSize.getHeight();
  let y = 5;
  for (const line of receiptText.split('\n')) {
    if (y > pageH - 5) {
      doc.addPage();
      y = 5;
    }
    doc.text(line, 3, y);
    y += 3.8;
  }

  await savePdf(doc, filename);
}
