/**
 * LombokPDF — Barcode Generator
 * Supports Code128, EAN-13, EAN-8, UPC-A, ITF, Code39, Code93
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { BarcodeOptions } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

export const BarcodeGenerator = {
  async generate(options: BarcodeOptions, existingDoc?: LombokDocument): Promise<LombokDocument> {
    const {
      data,
      symbology   = 'code128',
      width       = 200,
      height      = 60,
      showText    = true,
      fontSize    = 10,
      color       = '#000000',
      background  = '#ffffff',
      position,
    } = options

    // Render barcode as SVG via jsbarcode (works in Node with a virtual DOM or SVG output mode)
    const JsBarcode = (await import('jsbarcode')).default
    const { DOMImplementation, XMLSerializer } = await import('xmldom')

    const symbologyMap: Record<string, string> = {
      code128: 'CODE128',
      ean13:   'EAN13',
      ean8:    'EAN8',
      upca:    'UPC',
      itf:     'ITF',
      code39:  'CODE39',
      code93:  'CODE93',
    }

    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null)
    const svgNode   = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

    JsBarcode(svgNode, data, {
      format:     symbologyMap[symbology] ?? 'CODE128',
      width:      2,
      height:     height * 0.7,
      displayValue: showText,
      fontSize:   fontSize,
      lineColor:  color,
      background: background,
      margin:     4,
    })

    const svgString = new XMLSerializer().serializeToString(svgNode)

    // Rasterize SVG to PNG for embedding
    const { default: sharp } = await import('sharp')
    const pngBuffer = await sharp(Buffer.from(svgString))
      .resize(width * 2, height * 2)
      .png()
      .toBuffer()

    const { PDFDocument } = await import('pdf-lib')

    if (existingDoc && position) {
      const pdfDoc = await PDFDocument.load(existingDoc._getRaw())
      const pages  = pdfDoc.getPages()
      const page   = pages[(position.page ?? 1) - 1]
      if (!page) throw new Error(`LombokPDF/barcode: page ${position.page} not found`)

      const img   = await pdfDoc.embedPng(pngBuffer)
      const pageH = page.getHeight()

      page.drawImage(img, {
        x:      position.x ?? 40,
        y:      pageH - (position.y ?? 40) - height,
        width,
        height,
      })

      return new Document(await pdfDoc.save())
    }

    // Standalone document
    const pdfDoc = await PDFDocument.create()
    const { width: pageW, height: pageH } = applyPageConfig({ size: 'A4' })
    const page   = pdfDoc.addPage([pageW, pageH])
    const img    = await pdfDoc.embedPng(pngBuffer)

    page.drawImage(img, {
      x:      (pageW - width) / 2,
      y:      (pageH - height) / 2,
      width,
      height,
    })

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
