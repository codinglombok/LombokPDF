// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/types.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * LombokMarkDown - public type definitions
 */

export interface MarkdownOptions {
  /** GitHub Flavored Markdown: tables, strikethrough, task lists, extended autolinks, tag filter (default true). */
  gfm?: boolean
  /** Render soft line breaks as `<br />` (default false). */
  breaks?: boolean
  /** Pass raw HTML through. When false (default) raw HTML is escaped and shown as text. */
  html?: boolean
  /** Drop `javascript:`, `vbscript:`, `file:` and non-image `data:` URLs (default true). */
  safeLinks?: boolean
  /** Add GitHub-style `id` attributes to headings (default false). */
  headingIds?: boolean
  /** @deprecated Ignored since 2.0.0 (output always follows CommonMark). */
  pedantic?: boolean
  /** @deprecated Ignored since 2.0.0. */
  smartLists?: boolean
  /** @deprecated Ignored since 2.0.0. */
  smartypants?: boolean
}

export interface ASTNode {
  type:
    | 'root' | 'heading' | 'paragraph' | 'list' | 'listItem' | 'blockquote' | 'codeBlock' | 'thematicBreak'
    | 'html' | 'table' | 'tableRow' | 'tableCell' | 'text' | 'strong' | 'emphasis' | 'code' | 'link' | 'image'
    | 'lineBreak' | 'softBreak' | 'delete'
  children?: ASTNode[]
  /** heading: 1-6 */
  depth?: number
  /** text, code, codeBlock, html */
  value?: string
  /** codeBlock: first word of the info string */
  lang?: string
  /** codeBlock: full info string */
  meta?: string
  ordered?: boolean
  start?: number
  /** list: true when the list is loose */
  loose?: boolean
  /** listItem (GFM task list) */
  checked?: boolean
  align?: 'left' | 'center' | 'right'
  header?: boolean
  /** link / image destination */
  href?: string
  title?: string
  alt?: string
  /** code and html nodes that are inline */
  inline?: boolean
}

export interface MarkdownMetadata {
  headings: { level: number; text: string }[]
  links: { text: string; url: string; title?: string }[]
  images: { alt: string; src: string; title?: string }[]
  codeBlocks: { lang?: string; code: string }[]
}

export interface TOCEntry {
  level: number
  text: string
  id: string
  children?: TOCEntry[]
}
