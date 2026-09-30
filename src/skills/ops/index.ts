import type { Skill } from '../../types.js'
import { Document } from '../../core/Document.js'

// ─── Merge ───────────────────────────────────────────────────────────────────

export interface MergeOptions {
  /** Optional bookmark label for each merged document */
  bookmarks?: string[]
}

/**
 * Merge multiple Document instances into one.
 *
 * @example
 * ```typescript
 * import { merge } from 'lombokpdf/skills/ops'
 *
 * const combined = await merge([docA, docB, docC])
 * await combined.save('merged.pdf')
 * ```
 */
export async function merge(
  docs: Document[],
  options: MergeOptions = {},
): Promise<Document> {
  if (docs.length === 0) throw new Error('lombokpdf/merge: no documents provided')
  if (docs.length === 1) return docs[0]!

  const { PDFMerger } = await import('./pdf-merger.js')
  return PDFMerger.merge(docs, options)
}

// ─── Split ───────────────────────────────────────────────────────────────────

export type SplitOptions =
  | { pages: string }                    // e.g. '1-5', '2,4,6', '3-'
  | { bookmark: string }                 // split at named bookmark
  | { chapter: true }                    // split at each chapter

/**
 * Split a Document into one or more parts.
 *
 * @example
 * ```typescript
 * import { split } from 'lombokpdf/skills/ops'
 *
 * const part = await split(doc, { pages: '1-10' })
 * await part.save('part1.pdf')
 * ```
 */
export async function split(doc: Document, options: SplitOptions): Promise<Document> {
  const { PDFSplitter } = await import('./pdf-splitter.js')
  return PDFSplitter.split(doc, options)
}

// ─── Rotate ──────────────────────────────────────────────────────────────────

export interface RotateOptions {
  /** Pages to rotate (1-based, e.g. '1', '1-3', 'all') */
  pages?: string
  /** Degrees: 90, 180, 270 */
  degrees: 90 | 180 | 270
}

/**
 * Rotate pages in a document.
 */
export async function rotate(doc: Document, options: RotateOptions): Promise<Document> {
  const { PDFRotator } = await import('./pdf-rotator.js')
  return PDFRotator.rotate(doc, options)
}

// ─── Compress ────────────────────────────────────────────────────────────────

export interface CompressOptions {
  /** Image quality 1-100 (default: 80) */
  imageQuality?: number
  /** Maximum image DPI (default: 150) */
  imageDPI?: number
  /** Deduplicate identical fonts (default: true) */
  deduplicateFonts?: boolean
}

/**
 * Compress a PDF by downsampling images and deduplicating fonts.
 */
export async function compress(doc: Document, options: CompressOptions = {}): Promise<Document> {
  const { PDFCompressor } = await import('./pdf-compressor.js')
  return PDFCompressor.compress(doc, options)
}

// ─── Watermark ───────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  text?:     string
  image?:    string | Uint8Array
  opacity?:  number    // 0–1 (default: 0.15)
  rotation?: number    // degrees (default: 45)
  fontSize?: number    // pt (default: 60)
  color?:    string    // hex or named (default: '#888888')
  pages?:    string    // page range (default: 'all')
}

/**
 * Add a text or image watermark to all or specific pages.
 *
 * @example
 * ```typescript
 * import { watermark } from 'lombokpdf/skills/ops'
 *
 * const stamped = await watermark(doc, { text: 'CONFIDENTIAL', opacity: 0.15 })
 * ```
 */
export async function watermark(doc: Document, options: WatermarkOptions): Promise<Document> {
  const { PDFWatermarker } = await import('./pdf-watermarker.js')
  return PDFWatermarker.apply(doc, options)
}

// ─── Skill wrappers (for pipe()) ─────────────────────────────────────────────

/** Use watermark as a pipeable skill */
export function watermarkSkill(options: WatermarkOptions): Skill {
  return {
    name: 'watermark',
    async apply(doc: Document) { return watermark(doc, options) },
  }
}

/** Use compress as a pipeable skill */
export function compressSkill(options?: CompressOptions): Skill {
  return {
    name: 'compress',
    async apply(doc: Document) { return compress(doc, options) },
  }
}
