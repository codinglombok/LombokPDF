/**
 * LombokPDF — PDF/UA Converter
 * Post-processes a PDF for accessibility compliance (ISO 14289-1).
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'

export const PDFUAConverter = {
  async convert(doc: LombokDocument): Promise<LombokDocument> {
    const { PDFDocument, PDFName } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())

    // Mark document as tagged (required for PDF/UA)
    pdfDoc.catalog.set(PDFName.of('MarkInfo'), pdfDoc.context.obj({ Marked: true }))

    // Set document language (required for PDF/UA — screen readers need this)
    if (!pdfDoc.catalog.get(PDFName.of('Lang'))) {
      pdfDoc.catalog.set(PDFName.of('Lang'), pdfDoc.context.obj('en-US'))
    }

    // Note: full tagged-PDF structure tree (headings, paragraphs, tables tagged
    // with semantic roles) is generated natively by the Stage 2 WASM LLE renderer
    // during layout, since it requires access to the semantic HTML tree at
    // render time. This Stage 1 converter sets document-level accessibility
    // flags only.

    pdfDoc.setProducer('LombokPDF')
    const bytes = await pdfDoc.save()
    return new Document(bytes)
  },
}
