/**
 * LombokPDF — PDF Splitter
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { SplitOptions } from './index.js'

export const PDFSplitter = {
  async split(doc: LombokDocument, options: SplitOptions): Promise<LombokDocument> {
    const { PDFDocument } = await import('pdf-lib')

    const srcDoc    = await PDFDocument.load(doc._getRaw())
    const pageCount = srcDoc.getPageCount()

    let pageIndices: number[]

    if ('pages' in options) {
      pageIndices = parsePageRange(options.pages, pageCount)
    } else if ('bookmark' in options) {
      // Bookmark-based split — requires page label matching
      // Simplified: fall back to first page if bookmark not found
      pageIndices = [0]
      console.warn('[LombokPDF/split] Bookmark splitting requires Stage 2 WASM engine. Falling back to first page.')
    } else {
      // chapter: split at h1 boundaries — not available in Stage 1
      pageIndices = Array.from({ length: pageCount }, (_, i) => i)
    }

    const newDoc       = await PDFDocument.create()
    const copiedPages  = await newDoc.copyPages(srcDoc, pageIndices)
    for (const page of copiedPages) newDoc.addPage(page)

    newDoc.setProducer('LombokPDF')
    const bytes = await newDoc.save()
    return new Document(bytes)
  },
}

/**
 * Parse a page range string into 0-based page indices.
 * Supports: '1', '1-5', '2,4,6', '3-', '-5', 'all'
 */
function parsePageRange(range: string, pageCount: number): number[] {
  const trimmed = range.trim().toLowerCase()

  if (trimmed === 'all' || trimmed === '') {
    return Array.from({ length: pageCount }, (_, i) => i)
  }

  const indices = new Set<number>()

  for (const part of trimmed.split(',')) {
    const p = part.trim()

    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-')
      const start = startStr?.trim() === '' ? 1      : parseInt(startStr ?? '1', 10)
      const end   = endStr?.trim()   === '' ? pageCount : parseInt(endStr   ?? String(pageCount), 10)

      const s = Math.max(1, start) - 1
      const e = Math.min(pageCount, end) - 1

      for (let i = s; i <= e; i++) indices.add(i)
    } else {
      const n = parseInt(p, 10)
      if (!isNaN(n) && n >= 1 && n <= pageCount) {
        indices.add(n - 1)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}
