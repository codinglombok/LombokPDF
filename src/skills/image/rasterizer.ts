/**
 * LombokPDF — Page Rasterizer
 * Converts PDF pages to PNG/JPEG images at configurable DPI.
 */

import type { RasterizeOptions } from './index.js'

export const Rasterizer = {
  async rasterize(
    source: string | Uint8Array,
    options: RasterizeOptions = {},
  ): Promise<Uint8Array[]> {
    const {
      dpi     = 150,
      format  = 'png',
      quality = 90,
      pages   = 'all',
    } = options

    // Node.js: use pdf2pic or similar
    // Stage 1: return placeholder until Stage 2 WASM renderer available
    try {
      const { fromBuffer } = await import('pdf2pic')
      const buf = typeof source === 'string'
        ? (await import('node:fs/promises')).readFile(source)
        : Promise.resolve(Buffer.from(source))

      const pdfBuffer = await buf

      const converter = fromBuffer(pdfBuffer, {
        density:        dpi,
        format:         format === 'jpeg' ? 'jpg' : 'png',
        quality:        quality,
        width:          Math.round(595 * dpi / 72),   // A4 width at given DPI
        height:         Math.round(842 * dpi / 72),
      })

      const totalPages = await _getPageCount(pdfBuffer)
      const pageIndices = resolvePageIndices(pages, totalPages)

      const results: Uint8Array[] = []
      for (const pageIdx of pageIndices) {
        const result = await converter(pageIdx + 1, { responseType: 'buffer' })
        if (result.buffer) {
          results.push(new Uint8Array(result.buffer))
        }
      }
      return results

    } catch {
      // pdf2pic not available — return empty array with warning
      console.warn('[LombokPDF/rasterize] pdf2pic not installed. Install: npm install pdf2pic')
      return []
    }
  },
}

async function _getPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(pdfBuffer)
    return doc.getPageCount()
  } catch {
    return 1
  }
}

function resolvePageIndices(pages: string, total: number): number[] {
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
  return [...new Set(result)].sort((a, b) => a - b)
}
