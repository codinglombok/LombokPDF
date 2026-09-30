/**
 * LombokPDF — PDF Rotator
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { RotateOptions } from './index.js'

export const PDFRotator = {
  async rotate(doc: LombokDocument, options: RotateOptions): Promise<LombokDocument> {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc   = await PDFDocument.load(doc._getRaw())
    const allPages = pdfDoc.getPages()
    const pageSet  = resolvePageSet(options.pages ?? 'all', allPages.length)

    for (const idx of pageSet) {
      const page = allPages[idx]
      if (!page) continue
      const current = page.getRotation().angle
      page.setRotation({ type: 'degrees', angle: (current + options.degrees) % 360 } as any)
    }

    return new Document(await pdfDoc.save())
  },
}

function resolvePageSet(pages: string, total: number): number[] {
  if (pages === 'all') return Array.from({ length: total }, (_, i) => i)
  const result: number[] = []
  for (const part of pages.split(',')) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-').map(n => parseInt(n.trim(), 10) - 1)
      for (let i = Math.max(0, s ?? 0); i <= Math.min(e ?? total - 1, total - 1); i++) result.push(i)
    } else {
      const n = parseInt(trimmed, 10) - 1
      if (!isNaN(n) && n >= 0 && n < total) result.push(n)
    }
  }
  return result
}
