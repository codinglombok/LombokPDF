import type {
  Source, ExportFormat, LombokPDFOptions, LocaleConfig,
  PageConfig, PDFMetadata, EmbedPosition, Skill,
} from '../types.js'
import type { LLEEngine } from './lle/engine.js'
import { Document } from './Document.js'
import { TemplateEngine } from '../templates/engine.js'
import { resolveLocale } from './locale.js'

interface BuildState {
  source: Source
  localeCfg: LocaleConfig
  theme: string
  page: PageConfig
  metadata: Partial<PDFMetadata>
  embeds: Array<{ chart: unknown; position: EmbedPosition }>
  skills: Skill[]
}

/**
 * Fluent builder returned by LombokPDF.from().
 * All methods return `this` for chaining; call `.export()` to produce a Document.
 */
export class Builder {
  private readonly state: BuildState

  constructor(
    source: Source,
    private readonly engine: LLEEngine,
    defaults: Required<LombokPDFOptions>,
  ) {
    this.state = {
      source,
      localeCfg: resolveLocale(defaults.locale),
      theme:     typeof defaults.theme === 'string' ? defaults.theme : defaults.theme.name,
      page:      defaults.page,
      metadata:  {},
      embeds:    [],
      skills:    [],
    }
  }

  /** Override the template and optionally provide data */
  template(name: string, data?: Record<string, unknown>): this {
    this.state.source = data
      ? { template: name, data }
      : { template: name }
    return this
  }

  /** Set locale (BCP 47 tag or full LocaleConfig) */
  locale(locale: string | LocaleConfig): this {
    this.state.localeCfg = resolveLocale(locale)
    return this
  }

  /** Set LombokCSS design theme */
  theme(name: string): this {
    this.state.theme = name
    return this
  }

  /** Override page size, orientation, or margins */
  page(config: PageConfig): this {
    this.state.page = { ...this.state.page, ...config }
    return this
  }

  /** Set PDF metadata (title, author, etc.) */
  metadata(meta: Partial<PDFMetadata>): this {
    this.state.metadata = { ...this.state.metadata, ...meta }
    return this
  }

  /**
   * Embed a LombokCharts chart into the PDF.
   * Requires `@lombok/charts` peer dependency.
   */
  embed(chart: unknown, position: EmbedPosition = {}): this {
    this.state.embeds.push({ chart, position })
    return this
  }

  /**
   * Attach a skill (post-processor) to the pipeline.
   * Skills run in order after rendering: sign, encrypt, watermark, etc.
   *
   * @example
   * ```typescript
   * import { signPKCS7 } from 'lombokpdf/skills/security'
   * builder.pipe(signPKCS7({ cert: './cert.p12', pass: process.env.CERT_PASS }))
   * ```
   */
  pipe(skill: Skill): this {
    this.state.skills.push(skill)
    return this
  }

  /**
   * Render the document and run all piped skills.
   * @param format - Output format (default: 'pdf')
   */
  async export(format: ExportFormat = 'pdf'): Promise<Document> {
    // 1. Resolve source to raw HTML
    const html = await this._resolveSource()

    // 2. Render via LLE
    let raw = await this.engine.render(html, {
      locale:   this.state.localeCfg,
      theme:    this.state.theme,
      page:     this.state.page,
      format,
      metadata: this.state.metadata,
    })

    // 3. Embed charts
    for (const { chart, position } of this.state.embeds) {
      raw = await this._embedChart(raw, chart, position)
    }

    // 4. Create Document
    let doc = new Document(raw)

    // 5. Apply skills in pipeline order
    for (const skill of this.state.skills) {
      doc = await skill.apply(doc) as Document
    }

    return doc
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async _resolveSource(): Promise<string> {
    const src = this.state.source

    if ('html' in src) return src.html
    if ('markdown' in src) return this._markdownToHTML(src.markdown)
    if ('template' in src) return TemplateEngine.render(src.template, src.data ?? {}, this.state.localeCfg)
    if ('file' in src) return this._loadFile(src.file)
    if ('docx' in src) return this._convertDocx(src.docx)
    if ('csv' in src) return this._csvToHTML(src.csv, src.options as Record<string, unknown> | undefined)
    if ('url' in src) return this._fetchURL(src.url)

    throw new Error('LombokPDF: unknown source type')
  }

  private async _markdownToHTML(md: string): Promise<string> {
    const { markdownToHTML } = await import('../skills/io/importMarkdown.js')
    return markdownToHTML(md)
  }

  private async _loadFile(path: string): Promise<string> {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(path, 'utf-8')
    if (path.endsWith('.md')) return this._markdownToHTML(content)
    if (path.endsWith('.docx')) return this._convertDocx(await readFile(path))
    if (path.endsWith('.csv')) return this._csvToHTML(content)
    return content // assume HTML
  }

  private async _convertDocx(docx: string | Uint8Array): Promise<string> {
    const { docxToHTML } = await import('../skills/io/importDocx.js')
    return docxToHTML(docx)
  }

  private async _csvToHTML(csv: string, options?: Record<string, unknown>): Promise<string> {
    const { csvToHTML } = await import('../skills/io/importCSV.js')
    return csvToHTML(csv, options)
  }

  private async _fetchURL(url: string): Promise<string> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`LombokPDF: failed to fetch ${url}: ${res.status}`)
    return res.text()
  }

  private async _embedChart(
    raw: Uint8Array,
    chart: unknown,
    position: EmbedPosition,
  ): Promise<Uint8Array> {
    const { embedChartInPDF } = await import('../integrations/lombokcharts/index.js')
    return embedChartInPDF(raw, chart, position)
  }
}
