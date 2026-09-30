/**
 * LombokPDF — React Adapter
 * Package: lombokpdf-react
 *
 * Install:
 *   npm install lombokpdf lombokpdf-react
 *
 * @example
 * ```tsx
 * import { LombokPDFViewer, useLombokPDF } from 'lombokpdf-react'
 *
 * function InvoicePage() {
 *   const { generate, download, loading } = useLombokPDF()
 *
 *   return (
 *     <div>
 *       <LombokPDFViewer template="invoice" data={data} locale="en-US" height={600} />
 *       <button onClick={async () => {
 *         const doc = await generate({ template: 'invoice', data, locale: 'en-US' })
 *         download(doc, 'invoice.pdf')
 *       }} disabled={loading}>
 *         {loading ? 'Generating…' : 'Download PDF'}
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import type { ExportFormat, Source } from 'lombokpdf'

// ─── useLombokPDF hook ────────────────────────────────────────────────────────

export interface GenerateOptions {
  template?: string
  html?:     string
  data?:     Record<string, unknown>
  locale?:   string
  theme?:    string
  format?:   ExportFormat
}

export interface UseLombokPDFReturn {
  generate: (options: GenerateOptions) => Promise<LombokDoc>
  download: (doc: LombokDoc, filename?: string) => void
  open:     (doc: LombokDoc) => void
  loading:  boolean
  error:    Error | null
}

interface LombokDoc {
  toBytes():   Promise<Uint8Array>
  toBase64():  Promise<string>
  toDataURI(): Promise<string>
  pages():     number
}

export function useLombokPDF(defaults: Partial<GenerateOptions> = {}): UseLombokPDFReturn {
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<Error | null>(null)

  const generate = useCallback(async (opts: GenerateOptions): Promise<LombokDoc> => {
    setLoading(true)
    setError(null)

    try {
      const { LombokPDF } = await import('lombokpdf')
      const pdf = new LombokPDF({
        locale: opts.locale ?? defaults.locale ?? 'en-US',
        theme:  opts.theme  ?? defaults.theme,
      })

      const source: Source = opts.template
        ? { template: opts.template, data: opts.data }
        : { html: opts.html ?? '' }

      return await pdf
        .from(source)
        .locale(opts.locale ?? defaults.locale ?? 'en-US')
        .export(opts.format ?? 'pdf') as unknown as LombokDoc
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [defaults.locale, defaults.theme])

  const download = useCallback((doc: LombokDoc, filename = 'document.pdf') => {
    doc.toBytes().then(bytes => {
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: filename }).click()
      URL.revokeObjectURL(url)
    })
  }, [])

  const open = useCallback((doc: LombokDoc) => {
    doc.toBytes().then(bytes => {
      const blob = new Blob([bytes], { type: 'application/pdf' })
      window.open(URL.createObjectURL(blob), '_blank')
    })
  }, [])

  return { generate, download, open, loading, error }
}

// ─── LombokPDFViewer component ────────────────────────────────────────────────

export interface LombokPDFViewerProps {
  template?: string
  html?:     string
  data?:     Record<string, unknown>
  locale?:   string
  theme?:    string
  format?:   ExportFormat
  width?:    number | string
  height?:   number | string
  className?: string
  style?:    CSSProperties
  onGenerated?: (doc: LombokDoc) => void
  onError?:     (error: Error) => void
}

export function LombokPDFViewer({
  template,
  html,
  data,
  locale    = 'en-US',
  theme     = 'modern-corporate-flat',
  format    = 'pdf',
  width     = '100%',
  height    = 600,
  className,
  style,
  onGenerated,
  onError,
}: LombokPDFViewerProps) {
  const [dataURI,  setDataURI ] = useState<string>('')
  const [loading,  setLoading ] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMsg(null)

    async function render() {
      try {
        const { LombokPDF } = await import('lombokpdf')
        const pdf = new LombokPDF({ locale, theme })

        const source: Source = template
          ? { template, data }
          : { html: html ?? '' }

        const doc = await pdf.from(source).locale(locale).export(format)
        if (cancelled) return

        const uri = await (doc as unknown as LombokDoc).toDataURI()
        setDataURI(uri)
        onGenerated?.(doc as unknown as LombokDoc)
      } catch (err) {
        if (cancelled) return
        const e = err instanceof Error ? err : new Error(String(err))
        setErrorMsg(e.message)
        onError?.(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    render()
    return () => { cancelled = true }
  }, [template, html, JSON.stringify(data), locale, theme, format])

  const containerStyle: CSSProperties = {
    width,
    height,
    ...style,
  }

  if (loading) {
    return (
      <div style={{
        ...containerStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f9fafb', color: '#6b7280',
        fontFamily: 'sans-serif', fontSize: 14,
        borderRadius: 4,
      }} className={className}>
        Generating PDF…
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{
        ...containerStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fef2f2', color: '#dc2626',
        fontFamily: 'sans-serif', fontSize: 13, padding: 16,
        borderRadius: 4,
      }} className={className}>
        Error: {errorMsg}
      </div>
    )
  }

  return (
    <iframe
      src={dataURI}
      title="PDF Preview"
      style={{ ...containerStyle, border: 'none', borderRadius: 4, display: 'block' }}
      className={className}
    />
  )
}

export default LombokPDFViewer
