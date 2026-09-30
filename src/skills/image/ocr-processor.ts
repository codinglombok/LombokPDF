/**
 * LombokPDF — OCR Processor
 * Adds a selectable text layer to scanned PDF pages using Tesseract.js.
 *
 * Requires: npm install tesseract.js
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { OCROptions } from './index.js'

const LANG_MAP: Record<string, string> = {
  en: 'eng', ar: 'ara', zh: 'chi_sim', ja: 'jpn', ko: 'kor',
  fr: 'fra', de: 'deu', es: 'spa', pt: 'por', ru: 'rus',
  th: 'tha', hi: 'hin', id: 'ind', vi: 'vie',
}

export const OCRProcessor = {
  async process(doc: LombokDocument, options: OCROptions): Promise<LombokDocument> {
    const {
      language  = 'eng',
      mode      = 'neural',
      pages     = 'all',
      textLayer = true,
    } = options

    let Tesseract: typeof import('tesseract.js')
    try {
      Tesseract = await import('tesseract.js')
    } catch {
      throw new Error(
        'LombokPDF/ocr: tesseract.js is required. Install: npm install tesseract.js'
      )
    }

    const langs = (Array.isArray(language) ? language : [language])
      .map(l => LANG_MAP[l] ?? l)
      .join('+')

    // Rasterize pages to images for OCR input
    const { Rasterizer } = await import('./rasterizer.js')
    const pageImages = await Rasterizer.rasterize(doc._getRaw(), { dpi: 300, pages })

    if (pageImages.length === 0) {
      console.warn('[LombokPDF/ocr] No pages could be rasterized. Ensure pdf2pic is installed.')
      return doc
    }

    const worker = await Tesseract.createWorker(langs)

    const recognizedPages: Array<{ text: string; words: Array<{ text: string; bbox: any }> }> = []

    try {
      for (const imgBytes of pageImages) {
        const { data } = await worker.recognize(Buffer.from(imgBytes))
        recognizedPages.push({
          text:  data.text,
          words: (data.words ?? []).map(w => ({ text: w.text, bbox: w.bbox })),
        })
      }
    } finally {
      await worker.terminate()
    }

    if (!textLayer) {
      // Just return original doc with recognized text stored in metadata
      return doc.setMetadata({
        ...doc.metadata(),
        keywords: [...(doc.metadata().keywords ?? []), 'OCR_PROCESSED'],
      })
    }

    // Embed invisible text layer over each page at recognized word positions
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const pdfPages = pdfDoc.getPages()

    recognizedPages.forEach((recognized, idx) => {
      const page = pdfPages[idx]
      if (!page) return

      const { height: pageHeight, width: pageWidth } = page.getSize()
      // Scale from 300 DPI raster coordinates back to PDF points (72 DPI)
      const scale = 72 / 300

      for (const word of recognized.words) {
        if (!word.text.trim()) continue
        const bbox = word.bbox
        const x = bbox.x0 * scale
        const y = pageHeight - bbox.y1 * scale

        page.drawText(word.text, {
          x, y,
          size: (bbox.y1 - bbox.y0) * scale,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,  // invisible — searchable/selectable but not visually rendered
        })
      }
    })

    pdfDoc.setProducer('LombokPDF')
    return new Document(await pdfDoc.save())
  },
}
