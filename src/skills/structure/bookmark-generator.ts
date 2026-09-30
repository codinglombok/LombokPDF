/**
 * LombokPDF — Bookmark/Outline Generator
 * Builds the PDF outline tree from HTML headings or a manual entry list.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { BookmarksOptions, BookmarkEntry } from './index.js'

export const BookmarkGenerator = {
  async generate(doc: LombokDocument, options: BookmarksOptions): Promise<LombokDocument> {
    const {
      autoFromHeadings = true,
      levels           = [1, 2, 3],
      manual           = [],
    } = options

    const { PDFDocument, PDFDict, PDFArray, PDFString, PDFRef, PDFName, PDFNumber } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const context = pdfDoc.context

    let entries: BookmarkEntry[] = [...manual]

    if (autoFromHeadings) {
      // In Stage 1, heading extraction happens at HTML-parse time and is
      // passed through document metadata. Stage 2's WASM engine tags
      // headings directly during layout for precise page association.
      const metaHeadings = (doc.metadata() as any)._headings as BookmarkEntry[] | undefined
      if (metaHeadings) {
        entries = [...entries, ...metaHeadings.filter(h => levels.includes(h.level ?? 1))]
      }
    }

    if (entries.length === 0) {
      console.warn('[LombokPDF/bookmarks] No headings or manual entries found — outline will be empty.')
      return doc
    }

    // Build the outline dictionary tree
    const outlineRefs: PDFRef[] = []
    let prevRef: PDFRef | null = null
    let firstRef: PDFRef | null = null

    for (const entry of entries) {
      const pageIndex = Math.max(0, Math.min(entry.page - 1, pdfDoc.getPageCount() - 1))
      const page = pdfDoc.getPage(pageIndex)

      const destArray = context.obj([
        page.ref,
        PDFName.of('XYZ'),
        PDFNumber.of(0),
        PDFNumber.of(page.getHeight()),
        PDFNumber.of(0),
      ])

      const itemDict = context.obj({
        Title: PDFString.of(entry.title),
        Dest:  destArray,
        Parent: undefined, // set below
      })

      const itemRef = context.register(itemDict)
      if (!firstRef) firstRef = itemRef
      if (prevRef) {
        const prevDict = context.lookup(prevRef, PDFDict)
        prevDict.set(PDFName.of('Next'), itemRef)
        itemDict.set(PDFName.of('Prev'), prevRef)
      }

      outlineRefs.push(itemRef)
      prevRef = itemRef
    }

    const outlinesDict = context.obj({
      Type:  PDFName.of('Outlines'),
      First: firstRef,
      Last:  prevRef,
      Count: PDFNumber.of(outlineRefs.length),
    })

    const outlinesRef = context.register(outlinesDict)

    // Set Parent references
    for (const ref of outlineRefs) {
      const dict = context.lookup(ref, PDFDict)
      dict.set(PDFName.of('Parent'), outlinesRef)
    }

    pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef)
    pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
