/**
 * LombokPDF — AcroForm Flattener
 * Converts interactive form fields to static page content.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'

export const AcroFormFlattener = {
  async flatten(doc: LombokDocument): Promise<LombokDocument> {
    const { PDFDocument } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const form   = pdfDoc.getForm()

    form.flatten()

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
