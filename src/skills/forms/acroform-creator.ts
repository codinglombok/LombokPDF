/**
 * LombokPDF — AcroForm Field Creator
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { FormCreateOptions } from './index.js'

export const AcroFormCreator = {
  async create(doc: LombokDocument, options: FormCreateOptions): Promise<LombokDocument> {
    const { PDFDocument, rgb } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const form   = pdfDoc.getForm()
    const pages  = pdfDoc.getPages()

    for (const fieldDef of options.fields) {
      const pageIdx = (fieldDef.page ?? 1) - 1
      const page    = pages[pageIdx]
      if (!page) {
        console.warn(`[LombokPDF/formCreate] Page ${fieldDef.page} not found — skipping field "${fieldDef.name}"`)
        continue
      }

      const [x, y, width, height] = fieldDef.position
      const pageHeight = page.getHeight()
      const pdfY = pageHeight - y - height

      switch (fieldDef.type) {
        case 'text': {
          const textField = form.createTextField(fieldDef.name)
          if (fieldDef.multiline) textField.enableMultiline()
          if (fieldDef.maxLength) textField.setMaxLength(fieldDef.maxLength)
          if (fieldDef.required) textField.enableRequired()
          textField.addToPage(page, { x, y: pdfY, width, height })
          break
        }
        case 'checkbox': {
          const checkbox = form.createCheckBox(fieldDef.name)
          if (fieldDef.required) checkbox.enableRequired()
          checkbox.addToPage(page, { x, y: pdfY, width, height })
          if (fieldDef.defaultChecked) checkbox.check()
          break
        }
        case 'radio': {
          const radioGroup = form.createRadioGroup(fieldDef.name)
          const optionHeight = height / fieldDef.options.length
          fieldDef.options.forEach((opt, i) => {
            radioGroup.addOptionToPage(opt, page, {
              x, y: pdfY + i * optionHeight, width: optionHeight, height: optionHeight,
            })
          })
          if (fieldDef.defaultValue) radioGroup.select(fieldDef.defaultValue)
          break
        }
        case 'dropdown': {
          const dropdown = form.createDropdown(fieldDef.name)
          dropdown.addOptions(fieldDef.options)
          if (fieldDef.required) dropdown.enableRequired()
          dropdown.addToPage(page, { x, y: pdfY, width, height })
          break
        }
        case 'date': {
          const textField = form.createTextField(fieldDef.name)
          if (fieldDef.required) textField.enableRequired()
          textField.addToPage(page, { x, y: pdfY, width, height })
          break
        }
        case 'signature': {
          console.warn('[LombokPDF/formCreate] Interactive signature fields require the security skill sign() workflow.')
          break
        }
      }
    }

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
