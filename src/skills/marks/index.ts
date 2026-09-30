import type { Document } from '../../core/Document.js'

// ─── QR Code ─────────────────────────────────────────────────────────────────

export interface QRCodeOptions {
  /** The data to encode */
  data: string
  /** Error correction level (default: 'M') */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** Size of the QR code in points (default: 100) */
  size?: number
  /** Quiet zone margin (default: 4 modules) */
  margin?: number
  /** Foreground color (default: '#000000') */
  color?: string
  /** Background color (default: '#ffffff') */
  background?: string
  /** Output as SVG (crisp) or PNG (default: 'svg') */
  renderer?: 'svg' | 'png'
  /** Where to embed in an existing document */
  position?: { page: number; x: number; y: number }
}

/**
 * Generate a QR code and embed it into a PDF document.
 *
 * @example
 * ```typescript
 * import { qrcode } from 'lombokpdf/skills/marks'
 *
 * // Standalone — returns a Document with just the QR code on one page
 * const doc = await qrcode({ data: 'https://lombokpdf.dev', size: 150 })
 *
 * // Embed into existing document
 * const updated = await qrcode({ data: 'https://example.com', position: { page: 1, x: 400, y: 700 } }, existingDoc)
 * ```
 */
export async function qrcode(options: QRCodeOptions, doc?: Document): Promise<Document> {
  const { QRCodeGenerator } = await import('./qrcode-generator.js')
  return QRCodeGenerator.generate(options, doc)
}

// ─── Barcode ──────────────────────────────────────────────────────────────────

export type BarcodeSymbology =
  | 'code128'     // Most versatile — alphanumeric
  | 'ean13'       // European Article Number 13-digit
  | 'ean8'        // EAN 8-digit
  | 'upca'        // UPC-A (North American retail)
  | 'itf'         // Interleaved 2-of-5 (logistics)
  | 'code39'      // Code 39 (industrial)
  | 'code93'      // Code 93

export interface BarcodeOptions {
  /** Data to encode */
  data: string
  /** Symbology (default: 'code128') */
  symbology?: BarcodeSymbology
  /** Width in points (default: 200) */
  width?: number
  /** Height in points (default: 60) */
  height?: number
  /** Show human-readable text below (default: true) */
  showText?: boolean
  /** Text font size (default: 10) */
  fontSize?: number
  /** Bar color (default: '#000000') */
  color?: string
  /** Background (default: '#ffffff') */
  background?: string
  /** Embed position in existing doc */
  position?: { page: number; x: number; y: number }
}

/**
 * Generate a 1D barcode and embed into a PDF document.
 */
export async function barcode(options: BarcodeOptions, doc?: Document): Promise<Document> {
  const { BarcodeGenerator } = await import('./barcode-generator.js')
  return BarcodeGenerator.generate(options, doc)
}

// ─── Data Matrix ─────────────────────────────────────────────────────────────

export interface DataMatrixOptions {
  data: string
  size?: number
  renderer?: 'svg' | 'png'
  position?: { page: number; x: number; y: number }
}

/**
 * Generate a 2D Data Matrix barcode (ISO/IEC 16022).
 * Commonly used in pharmaceutical and industrial labeling.
 */
export async function datamatrix(options: DataMatrixOptions, doc?: Document): Promise<Document> {
  const { DataMatrixGenerator } = await import('./datamatrix-generator.js')
  return DataMatrixGenerator.generate(options, doc)
}

// ─── PDF417 ───────────────────────────────────────────────────────────────────

export interface PDF417Options {
  data: string
  columns?: number
  errorCorrectionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  width?: number
  height?: number
  position?: { page: number; x: number; y: number }
}

/**
 * Generate a PDF417 stacked barcode.
 * Used in shipping labels, ID cards, and boarding passes.
 */
export async function pdf417(options: PDF417Options, doc?: Document): Promise<Document> {
  const { PDF417Generator } = await import('./pdf417-generator.js')
  return PDF417Generator.generate(options, doc)
}
