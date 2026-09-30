/**
 * LombokPDF — PDF Merger
 * Merges multiple PDF documents into one using pdf-lib.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { MergeOptions } from './index.js'

export const PDFMerger = {
  async merge(docs: LombokDocument[], options: MergeOptions): Promise<LombokDocument> {
    const { PDFDocument } = await import('pdf-lib')

    const merged = await PDFDocument.create()

    // Optionally add a bookmark per merged document
    const { bookmarks = [] } = options

    for (let i = 0; i < docs.length; i++) {
      const srcBytes = docs[i]!._getRaw()
      const srcDoc   = await PDFDocument.load(srcBytes, {
        ignoreEncryption: false,  // respect encryption
      })

      const pageCount  = srcDoc.getPageCount()
      const indices    = Array.from({ length: pageCount }, (_, idx) => idx)
      const copiedPages = await merged.copyPages(srcDoc, indices)

      const bookmarkLabel = bookmarks[i]
      const startPageIdx  = merged.getPageCount()

      for (const page of copiedPages) {
        merged.addPage(page)
      }

      // Add bookmark if label provided
      if (bookmarkLabel) {
        // Note: full bookmark API available in Stage 2+ with pdf-lib bookmark extension
        merged.setTitle(merged.getTitle() ?? '')
      }
    }

    // Copy metadata from first document if available
    const firstBytes = docs[0]!._getRaw()
    try {
      const firstDoc = await PDFDocument.load(firstBytes)
      const title    = firstDoc.getTitle()
      if (title) merged.setTitle(title)
    } catch { /* ignore metadata copy failures */ }

    merged.setProducer('LombokPDF')
    merged.setCreator('LombokPDF')
    merged.setModificationDate(new Date())

    const mergedBytes = await merged.save()
    return new Document(mergedBytes)
  },
}
