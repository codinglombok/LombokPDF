/**
 * LombokPDF — Core Type Definitions
 */

// ─── Export Formats ───────────────────────────────────────────────────────────

export type ExportFormat =
  | 'pdf'
  | 'pdf/a-1b'
  | 'pdf/a-2b'
  | 'pdf/ua'
  | 'png'
  | 'svg'

// ─── Source Types ─────────────────────────────────────────────────────────────

export type Source =
  | { html: string; baseUrl?: string }
  | { markdown: string }
  | { template: string; data?: Record<string, unknown> }
  | { file: string }
  | { docx: string | Uint8Array }
  | { csv: string; options?: CSVOptions }
  | { url: string }

export interface CSVOptions {
  delimiter?: string
  hasHeader?: boolean
  tableStyle?: Record<string, string>
}

// ─── Font Configuration ───────────────────────────────────────────────────────

export interface FontConfig {
  primary?: string
  monospace?: string
  fallback?: string[]
  /** Custom font paths or URLs */
  custom?: Record<string, string | { regular: string; bold?: string; italic?: string; boldItalic?: string }>
  /** Embed full font vs subset (default: subset) */
  embedding?: 'full' | 'subset'
}

// ─── Locale ───────────────────────────────────────────────────────────────────

export interface LocaleConfig {
  /** BCP 47 locale tag, e.g. 'ar-SA', 'zh-Hans-CN', 'id-ID' */
  tag: string
  direction?: 'ltr' | 'rtl' | 'auto'
  numberingSystem?: 'latn' | 'arab' | 'hans' | string
  calendar?: 'gregory' | 'islamic' | 'hebrew' | 'buddhist' | 'japanese' | string
  hyphenation?: boolean
  lineBreaking?: 'normal' | 'strict' | 'loose'
}

// ─── Page Setup ───────────────────────────────────────────────────────────────

export type PageSize =
  | 'A4' | 'A3' | 'A5'
  | 'Letter' | 'Legal' | 'Tabloid'
  | [width: number, height: number]  // in points (1pt = 1/72 inch)

export interface PageConfig {
  size?: PageSize
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top?: number; right?: number; bottom?: number; left?: number
  }
}

// ─── LombokPDF Options ────────────────────────────────────────────────────────

export interface LombokPDFOptions {
  locale?: string | LocaleConfig
  theme?: string | ThemeConfig
  fonts?: FontConfig
  page?: PageConfig
  debug?: boolean
  /**
   * Maximum rendering time in ms before timeout (default: 30_000)
   */
  timeout?: number
}

export interface ThemeConfig {
  name: string
  tokens?: Record<string, string>
}

// ─── Embed Position ───────────────────────────────────────────────────────────

export interface EmbedPosition {
  /** 1-based page number */
  page?: number
  /** X offset from left margin in points */
  x?: number
  /** Y offset from top margin in points */
  y?: number
  width?: number
  height?: number
  fit?: 'fill' | 'contain' | 'cover'
}

// ─── PDF Metadata ─────────────────────────────────────────────────────────────

export interface PDFMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
  language?: string
  trapped?: boolean
}

// ─── Skill Interface ──────────────────────────────────────────────────────────

export interface Skill {
  readonly name: string
  apply(doc: Document, options?: unknown): Promise<Document>
}

export type SkillFn = (options?: unknown) => Skill

// ─── Support Matrix ───────────────────────────────────────────────────────────

export interface SupportMatrix {
  cssPagedMedia: boolean
  flexbox: boolean
  grid: boolean
  mathml: boolean
  svg: boolean
  bidi: boolean
  harfbuzz: boolean
  wasm: boolean
  locales: string[]
}

// ─── Document Type (forward ref) ─────────────────────────────────────────────

export interface Document {
  save(path: string): Promise<void>
  toBytes(): Promise<Uint8Array>
  toBase64(): Promise<string>
  toStream(): ReadableStream<Uint8Array>
  pages(): number
  metadata(): PDFMetadata
  setMetadata(meta: Partial<PDFMetadata>): Document
}

// ─── Builder Type (forward ref) ──────────────────────────────────────────────

export interface BuilderInterface {
  template(name: string, data?: Record<string, unknown>): BuilderInterface
  locale(locale: string | LocaleConfig): BuilderInterface
  theme(name: string): BuilderInterface
  page(config: PageConfig): BuilderInterface
  metadata(meta: Partial<PDFMetadata>): BuilderInterface
  embed(chart: unknown, position?: EmbedPosition): BuilderInterface
  pipe(skill: Skill): BuilderInterface
  export(format?: ExportFormat): Promise<Document>
}
