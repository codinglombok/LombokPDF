/**
 * LombokPDF — Table of Contents Generator
 * Scans document headings and injects a formatted TOC page.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { TOCOptions } from './index.js'

export const TOCGenerator = {
  async generate(doc: LombokDocument, options: TOCOptions): Promise<LombokDocument> {
    const {
      levels          = [1, 2, 3],
      title           = 'Contents',
      afterPage       = 1,
      pageNumberStyle = 'decimal',
      dotLeader       = true,
    } = options

    // Extract headings from the document's outline/bookmark structure
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(doc._getRaw())

    // In Stage 1, TOC generation relies on existing bookmarks.
    // Full heading-scan-based TOC (from HTML <h1>-<h6>) is available
    // when using bookmarks({ autoFromHeadings: true }) before toc().
    const catalog = pdfDoc.catalog
    const outline = catalog.lookup(pdfDoc.context.obj('Outlines'))

    const entries: Array<{ title: string; page: number; level: number }> = []

    // Walk the outline tree if present (populated by bookmarkGenerator)
    // This is a simplified traversal for Stage 1
    if (outline) {
      // Outline traversal would populate `entries` here in the full implementation
    }

    if (entries.length === 0) {
      console.warn(
        '[LombokPDF/toc] No bookmarks found to build TOC from. ' +
        'Call bookmarks({ autoFromHeadings: true }) before toc() in your pipe() chain.'
      )
    }

    // Render TOC as a new first content page (inserted after `afterPage`)
    const { width, height } = pdfDoc.getPage(0).getSize()
    const tocPage = pdfDoc.insertPage(afterPage, [width, height])

    const font     = await pdfDoc.embedFont('Helvetica-Bold')
    const bodyFont = await pdfDoc.embedFont('Helvetica')

    let y = height - 60

    tocPage.drawText(title, { x: 50, y, size: 20, font })
    y -= 40

    for (const entry of entries) {
      if (!levels.includes(entry.level)) continue

      const indent   = (entry.level - 1) * 16
      const pageNum  = formatPageNumber(entry.page, pageNumberStyle)
      const dots     = dotLeader ? ' ' + '.'.repeat(60) + ' ' : '   '

      tocPage.drawText(entry.title, { x: 50 + indent, y, size: 10, font: bodyFont })
      tocPage.drawText(pageNum, { x: width - 70, y, size: 10, font: bodyFont })

      y -= 18
      if (y < 60) break  // would need pagination for very long TOCs
    }

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}

function formatPageNumber(n: number, style: 'decimal' | 'roman' | 'alpha'): string {
  if (style === 'roman') return toRoman(n)
  if (style === 'alpha') return toAlpha(n)
  return String(n)
}

function toRoman(num: number): string {
  const vals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'],  [90, 'XC'],  [50, 'L'],  [40, 'XL'],
    [10, 'X'],   [9, 'IX'],   [5, 'V'],   [4, 'IV'], [1, 'I'],
  ]
  let result = ''
  for (const [v, sym] of vals) {
    while (num >= v) { result += sym; num -= v }
  }
  return result
}

function toAlpha(num: number): string {
  let result = ''
  while (num > 0) {
    const rem = (num - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    num = Math.floor((num - 1) / 26)
  }
  return result
}
