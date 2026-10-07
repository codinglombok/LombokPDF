import Handlebars from 'handlebars'
import { parseFrontMatter } from './front-matter.js'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LocaleConfig } from '../types.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dir, '../../templates')

// ─── Register Handlebars Helpers ─────────────────────────────────────────────

// currency — format number as locale currency
Handlebars.registerHelper('currency', function (value: number, options: any) {
  const locale   = options?.data?.root?.__locale ?? 'en-US'
  const currency = options?.data?.root?.__currency ?? 'USD'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
})

// percent — format number as percentage
Handlebars.registerHelper('percent', function (value: number, options: any) {
  const locale = options?.data?.root?.__locale ?? 'en-US'
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0 }).format(value)
})

// date — format date value
Handlebars.registerHelper('date', function (value: string | Date, format: string, options: any) {
  const locale = options?.data?.root?.__locale ?? 'en-US'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return value

  // Simple format patterns
  const opts: Intl.DateTimeFormatOptions = {}
  if (typeof format === 'string' && format.includes('yyyy')) {
    opts.year = 'numeric'; opts.month = 'long'; opts.day = 'numeric'
  } else {
    opts.dateStyle = 'medium'
  }

  return new Intl.DateTimeFormat(locale, opts).format(d)
})

// upper / lower / truncate / pad
Handlebars.registerHelper('upper', (v: string) => String(v).toUpperCase())
Handlebars.registerHelper('lower', (v: string) => String(v).toLowerCase())
Handlebars.registerHelper('truncate', (v: string, len: number) =>
  String(v).length > len ? String(v).slice(0, len) + '…' : v)
Handlebars.registerHelper('pad', (v: string, len: number, char: string = ' ') =>
  String(v).padStart(len, char))
Handlebars.registerHelper('nl2br', (v: string) =>
  String(v).replace(/\n/g, '<br>'))

// Comparison helpers
Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b)
Handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b)
Handlebars.registerHelper('gt', (a: number, b: number) => a > b)
Handlebars.registerHelper('lt', (a: number, b: number) => a < b)
Handlebars.registerHelper('times', function (n: number, block: Handlebars.HelperOptions) {
  let result = ''
  for (let i = 0; i < n; i++) result += block.fn({ index: i, first: i === 0, last: i === n - 1 })
  return result
})

// ─── Template Engine ─────────────────────────────────────────────────────────

export const TemplateEngine = {
  /**
   * Render a named built-in template with data.
   * Also supports file paths for custom templates.
   */
  async render(
    nameOrPath: string,
    data: Record<string, unknown>,
    locale: LocaleConfig,
  ): Promise<string> {
    const source = await this._loadTemplate(nameOrPath)

    // Parse front-matter (YAML) from template source
    const { data: frontMatter, content } = parseFrontMatter(source)

    // Merge front-matter defaults with provided data
    const mergedData = {
      ...frontMatter,
      ...data,
      // Inject locale metadata for helpers
      __locale:   locale.tag,
      __direction:locale.direction ?? 'ltr',
      __currency: frontMatter['currency'] ?? data['currency'] ?? 'USD',
    }

    // Compile and render
    const template = Handlebars.compile(content, { strict: false })
    const rendered = template(mergedData)

    // Wrap with locale-aware HTML shell
    return this._wrapHTML(rendered, mergedData, locale)
  },

  /**
   * Render an arbitrary Handlebars template string.
   */
  renderString(
    templateStr: string,
    data: Record<string, unknown>,
    locale: LocaleConfig,
  ): string {
    const template = Handlebars.compile(templateStr)
    return template({ ...data, __locale: locale.tag, __direction: locale.direction ?? 'ltr' })
  },

  async _loadTemplate(nameOrPath: string): Promise<string> {
    // Built-in template?
    if (!nameOrPath.includes('/') && !nameOrPath.includes('\\')) {
      const builtIn = join(TEMPLATES_DIR, nameOrPath, 'template.html')
      try {
        return await readFile(builtIn, 'utf-8')
      } catch {
        throw new Error(`LombokPDF: unknown template '${nameOrPath}'. Built-ins: invoice, report, legal, certificate, letter, resume, ticket, label, receipt, newsletter, datasheet, booklet`)
      }
    }

    // Custom file path
    return readFile(nameOrPath, 'utf-8')
  },

  _wrapHTML(
    body: string,
    data: Record<string, unknown>,
    locale: LocaleConfig,
  ): string {
    const dir  = locale.direction ?? 'ltr'
    const lang = locale.tag

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${String(data['title'] ?? data['company'] ?? 'LombokPDF Document')}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Sans+Arabic:wght@100..900&family=Noto+Sans+JP:wght@100..900&family=Noto+Sans+KR:wght@100..900&family=Noto+Sans+SC:wght@100..900&family=Noto+Sans+TC:wght@100..900&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    html { font-family: 'Noto Sans', system-ui, sans-serif; font-size: 11pt; line-height: 1.5; }

    :lang(ar), :lang(fa), :lang(ur), :lang(he) {
      font-family: 'Noto Sans Arabic', 'Noto Sans', system-ui, sans-serif;
    }
    :lang(ja) { font-family: 'Noto Sans JP', 'Noto Sans', system-ui, sans-serif; }
    :lang(ko) { font-family: 'Noto Sans KR', 'Noto Sans', system-ui, sans-serif; }
    :lang(zh) { font-family: 'Noto Sans SC', 'Noto Sans', system-ui, sans-serif; }

    body { margin: 0; padding: 0; }

    @page {
      size: A4;
      margin: 20mm 20mm 25mm 20mm;
    }
    @page :first { margin-top: 30mm; }

    /* Print-safe typography */
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
    table { page-break-inside: avoid; border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: start; }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${body}
</body>
</html>`
  },
}
