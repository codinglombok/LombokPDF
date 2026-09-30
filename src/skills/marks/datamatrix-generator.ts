/**
 * LombokPDF — Data Matrix Generator (ISO/IEC 16022)
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { DataMatrixOptions } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

export const DataMatrixGenerator = {
  async generate(options: DataMatrixOptions, existingDoc?: LombokDocument): Promise<LombokDocument> {
    const { data, size = 100, position } = options

    let bwipjs: typeof import('bwip-js')
    try {
      bwipjs = await import('bwip-js')
    } catch {
      throw new Error('LombokPDF/datamatrix: bwip-js is required. Install: npm install bwip-js')
    }

    const pngBuffer = await bwipjs.toBuffer({
      bcid:   'datamatrix',
      text:   data,
      scale:  4,
      height: size / 4,
      width:  size / 4,
    })

    const { PDFDocument } = await import('pdf-lib')

    if (existingDoc && position) {
      const pdfDoc = await PDFDocument.load(existingDoc._getRaw())
      const page   = pdfDoc.getPages()[(position.page ?? 1) - 1]
      if (!page) throw new Error(`LombokPDF/datamatrix: page ${position.page} not found`)

      const img   = await pdfDoc.embedPng(pngBuffer)
      const pageH = page.getHeight()

      page.drawImage(img, {
        x: position.x ?? 40,
        y: pageH - (position.y ?? 40) - size,
        width:  size,
        height: size,
      })

      return new Document(await pdfDoc.save())
    }

    const pdfDoc = await PDFDocument.create()
    const { width: pageW, height: pageH } = applyPageConfig({ size: 'A4' })
    const page  = pdfDoc.addPage([pageW, pageH])
    const img   = await pdfDoc.embedPng(pngBuffer)

    page.drawImage(img, {
      x: (pageW - size) / 2,
      y: (pageH - size) / 2,
      width:  size,
      height: size,
    })

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
