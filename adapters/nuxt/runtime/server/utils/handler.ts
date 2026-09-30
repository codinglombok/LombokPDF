/**
 * LombokPDF — Nuxt Server Handler Factory
 * Auto-imported as `defineLombokPDFHandler` in server/api routes.
 */

import { defineEventHandler, getRouterParams, useRuntimeConfig, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'
import type { ExportFormat } from 'lombokpdf'

export interface LombokPDFHandlerOptions {
  template?: string
  html?:     ((event: H3Event) => Promise<string> | string)
  data?:     Record<string, unknown> | ((event: H3Event) => Promise<Record<string, unknown>>)
  locale?:   string | ((event: H3Event) => string)
  theme?:    string
  format?:   ExportFormat
  filename?: string | ((event: H3Event) => string)
}

export function defineLombokPDFHandler(options: LombokPDFHandlerOptions) {
  return defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const { LombokPDF } = await import('lombokpdf')

    const locale = typeof options.locale === 'function'
      ? options.locale(event)
      : options.locale ?? config.lombokpdf.defaultLocale

    const theme = options.theme ?? config.lombokpdf.defaultTheme

    const data = typeof options.data === 'function'
      ? await options.data(event)
      : options.data ?? {}

    const pdf = new LombokPDF({ locale, theme, timeout: config.lombokpdf.timeout })

    const source = options.template
      ? { template: options.template, data }
      : { html: typeof options.html === 'function' ? await options.html(event) : options.html ?? '' }

    const doc = await pdf.from(source).locale(locale).export(options.format ?? 'pdf')
    const bytes = await doc.toBytes()

    const filename = typeof options.filename === 'function'
      ? options.filename(event)
      : options.filename ?? 'document.pdf'

    setResponseHeaders(event, {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'X-LombokPDF-Pages':   String(doc.pages()),
    })

    return bytes
  })
}
