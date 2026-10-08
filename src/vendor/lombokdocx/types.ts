// Salinan dari LombokDocx v1.1.0 (16e37bd), src/types.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * LombokDocx - type definitions
 */

export interface DocxOptions {
  /** Read image parts referenced by the body (default `true`). */
  extractImages?: boolean
  /** Read docProps/core.xml and docProps/app.xml (default `true`). */
  extractMetadata?: boolean
  /** Keep run formatting (bold, italic, ...) in the result (default `true`). */
  preserveFormatting?: boolean
  /** Maximum number of ZIP entries (default 10 000). */
  maxEntries?: number
  /** Maximum uncompressed size of one ZIP entry in bytes (default 100 MiB). */
  maxEntrySize?: number
  /** Maximum total uncompressed bytes read from one archive (default 256 MiB). */
  maxTotalSize?: number
  /** Maximum XML nesting depth (default 256). */
  maxDepth?: number
}

export interface DocxDocument {
  /** Top-level body paragraphs in document order (paragraphs inside tables are not included). */
  paragraphs: DocxParagraph[]
  /** Top-level body tables in document order. */
  tables: DocxTable[]
  /** Paragraphs and tables of the body in document order. */
  blocks: DocxBlock[]
  images: DocxImage[]
  metadata: DocxMetadata
}

export type DocxBlock =
  | { type: 'paragraph'; paragraph: DocxParagraph }
  | { type: 'table'; table: DocxTable }

export type DocxAlign = 'left' | 'center' | 'right' | 'justify'

export interface DocxParagraph {
  text: string
  /** Paragraph style id (`w:pStyle`). */
  style?: string
  /** Heading level 1-9 when the paragraph style is a heading. */
  heading?: number
  /** List membership from `w:numPr`. */
  list?: { numId: string; level: number; ordered: boolean }
  formatting?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    fontSize?: number
    color?: string
    align?: DocxAlign
  }
  runs: DocxRun[]
}

export interface DocxRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** `#RRGGBB`, upper case. */
  color?: string
  /** Font size in points. */
  fontSize?: number
  /** Hyperlink target (external URL or `#bookmark`). */
  href?: string
  /** Relationship id of an embedded image drawn in this run. */
  image?: string
}

export interface DocxTable {
  rows: DocxTableRow[]
  width?: number
}

export interface DocxTableRow {
  cells: DocxTableCell[]
}

export interface DocxTableCell {
  text: string
  colSpan?: number
  rowSpan?: number
  paragraphs?: DocxParagraph[]
  tables?: DocxTable[]
}

export interface DocxImage {
  /** Relationship id (`r:embed`). */
  id: string
  /** Part name inside the package, e.g. `word/media/image1.png`. */
  name: string
  /** MIME type derived from the file extension. */
  type: string
  data: Uint8Array
}

export interface DocxMetadata {
  title?: string
  author?: string
  created?: Date
  modified?: Date
  subject?: string
  keywords?: string[]
  description?: string
  lastModifiedBy?: string
  pageCount?: number
  wordCount?: number
  characterCount?: number
}

export interface XMLElement {
  name: string
  attributes: Record<string, string>
  children: (XMLElement | string)[]
  /** @deprecated Not set since 1.1.0; use `textContent()`. */
  text?: string
}

export interface HTMLRenderOptions {
  /** Emit `<h1>` with the metadata title before the body (default `true`). */
  includeTitle?: boolean
  /** Embed raster images as data URIs; otherwise images are omitted (default `true`). */
  embedImages?: boolean
}
