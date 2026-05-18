import type jsPDF from "jspdf"

export type PdfLetterheadOptions = {
  title: string
  subtitle?: string
  contact?: string
  y?: number
}

export function addPdfLetterhead(doc: jsPDF, options: PdfLetterheadOptions) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const y = options.y ?? 14
  const contact = options.contact || "07 002 132 28"

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(options.title, pageWidth / 2, y, { align: "center" })

  if (options.subtitle) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(options.subtitle, pageWidth / 2, y + 6, { align: "center" })
  }

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Contact: ${contact}`, pageWidth / 2, y + 12, { align: "center" })
  doc.setLineWidth(0.5)
  doc.line(14, y + 16, pageWidth - 14, y + 16)

  return y + 22
}
