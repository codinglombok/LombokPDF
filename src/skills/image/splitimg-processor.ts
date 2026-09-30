/**
 * LombokPDF — SplitImg Processor
 *
 * Slices a large image into a grid of cells and lays them out on PDF pages.
 *
 * Use cases:
 *  - ID photo sheets (4×6 passport photos on A4)
 *  - Contact sheets
 *  - Label sheets (product label printing)
 *  - Tiled image printing
 *  - Collage / photo mosaic creation
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { SplitimgOptions } from './index.js'
import { applyPageConfig } from '../../core/lle/page.js'

export const SplitimgProcessor = {
  async process(
    imagePath: string | Uint8Array,
    options: SplitimgOptions,
  ): Promise<LombokDocument> {
    const {
      cols,
      rows,
      gutter       = 0,
      pageSize     = 'A4',
      orientation  = 'portrait',
      fit          = 'contain',
      margin       = 36,
      showBorders  = false,
    } = options

    // Resolve page dimensions
    const { width: pageW, height: pageH } = applyPageConfig({ size: pageSize as any, orientation })

    // Content area
    const contentW = pageW - margin * 2
    const contentH = pageH - margin * 2

    // Cell dimensions
    const cellW = (contentW - gutter * (cols - 1)) / cols
    const cellH = (contentH - gutter * (rows - 1)) / rows

    // Load image
    let sharp: typeof import('sharp')
    try {
      sharp = (await import('sharp')).default as any
    } catch {
      throw new Error('LombokPDF/splitimg: sharp is required. Install: npm install sharp')
    }

    const imgBuffer = typeof imagePath === 'string'
      ? await (await import('node:fs/promises')).readFile(imagePath)
      : Buffer.from(imagePath)

    const image   = sharp(imgBuffer)
    const meta    = await image.metadata()
    const imgW    = meta.width  ?? 800
    const imgH    = meta.height ?? 600

    // Calculate slice coordinates for each cell
    const sliceW = Math.floor(imgW / cols)
    const sliceH = Math.floor(imgH / rows)

    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()

    let currentPage  = pdfDoc.addPage([pageW, pageH])
    let cellIdx      = 0
    const totalCells = cols * rows

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Extract cell slice from original image
        const sx = col * sliceW
        const sy = row * sliceH
        const sw = col === cols - 1 ? imgW - sx : sliceW
        const sh = row === rows - 1 ? imgH - sy : sliceH

        const cellPNG = await sharp(imgBuffer)
          .extract({ left: sx, top: sy, width: sw, height: sh })
          .resize(
            Math.round(cellW * 2),
            Math.round(cellH * 2),
            { fit: fit === 'fill' ? 'fill' : fit === 'cover' ? 'cover' : 'inside' }
          )
          .png({ compressionLevel: 6 })
          .toBuffer()

        const embeddedImg = await pdfDoc.embedPng(cellPNG)

        // Calculate position (pdf-lib: y from bottom)
        const x = margin + col * (cellW + gutter)
        const y = pageH - margin - (row + 1) * cellH - row * gutter

        currentPage.drawImage(embeddedImg, {
          x,
          y,
          width:  cellW,
          height: cellH,
        })

        if (showBorders) {
          currentPage.drawRectangle({
            x,
            y,
            width:        cellW,
            height:       cellH,
            borderColor:  { type: 'rgb', red: 0.8, green: 0.8, blue: 0.8 },
            borderWidth:  0.5,
          })
        }

        cellIdx++
      }
    }

    pdfDoc.setProducer('LombokPDF')
    pdfDoc.setCreator('LombokPDF — splitimg')
    pdfDoc.setCreationDate(new Date())

    const bytes = await pdfDoc.save()
    return new Document(bytes)
  },
}
