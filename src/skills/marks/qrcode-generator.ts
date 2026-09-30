/**
 * LombokPDF — QR Code Generator
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { QRCodeOptions } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

export const QRCodeGenerator = {
  async generate(options: QRCodeOptions, existingDoc?: LombokDocument): Promise<LombokDocument> {
    const {
      data,
      errorCorrectionLevel = 'M',
      size     = 100,
      margin   = 4,
      color    = '#000000',
      background = '#ffffff',
      renderer = 'svg',
      position,
    } = options

    // Generate QR as SVG (crisp in PDF) or PNG (raster)
    let qrImageBytes: Uint8Array
    let mimeType: 'image/png' | 'image/svg+xml'

    if (renderer === 'svg') {
      const QRCode = (await import('qrcode')).default
      const svgStr = await QRCode.toString(data, {
        type:                 'svg',
        errorCorrectionLevel: errorCorrectionLevel as any,
        margin,
        color: { dark: color, light: background },
      })
      qrImageBytes = new TextEncoder().encode(svgStr)
      mimeType     = 'image/svg+xml'
    } else {
      const QRCode = (await import('qrcode')).default
      const pngBuf = await QRCode.toBuffer(data, {
        type:                 'png',
        errorCorrectionLevel: errorCorrectionLevel as any,
        margin,
        color: { dark: color, light: background },
        width: size * 2,   // 2× for retina
      })
      qrImageBytes = new Uint8Array(pngBuf)
      mimeType     = 'image/png'
    }

    const { PDFDocument } = await import('pdf-lib')

    if (existingDoc && position) {
      // Embed into existing document at position
      const pdfDoc = await PDFDocument.load(existingDoc._getRaw())
      const pages  = pdfDoc.getPages()
      const page   = pages[(position.page ?? 1) - 1]
      if (!page) throw new Error(`LombokPDF/qrcode: page ${position.page} not found`)

      const pageH  = page.getHeight()

      let img
      if (mimeType === 'image/svg+xml') {
        // Rasterize SVG to PNG for embedding
        const { default: sharp } = await import('sharp')
        const png = await sharp(Buffer.from(qrImageBytes)).png().toBuffer()
        img = await pdfDoc.embedPng(png)
      } else {
        img = await pdfDoc.embedPng(qrImageBytes)
      }

      page.drawImage(img, {
        x:      position.x ?? 40,
        y:      pageH - (position.y ?? 40) - size,
        width:  size,
        height: size,
      })

      return new Document(await pdfDoc.save())
    }

    // Standalone: create a new document with the QR code
    const pdfDoc = await PDFDocument.create()
    const { width, height } = applyPageConfig({ size: 'A4' })
    const page   = pdfDoc.addPage([width, height])

    let img
    if (mimeType === 'image/svg+xml') {
      const { default: sharp } = await import('sharp')
      const png = await sharp(Buffer.from(qrImageBytes)).png().toBuffer()
      img = await pdfDoc.embedPng(png)
    } else {
      img = await pdfDoc.embedPng(qrImageBytes)
    }

    // Center on page
    page.drawImage(img, {
      x:      (width  - size) / 2,
      y:      (height - size) / 2,
      width:  size,
      height: size,
    })

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
