/**
 * LombokPDF — DOCX Import Skill
 * Converts .docx files to HTML for the LLE renderer.
 * Preserves: headings, paragraphs, tables, bold/italic, lists, images (base64).
 *
 * Requires: mammoth (auto-installed as optional dependency)
 *   npm install mammoth
 */

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
export async function docxToHTML(docx: string | Uint8Array | Buffer): Promise<string> {
  // Mammoth is the gold standard for .docx → HTML
  let mammoth: typeof import('mammoth')
  try {
    mammoth = await import('mammoth')
  } catch {
    throw new Error(
      'LombokPDF/importDocx: mammoth is required. Install: npm install mammoth'
    )
  }

  let result

  if (typeof docx === 'string') {
    // File path
    result = await mammoth.convertToHtml(
      { path: docx },
      _mammothOptions()
    )
  } else {
    // Raw bytes
    const buffer = docx instanceof Buffer ? docx : Buffer.from(docx)
    result = await mammoth.convertToHtml(
      { buffer },
      _mammothOptions()
    )
  }

  if (result.messages.length > 0) {
    const warnings = result.messages
      .filter(m => m.type === 'warning')
      .map(m => m.message)
    if (warnings.length > 0) {
      console.warn('[LombokPDF/importDocx] Conversion warnings:', warnings.join('; '))
    }
  }

  return _wrapInDocument(result.value)
}

function _mammothOptions(): Record<string, any> {
  return {
    styleMap: [
      // Map Word styles to semantic HTML
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh",
      "p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Title']     => h1.title:fresh",
      "p[style-name='Subtitle']  => p.subtitle:fresh",
      "p[style-name='Quote']     => blockquote:fresh",
      "r[style-name='Strong']    => strong",
      "r[style-name='Emphasis']  => em",
      "r[style-name='Code']      => code",
    ],
    convertImage: mammothImageConverter(),
  }
}

function mammothImageConverter() {
  return {
    convert: async (image: any): Promise<{ src: string }> => {
      const buf    = await image.read()
      const base64 = buf.toString('base64')
      const mime   = image.contentType ?? 'image/png'
      return { src: `data:${mime};base64,${base64}` }
    },
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
