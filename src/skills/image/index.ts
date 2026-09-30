import type { Document } from '../../core/Document.js'

// ─── Split Image ──────────────────────────────────────────────────────────────

export interface SplitimgOptions {
  /** Number of columns in the grid */
  cols: number
  /** Number of rows in the grid */
  rows: number
  /** Spacing between cells in points (default: 0) */
  gutter?: number
  /** Page size (default: 'A4') */
  pageSize?: 'A4' | 'A3' | 'Letter' | [number, number]
  /** Page orientation (default: 'portrait') */
  orientation?: 'portrait' | 'landscape'
  /** Image fitting (default: 'contain') */
  fit?: 'fill' | 'contain' | 'cover'
  /** Page margins in points (default: 36) */
  margin?: number
  /** Show grid cell borders (default: false) */
  showBorders?: boolean
}

/**
 * Slice a large image into a PDF grid layout.
 *
 * @example
 * ```typescript
 * import { splitimg } from 'lombokpdf/skills/image'
 *
 * // Slice photo.jpg into a 3×4 grid (12 cells) on A4
 * const doc = await splitimg('./photo.jpg', { cols: 3, rows: 4 })
 * await doc.save('grid.pdf')
 * ```
 *
 * CLI: lombokpdf splitimg photo.jpg --cols 3 --rows 4 -o grid.pdf
 */
export async function splitimg(
  imagePath: string | Uint8Array,
  options: SplitimgOptions,
): Promise<Document> {
  const { SplitimgProcessor } = await import('./splitimg-processor.js')
  return SplitimgProcessor.process(imagePath, options)
}

// ─── Rasterize ───────────────────────────────────────────────────────────────

export interface RasterizeOptions {
  /** Target DPI (default: 150) */
  dpi?: number
  /** Output format (default: 'png') */
  format?: 'png' | 'jpeg' | 'webp'
  /** JPEG/WebP quality 1–100 (default: 90) */
  quality?: number
  /** Page range (default: all) */
  pages?: string
}

/**
 * Rasterize PDF pages or SVG/HTML content to embedded PNG images.
 */
export async function rasterize(
  source: string | Uint8Array,
  options: RasterizeOptions = {},
): Promise<Uint8Array[]> {
  const { Rasterizer } = await import('./rasterizer.js')
  return Rasterizer.rasterize(source, options)
}

// ─── Crop ────────────────────────────────────────────────────────────────────

export interface CropOptions {
  /** X offset from left edge (points) */
  x: number
  /** Y offset from top edge (points) */
  y: number
  /** Width of crop region (points) */
  width: number
  /** Height of crop region (points) */
  height: number
  /** Output format (default: 'png') */
  format?: 'png' | 'jpeg'
}

/**
 * Crop and extract an image region from a source image or PDF page.
 */
export async function crop(
  source: string | Uint8Array,
  options: CropOptions,
): Promise<Uint8Array> {
  const { ImageCropper } = await import('./image-cropper.js')
  return ImageCropper.crop(source, options)
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export interface OCROptions {
  /** Language code(s) for OCR engine, e.g. 'eng', 'ara', 'chi_sim' */
  language?: string | string[]
  /** OCR engine mode (default: 'neural') */
  mode?: 'legacy' | 'neural' | 'combined'
  /** Pages to process (default: all) */
  pages?: string
  /** Whether to add selectable text layer (default: true) */
  textLayer?: boolean
}

/**
 * Run OCR on a scanned PDF to add a selectable text layer.
 * Requires Tesseract.js (installed separately: npm install tesseract.js)
 */
export async function ocr(doc: Document, options: OCROptions = {}): Promise<Document> {
  const { OCRProcessor } = await import('./ocr-processor.js')
  return OCRProcessor.process(doc, options)
}
