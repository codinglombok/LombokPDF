/**
 * LombokPDF — AcroForm Field Extractor
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import type { FormExtractResult, FieldValue } from './index.js'

export const AcroFormExtractor = {
  async extract(doc: LombokDocument): Promise<FormExtractResult> {
    const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFSignature } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const form   = pdfDoc.getForm()
    const fields = form.getFields()

    const result: FormExtractResult = {
      fields:     {},
      fieldNames: [],
      fieldTypes: {},
    }

    for (const field of fields) {
      const name = field.getName()
      result.fieldNames.push(name)

      let value: FieldValue = ''
      let type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature' = 'text'

      if (field instanceof PDFTextField) {
        value = field.getText() ?? ''
        type  = 'text'
      } else if (field instanceof PDFCheckBox) {
        value = field.isChecked()
        type  = 'checkbox'
      } else if (field instanceof PDFRadioGroup) {
        value = field.getSelected() ?? ''
        type  = 'radio'
      } else if (field instanceof PDFDropdown) {
        value = field.getSelected()?.[0] ?? ''
        type  = 'dropdown'
      } else if (field instanceof PDFSignature) {
        value = ''
        type  = 'signature'
      }

      result.fields[name]     = value
      result.fieldTypes[name] = type
    }

    if (fields.length === 0) {
      throw new Error('LombokPDF/formExtract: No AcroForm fields found in this document')
    }

    return result
  },
}
