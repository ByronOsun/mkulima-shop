import { Capacitor } from '@capacitor/core';

/**
 * Save a jsPDF document. On web this triggers a file download; on Android it
 * writes to the app cache directory and opens the system share sheet so the
 * user can view it in a PDF reader or save it to Downloads.
 */
export async function savePdf(
  doc: { output(t: 'datauristring'): string; save(name: string): void },
  filename: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const base64 = doc.output('datauristring').split(',')[1];

  // Retry the filesystem write up to 3 times — Android can transiently fail
  // on the first write to Cache after a cold start.
  let uri = '';
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      uri = result.uri;
      break;
    } catch (err) {
      lastErr = err;
      await new Promise<void>(r => setTimeout(r, 150 * (attempt + 1)));
    }
  }

  if (!uri) {
    throw new Error(
      `Could not write PDF to device storage after 3 attempts. ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
    );
  }

  // Share.share throws if the user dismisses the sheet on some Android versions —
  // treat that as success (the file is already written).
  try {
    await Share.share({ title: filename, url: uri, dialogTitle: 'Open or Save PDF' });
  } catch (shareErr) {
    const msg = String(shareErr).toLowerCase();
    // "cancel" / "share cancelled" / "activity not found" are user-initiated — not errors
    if (!msg.includes('cancel') && !msg.includes('activity') && !msg.includes('denied')) {
      throw shareErr;
    }
  }
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
