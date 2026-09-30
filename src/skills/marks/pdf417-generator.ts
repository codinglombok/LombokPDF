/**
 * LombokPDF — PDF417 Stacked Barcode Generator
 * Used in shipping labels, ID cards, boarding passes.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { PDF417Options } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

export const PDF417Generator = {
  async generate(options: PDF417Options, existingDoc?: LombokDocument): Promise<LombokDocument> {
    const {
      data,
      columns = 6,
      errorCorrectionLevel = 2,
      width  = 200,
      height = 80,
      position,
    } = options

    let bwipjs: typeof import('bwip-js')
    try {
      bwipjs = await import('bwip-js')
    } catch {
      throw new Error('LombokPDF/pdf417: bwip-js is required. Install: npm install bwip-js')
    }

    const pngBuffer = await bwipjs.toBuffer({
      bcid:      'pdf417',
      text:      data,
      columns,
      eclevel:   errorCorrectionLevel,
      scale:     3,
    })

    const { PDFDocument } = await import('pdf-lib')

    if (existingDoc && position) {
      const pdfDoc = await PDFDocument.load(existingDoc._getRaw())
      const page   = pdfDoc.getPages()[(position.page ?? 1) - 1]
      if (!page) throw new Error(`LombokPDF/pdf417: page ${position.page} not found`)

      const img   = await pdfDoc.embedPng(pngBuffer)
      const pageH = page.getHeight()

      page.drawImage(img, {
        x: position.x ?? 40,
        y: pageH - (position.y ?? 40) - height,
        width,
        height,
      })

      return new Document(await pdfDoc.save())
    }

    const pdfDoc = await PDFDocument.create()
    const { width: pageW, height: pageH } = applyPageConfig({ size: 'A4' })
    const page  = pdfDoc.addPage([pageW, pageH])
    const img   = await pdfDoc.embedPng(pngBuffer)

    page.drawImage(img, {
      x: (pageW - width) / 2,
      y: (pageH - height) / 2,
      width,
      height,
    })

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
