/**
 * LombokPDF — DOCX Import Skill
 * Converts .docx files to HTML for the LLE renderer, using LombokDocx
 * (vendored in src/vendor/lombokdocx): no native modules, bounded ZIP/XML reading.
 * Preserves: headings, paragraphs, tables (merged cells), bold/italic/underline,
 * lists, links, images (base64 data URIs).
 */

import { readDocx, renderHTML, DocxError } from '../../vendor/lombokdocx/index.js'

/**
 * Convert a DOCX file to HTML string.
 *
 * @param docx - File path string or raw DOCX bytes (Uint8Array or Buffer)
 * @returns HTML string representation of the document
 *
 * @example
 * ```typescript
 * import { docxToHTML } from 'lombokpdf/skills/io'
 *
 * const html = await docxToHTML('./contract.docx')
 * const pdf  = await new LombokPDF().from({ html }).export('pdf')
 * ```
 */
export async function docxToHTML(docx: string | Uint8Array): Promise<string> {
  let bytes: Uint8Array
  if (typeof docx === 'string') {
    const { readFile } = await import('node:fs/promises')
    bytes = new Uint8Array(await readFile(docx))
  } else {
    bytes = docx
  }

  try {
    const doc = readDocx(bytes)
    return _wrapInDocument(renderHTML(doc, { includeTitle: false, embedImages: true }))
  } catch (err: unknown) {
    if (err instanceof DocxError) {
      throw new Error(`LombokPDF/importDocx: ${err.code}: ${err.message}`, { cause: err })
    }
    throw err
  }
}

function _wrapInDocument(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Noto Sans', sans-serif; font-size: 11pt; line-height: 1.6; margin: 0; }
    h1   { font-size: 22pt; margin: 24pt 0 12pt; page-break-after: avoid; }
    h2   { font-size: 16pt; margin: 20pt 0 10pt; page-break-after: avoid; }
    h3   { font-size: 13pt; margin: 16pt 0 8pt;  page-break-after: avoid; }
    h4, h5, h6 { margin: 12pt 0 6pt; page-break-after: avoid; }
    p    { margin: 0 0 8pt; }
    table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 6pt 10pt; text-align: left; }
    th   { background: #f5f5f5; font-weight: 600; }
    ul, ol { margin: 8pt 0 8pt 20pt; padding: 0; }
    li   { margin: 3pt 0; }
    blockquote { border-left: 3px solid #1a73e8; margin: 12pt 0 12pt 20pt; padding-left: 12pt; color: #555; }
    img  { max-width: 100%; height: auto; }
    code { font-family: 'Noto Sans Mono', monospace; background: #f0f0f0; padding: 1pt 4pt; border-radius: 2pt; font-size: 9pt; }
    @page { size: A4; margin: 20mm; }
  </style>
</head>
<body>
${body}
</body>
</html>`
}

/** Skill no-op wrapper — conversion happens in Builder._resolveSource() */
export function importDocx() {
  return {
    name: 'importDocx' as const,
    async apply(doc: unknown) { return doc },
  }
}
