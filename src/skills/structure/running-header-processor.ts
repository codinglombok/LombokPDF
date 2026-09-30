/**
 * LombokPDF — Running Header/Footer Processor
 * Adds or updates per-page running headers and footers.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { RunningHeaderOptions } from './index.js'

export const RunningHeaderProcessor = {
  async process(doc: LombokDocument, options: RunningHeaderOptions): Promise<LombokDocument> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

    const {
      all, left, right, footer,
      startPage = 1,
      fontSize  = 9,
      color     = '#666666',
    } = options

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const pages  = pdfDoc.getPages()
    const total  = pages.length

    const { r, g, b } = hexToRGB(color)

    for (let i = startPage - 1; i < total; i++) {
      const page = pages[i]
      if (!page) continue

      const { width, height } = page.getSize()
      const pageNum = i + 1
      const isEven  = pageNum % 2 === 0

      const headerContent = resolveContent(
        isEven ? (left ?? all) : (right ?? all),
        pageNum, total,
      )

      if (headerContent) {
        page.drawText(headerContent, {
          x: isEven ? 40 : width - 40 - font.widthOfTextAtSize(headerContent, fontSize),
          y: height - 30,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        })
      }

      const footerContent = resolveContent(footer, pageNum, total)
      if (footerContent) {
        const textWidth = font.widthOfTextAtSize(footerContent, fontSize)
        page.drawText(footerContent, {
          x: (width - textWidth) / 2,
          y: 24,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        })
      }
    }

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}

function resolveContent(
  value: string | ((pageNum: number, total: number) => string) | undefined,
  pageNum: number,
  total: number,
): string | undefined {
  if (typeof value === 'function') return value(pageNum, total)
  return value
}

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  }
}
