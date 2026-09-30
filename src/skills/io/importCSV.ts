/**
 * LombokPDF — CSV Import Skill
 * Converts CSV data to a styled HTML table for rendering.
 */

export interface CSVOptions {
  delimiter?:  string
  hasHeader?:  boolean
  tableStyle?: Record<string, string>
  caption?:    string
  /** Column alignments ('left' | 'center' | 'right') — array matching column count */
  alignments?: Array<'left' | 'center' | 'right'>
  /** Max rows to include (default: all) */
  maxRows?:    number
}

/**
 * Convert a CSV string to an HTML table.
 *
 * @example
 * ```typescript
 * import { csvToHTML } from 'lombokpdf/skills/io'
 *
 * const html = await csvToHTML('Name,Age,City\nBudi,30,Jakarta', { hasHeader: true })
 * ```
 */
export async function csvToHTML(
  csv: string,
  options: CSVOptions = {},
): Promise<string> {
  const {
    delimiter  = ',',
    hasHeader  = true,
    caption,
    alignments = [],
    maxRows,
  } = options

  const rows = parseCSV(csv, delimiter)
  if (rows.length === 0) return '<table></table>'

  const limited = maxRows ? rows.slice(0, hasHeader ? maxRows + 1 : maxRows) : rows

  const header  = hasHeader ? limited[0]  : null
  const body    = hasHeader ? limited.slice(1) : limited

  const colCount = Math.max(
    header?.length ?? 0,
    ...body.map(r => r.length)
  )

  function align(colIdx: number): string {
    return alignments[colIdx] ?? 'left'
  }

  let html = '<table class="lombok-csv-table">\n'

  if (caption) {
    html += `  <caption>${escapeHTML(caption)}</caption>\n`
  }

  if (header) {
    html += '  <thead>\n    <tr>\n'
    for (let i = 0; i < colCount; i++) {
      const cell = header[i] ?? ''
      html += `      <th style="text-align: ${align(i)}">${escapeHTML(cell)}</th>\n`
    }
    html += '    </tr>\n  </thead>\n'
  }

  html += '  <tbody>\n'
  for (const row of body) {
    html += '    <tr>\n'
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] ?? ''
      html += `      <td style="text-align: ${align(i)}">${escapeHTML(cell)}</td>\n`
    }
    html += '    </tr>\n'
  }
  html += '  </tbody>\n</table>'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Noto Sans', sans-serif; font-size: 10pt; }
    .lombok-csv-table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    .lombok-csv-table caption { font-weight: 600; margin-bottom: 8pt; text-align: left; }
    .lombok-csv-table th { background: #1a73e8; color: #fff; padding: 6pt 10pt; font-weight: 600; font-size: 9pt; }
    .lombok-csv-table td { padding: 5pt 10pt; border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
    .lombok-csv-table tr:nth-child(even) td { background: #f9fafb; }
    .lombok-csv-table tr:hover td { background: #eff6ff; }
    @page { size: A4 landscape; margin: 15mm; }
  </style>
</head>
<body>
${html}
</body>
</html>`
}

function parseCSV(csv: string, delimiter: string): string[][] {
  const rows: string[][] = []
  const lines = csv.split(/\r?\n/).filter(l => l.trim())

  for (const line of lines) {
    const cells: string[] = []
    let   current         = ''
    let   inQuotes        = false

    for (let i = 0; i < line.length; i++) {
      const ch   = line[i]!
      const next = line[i + 1]

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"'
          i++   // skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }

    cells.push(current.trim())
    rows.push(cells)
  }

  return rows
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
}

/** Skill wrapper */
export function importCSV(options?: CSVOptions) {
  return {
    name: 'importCSV' as const,
    async apply(doc: unknown) { return doc },
  }
}
