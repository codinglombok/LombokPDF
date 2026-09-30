/**
 * LombokPDF — Lightweight, elegant, polyglot PDF generation
 * @license Apache-2.0
 * @version 1.0.0
 */

export { LombokPDF }        from './core/LombokPDF.js'
export { Builder }          from './core/Builder.js'
export { Document }         from './core/Document.js'
export { locale }           from './core/locale.js'

export type {
  LombokPDFOptions,
  ExportFormat,
  Source,
  FontConfig,
  EmbedPosition,
  PDFMetadata,
  SupportMatrix,
  Skill,
  SkillFn,
} from './types.js'

// Version
export const VERSION = '__LOMBOKPDF_VERSION__'
