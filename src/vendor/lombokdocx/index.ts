// Salinan dari LombokDocx v1.1.0 (16e37bd), src/index.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
export { XMLParser, DocxExtractor, DocxBuilder } from './docx.js'
export type { BuilderParagraphOptions, DocxSource } from './docx.js'
export { DocxError } from './errors.js'
export type { DocxErrorCode } from './errors.js'
export { readDocx, documentToText, mergeRuns } from './wordml.js'
export { renderHTML, escapeHTML } from './render.js'
export { parseXML, textContent, decodeXmlBytes } from './xml.js'
export { ZipReader, writeZip, crc32 } from './zip.js'
export type { ZipEntry, ZipLimits } from './zip.js'
export { inflateRaw } from './inflate.js'
export type {
  DocxDocument,
  DocxBlock,
  DocxAlign,
  DocxParagraph,
  DocxRun,
  DocxTable,
  DocxTableRow,
  DocxTableCell,
  DocxImage,
  DocxMetadata,
  DocxOptions,
  HTMLRenderOptions,
  XMLElement,
} from './types.js'
