/**
 * SVG → PDF XObject Embedder
 * Rasterizes SVG at high DPI and embeds as image, or embeds as native SVG via pdf-lib.
 */

import type { SVGEmbedOptions } from './index.js'

export async function embedSVGInPDF(
  pdfBytes: Uint8Array,
  svg: string,
  opts: SVGEmbedOptions,
): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFStream, rgb } = await import('pdf-lib')

  // Load existing PDF
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages  = pdfDoc.getPages()
  const page   = pages[opts.page]

  if (!page) {
    throw new Error(`LombokPDF/charts: page index ${opts.page} does not exist (document has ${pages.length} pages)`)
  }

  const pageHeight = page.getHeight()

  // Strategy 1: Embed as rasterized PNG at 2× DPI (sharp, clean)
  // Strategy 2: Native SVG via pdf-lib (experimental)
  // We use Strategy 1 for maximum compatibility

  const png = await rasterizeSVG(svg, opts.width, opts.height)

  const pngImage = await pdfDoc.embedPng(png)

  // pdf-lib y coordinate is from bottom; convert from top
  const pdfY = pageHeight - opts.y - opts.height

  page.drawImage(pngImage, {
    x:      opts.x,
    y:      pdfY,
    width:  opts.width,
    height: opts.height,
    opacity: 1,
  })

  return pdfDoc.save()
}

async function rasterizeSVG(svg: string, width: number, height: number): Promise<Uint8Array> {
  // In Node.js: use sharp or canvas to rasterize SVG
  // In browser: use OffscreenCanvas
  if (typeof window === 'undefined') {
    return rasterizeSVGNode(svg, width, height)
  }
  return rasterizeSVGBrowser(svg, width, height)
}

async function rasterizeSVGNode(svg: string, width: number, height: number): Promise<Uint8Array> {
  try {
    // Try sharp (preferred — fastest, best quality)
    const sharp = await import('sharp')
    const buf   = Buffer.from(svg, 'utf-8')
    const png   = await sharp.default(buf)
      .resize(width * 2, height * 2)   // 2× for retina quality
      .png({ compressionLevel: 6 })
      .toBuffer()
    return new Uint8Array(png)
  } catch {
    // Fallback: return SVG as-is encoded as PNG via canvas
    // (canvas must be installed separately)
    try {
      const { createCanvas, loadImage } = await import('canvas')
      const canvas = createCanvas(width * 2, height * 2)
      const ctx    = canvas.getContext('2d')
      ctx.scale(2, 2)
      const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      const img        = await loadImage(svgDataUri)
      ctx.drawImage(img, 0, 0, width, height)
      return new Uint8Array(canvas.toBuffer('image/png'))
    } catch {
      throw new Error(
        'LombokPDF/charts: cannot rasterize SVG. Install sharp: npm install sharp'
      )
    }
  }
}

async function rasterizeSVGBrowser(svg: string, width: number, height: number): Promise<Uint8Array> {
  const scale   = 2  // retina
  const canvas  = new OffscreenCanvas(width * scale, height * scale)
  const ctx     = canvas.getContext('2d')!

  ctx.scale(scale, scale)

  const svgBlob  = new Blob([svg], { type: 'image/svg+xml' })
  const url      = URL.createObjectURL(svgBlob)
  const img      = await createImageBitmap(await fetch(url).then(r => r.blob()))

  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(url)

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}
