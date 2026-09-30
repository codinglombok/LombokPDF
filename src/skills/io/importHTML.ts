/**
 * LombokPDF — HTML Import Skill
 * Full HTML5 pass-through with CSS inline normalization.
 */

import type { Document } from '../../core/Document.js'

export interface ImportHTMLOptions {
  /** Base URL for relative asset resolution */
  baseUrl?: string
  /** Whether to inline external CSS (default: false — LLE handles it) */
  inlineCSS?: boolean
  /** Strip scripts for security (default: true) */
  stripScripts?: boolean
}

/**
 * Import a full HTML5 string with optional pre-processing.
 * Primarily used as a skill option wrapper — the Builder handles raw HTML natively.
 */
export function importHTML(options: ImportHTMLOptions = {}) {
  const { stripScripts = true } = options

  return {
    name: 'importHTML' as const,
    async apply(doc: Document): Promise<Document> {
      // No-op at post-processing stage — HTML is resolved in Builder
      return doc
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export PDF pages as PNG images.
 */
export async function exportPNG(
  doc: Document,
  options: { dpi?: number; pages?: string } = {}
): Promise<Uint8Array[]> {
  const { Rasterizer } = await import('../image/rasterizer.js')
  const rasterOpts: Record<string, any> = { dpi: options.dpi ?? 150 }
  if (options.pages) rasterOpts.pages = options.pages
  return Rasterizer.rasterize(doc._getRaw(), rasterOpts)
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export a PDF page as a vector SVG.
 */
export async function exportSVG(
  doc: Document,
  options: { page?: number } = {}
): Promise<string> {
  const { SVGExporter } = await import('./svg-exporter.js')
  return SVGExporter.export(doc, options.page ?? 1)
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post-process a PDF to be PDF/A compliant.
 * Adds ICC color profile, XMP metadata, and validates structure.
 */
export async function exportPDFA(
  doc: Document,
  options: { level?: '1b' | '2b' } = {}
): Promise<Document> {
  const { PDFAConverter } = await import('./pdfa-converter.js')
  return PDFAConverter.convert(doc, options.level ?? '1b')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post-process a PDF to be PDF/UA (Universal Accessibility) compliant.
 * Adds tagged structure, alt text, reading order, and language metadata.
 */
export async function exportPDFUA(doc: Document): Promise<Document> {
  const { PDFUAConverter } = await import('./pdfua-converter.js')
  return PDFUAConverter.convert(doc)
}
