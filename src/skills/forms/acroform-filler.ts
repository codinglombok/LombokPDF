/**
 * LombokPDF — AcroForm Field Filler
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { FormFillOptions } from './index.js'

export const AcroFormFiller = {
  async fill(doc: LombokDocument, options: FormFillOptions): Promise<LombokDocument> {
    const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const form   = pdfDoc.getForm()

    for (const [name, value] of Object.entries(options.fields)) {
      let field
      try {
        field = form.getField(name)
      } catch {
        console.warn(`[LombokPDF/formFill] Field "${name}" not found in document — skipping.`)
        continue
      }

      if (field instanceof PDFTextField) {
        field.setText(String(value))
        if (options.font) field.updateAppearances(await pdfDoc.embedFont(options.font as any))
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check(); else field.uncheck()
      } else if (field instanceof PDFRadioGroup) {
        field.select(String(value))
      } else if (field instanceof PDFDropdown) {
        field.select(String(value))
      } else {
        console.warn(`[LombokPDF/formFill] Unsupported field type for "${name}"`)
      }
    }

    if (options.flatten) {
      form.flatten()
    }

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
