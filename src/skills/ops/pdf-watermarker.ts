/**
 * LombokPDF — PDF Watermarker
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { WatermarkOptions } from './index.js'

export const PDFWatermarker = {
  async apply(doc: LombokDocument, options: WatermarkOptions): Promise<LombokDocument> {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')

    const {
      text      = 'WATERMARK',
      opacity   = 0.15,
      rotation  = 45,
      fontSize  = 60,
      color     = '#888888',
      pages     = 'all',
    } = options

    const pdfDoc    = await PDFDocument.load(doc._getRaw())
    const font      = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const allPages  = pdfDoc.getPages()
    const pageSet   = resolvePageSet(pages, allPages.length)

    const { r, g, b } = hexToRGB(color)

    for (const idx of pageSet) {
      const page = allPages[idx]
      if (!page) continue

      const { width, height } = page.getSize()

      if (options.image) {
        // Image watermark
        let img
        const imgBytes = typeof options.image === 'string'
          ? (await import('node:fs/promises')).readFile(options.image)
          : options.image
        const resolvedBytes = await (imgBytes instanceof Promise ? imgBytes : Promise.resolve(imgBytes))
        try {
          img = await pdfDoc.embedPng(resolvedBytes)
        } catch {
          img = await pdfDoc.embedJpg(resolvedBytes)
        }
        page.drawImage(img, {
          x:       width  / 2 - 100,
          y:       height / 2 - 50,
          width:   200,
          height:  100,
          opacity,
          rotate:  degrees(rotation),
        })
      } else {
        // Text watermark
        const textWidth = font.widthOfTextAtSize(text, fontSize)
        page.drawText(text, {
          x:        width  / 2 - textWidth / 2,
          y:        height / 2 - fontSize  / 2,
          size:     fontSize,
          font,
          color:    rgb(r, g, b),
          opacity,
          rotate:   degrees(rotation),
        })
      }
    }

    return new Document(await pdfDoc.save())
  },
}

function resolvePageSet(pages: string, total: number): number[] {
  if (pages === 'all') return Array.from({ length: total }, (_, i) => i)
  const result: number[] = []
  for (const part of pages.split(',')) {
    const [s, e] = part.split('-').map(n => parseInt(n.trim(), 10) - 1)
    if (e === undefined || isNaN(e + 1)) {
      if (!isNaN(s)) result.push(Math.max(0, Math.min(s, total - 1)))
    } else {
      for (let i = Math.max(0, s); i <= Math.min(e, total - 1); i++) result.push(i)
    }
  }
  return result
}

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  }
}
