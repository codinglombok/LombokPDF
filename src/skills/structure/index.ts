import type { Document } from '../../core/Document.js'

// ─── Table of Contents ────────────────────────────────────────────────────────

export interface TOCOptions {
  /** Heading levels to include (default: [1, 2, 3]) */
  levels?: number[]
  /** Title of the TOC section (default: 'Contents') */
  title?: string
  /** Insert TOC after page N (default: 1 — after first page) */
  afterPage?: number
  /** Page number style (default: 'decimal') */
  pageNumberStyle?: 'decimal' | 'roman' | 'alpha'
  /** Dots between entry and page number (default: true) */
  dotLeader?: boolean
}

/**
 * Auto-generate a table of contents and inject it into the document.
 *
 * @example
 * ```typescript
 * import { toc } from 'lombokpdf/skills/structure'
 *
 * const withTOC = await toc(doc, { levels: [1, 2], title: 'Table of Contents' })
 * ```
 */
export async function toc(doc: Document, options: TOCOptions = {}): Promise<Document> {
  const { TOCGenerator } = await import('./toc-generator.js')
  return TOCGenerator.generate(doc, options)
}

// ─── Footnotes ────────────────────────────────────────────────────────────────

export interface FootnotesOptions {
  /** 'footnote' (bottom of page) or 'endnote' (end of document) */
  style?: 'footnote' | 'endnote'
  /** Numbering style (default: 'decimal') */
  numberStyle?: 'decimal' | 'alpha' | 'roman' | 'symbol'
  /** Restart numbering per page (default: false) */
  restartPerPage?: boolean
  /** Separator line (default: true) */
  separator?: boolean
}

/**
 * Process footnote/endnote markers in the document and layout the notes.
 */
export async function footnotes(doc: Document, options: FootnotesOptions = {}): Promise<Document> {
  const { FootnoteProcessor } = await import('./footnote-processor.js')
  return FootnoteProcessor.process(doc, options)
}

// ─── Cross-References ─────────────────────────────────────────────────────────

export interface CrossRefOptions {
  /** Auto-number figures (default: true) */
  figures?: boolean
  /** Auto-number tables (default: true) */
  tables?: boolean
  /** Auto-number equations (default: false) */
  equations?: boolean
  /** Reference format, e.g. 'Figure {n}' */
  figureLabel?: string
  tableLabel?: string
  equationLabel?: string
}

/**
 * Process cross-reference markers ({{ref:figure-id}}) and update numbering.
 */
export async function crossRef(doc: Document, options: CrossRefOptions = {}): Promise<Document> {
  const { CrossRefProcessor } = await import('./crossref-processor.js')
  return CrossRefProcessor.process(doc, options)
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export interface BookmarkEntry {
  title: string
  page:  number
  level?: number
  children?: BookmarkEntry[]
}

export interface BookmarksOptions {
  /** Auto-generate from headings (default: true) */
  autoFromHeadings?: boolean
  /** Heading levels to bookmark (default: [1, 2, 3]) */
  levels?: number[]
  /** Manual bookmark list (appended to auto-generated) */
  manual?: BookmarkEntry[]
}

/**
 * Generate or update the PDF outline/bookmark tree.
 */
export async function bookmarks(doc: Document, options: BookmarksOptions = {}): Promise<Document> {
  const { BookmarkGenerator } = await import('./bookmark-generator.js')
  return BookmarkGenerator.generate(doc, options)
}

// ─── Running Headers/Footers ─────────────────────────────────────────────────

export interface RunningHeaderOptions {
  /** Content for odd-page headers (CSS Paged Media: @page :right) */
  right?: string | ((pageNum: number, total: number) => string)
  /** Content for even-page headers (CSS Paged Media: @page :left) */
  left?: string | ((pageNum: number, total: number) => string)
  /** Same header/footer on all pages */
  all?: string | ((pageNum: number, total: number) => string)
  /** Footer content */
  footer?: string | ((pageNum: number, total: number) => string)
  /** Start from page N (default: 1) */
  startPage?: number
  /** Font size (default: 9) */
  fontSize?: number
  /** Font color (default: '#666666') */
  color?: string
}

/**
 * Add or update running headers and footers.
 */
export async function runningHeaders(
  doc: Document,
  options: RunningHeaderOptions,
): Promise<Document> {
  const { RunningHeaderProcessor } = await import('./running-header-processor.js')
  return RunningHeaderProcessor.process(doc, options)
}
