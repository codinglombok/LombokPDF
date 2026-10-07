/**
 * LombokPDF — QR Code Generator
 *
 * Encodes with LombokQRCode (ISO/IEC 18004, zero dependencies) and draws the
 * module matrix straight into the page as vector rectangles: crisp at any zoom,
 * no SVG-to-PNG rasterization and no native image library.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { QRCodeOptions } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

/** A dark area of the symbol in module units: `w` modules wide on row `y`. */
export interface ModuleRun {
  x: number
  y: number
  w: number
}

/** Merge horizontally adjacent dark modules into runs (fewer drawing operators). */
export function moduleRuns(modules: boolean[][]): ModuleRun[] {
  const runs: ModuleRun[] = []
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) { x++; continue }
      const start = x
      while (x < row.length && row[x]) x++
      runs.push({ x: start, y, w: x - start })
    }
  })
  return runs
}

/** Parse `#rgb` / `#rrggbb` into 0..1 components. */
export function hexToRGB(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`LombokPDF/qrcode: invalid color '${hex}' (expected #rgb or #rrggbb)`)
  const h = m[1]!.length === 3 ? m[1]!.replace(/./g, c => c + c) : m[1]!
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

export const QRCodeGenerator = {
  async generate(options: QRCodeOptions, existingDoc?: LombokDocument): Promise<LombokDocument> {
    const {
      data,
      errorCorrectionLevel = 'M',
      size       = 100,
      margin     = 4,
      color      = '#000000',
      background = '#ffffff',
      position,
    } = options

    if (!(size > 0)) throw new Error('LombokPDF/qrcode: size must be a positive number of points')
    if (!Number.isInteger(margin) || margin < 0) throw new Error('LombokPDF/qrcode: margin must be a non-negative integer')

    const { encodeQR } = await import('lombokqrcode')
    const symbol = encodeQR(data, { errorCorrectionLevel })
    const runs   = moduleRuns(symbol.modules)
    const unit   = size / (symbol.size + 2 * margin)

    const { PDFDocument, rgb } = await import('pdf-lib')
    const fg = rgb(...hexToRGB(color))
    const bg = rgb(...hexToRGB(background))

    let pdfDoc: Awaited<ReturnType<typeof PDFDocument.create>>
    let page: ReturnType<typeof pdfDoc.addPage>
    let left: number
    let bottom: number

    if (existingDoc && position) {
      // Embed into existing document; position.y is measured from the top edge
      pdfDoc = await PDFDocument.load(existingDoc._getRaw())
      const target = pdfDoc.getPages()[(position.page ?? 1) - 1]
      if (!target) throw new Error(`LombokPDF/qrcode: page ${position.page} not found`)
      page   = target
      left   = position.x ?? 40
      bottom = page.getHeight() - (position.y ?? 40) - size
    } else {
      // Standalone: a new A4 document with the symbol centred
      pdfDoc = await PDFDocument.create()
      const { width, height } = applyPageConfig({ size: 'A4' })
      page   = pdfDoc.addPage([width, height])
      left   = (width - size) / 2
      bottom = (height - size) / 2
      pdfDoc.setProducer('LombokPDF')
    }

    page.drawRectangle({ x: left, y: bottom, width: size, height: size, color: bg, borderWidth: 0 })
    const top = bottom + size - margin * unit
    for (const run of runs) {
      page.drawRectangle({
        x:      left + (margin + run.x) * unit,
        y:      top - (run.y + 1) * unit,
        width:  run.w * unit,
        height: unit,
        color:  fg,
        borderWidth: 0,
      })
    }

    return new Document(await pdfDoc.save())
  },
}
