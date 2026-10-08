// Salinan dari LombokDocx v1.1.0 (16e37bd), src/errors.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
export type DocxErrorCode =
  | 'INVALID_ZIP'
  | 'UNSUPPORTED_ZIP'
  | 'CORRUPT_DATA'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_XML'
  | 'MISSING_PART'

/** Error with a stable, language-neutral `code` (SPEC §7). */
export class DocxError extends Error {
  readonly code: DocxErrorCode
  constructor(code: DocxErrorCode, message: string) {
    super(message)
    this.name = 'DocxError'
    this.code = code
  }
}
