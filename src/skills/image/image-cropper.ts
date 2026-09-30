/**
 * LombokPDF — Image Cropper
 * Crops a region from a source image or rasterized PDF page.
 */

import type { CropOptions } from './index.js'

export const ImageCropper = {
  async crop(source: string | Uint8Array, options: CropOptions): Promise<Uint8Array> {
    const { x, y, width, height, format = 'png' } = options

    const sharp = (await import('sharp')).default

    const inputBuffer = typeof source === 'string'
      ? await (await import('node:fs/promises')).readFile(source)
      : Buffer.from(source)

    const pipeline = sharp(inputBuffer).extract({
      left:   Math.max(0, Math.round(x)),
      top:    Math.max(0, Math.round(y)),
      width:  Math.round(width),
      height: Math.round(height),
    })

    const output = format === 'jpeg'
      ? await pipeline.jpeg({ quality: 90 }).toBuffer()
      : await pipeline.png({ compressionLevel: 6 }).toBuffer()

    return new Uint8Array(output)
  },
}
