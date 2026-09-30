import type { LombokPDFOptions, Source, SupportMatrix } from '../types.js'
import { Builder } from './Builder.js'
import { resolveLocale } from './locale.js'
import { LLEEngine } from './lle/engine.js'

/**
 * LombokPDF — main entry point.
 *
 * @example
 * ```typescript
 * const pdf = new LombokPDF({ locale: 'id-ID' })
 * const doc = await pdf.from({ template: 'invoice', data: { company: 'Acme' } }).export('pdf')
 * await doc.save('./invoice.pdf')
 * ```
 */
export class LombokPDF {
  private readonly options: Required<LombokPDFOptions>
  private readonly engine: LLEEngine

  constructor(options: LombokPDFOptions = {}) {
    this.options = {
      locale:  options.locale  ?? 'en-US',
      theme:   options.theme   ?? 'modern-corporate-flat',
      fonts:   options.fonts   ?? {},
      page:    options.page    ?? { size: 'A4', orientation: 'portrait' },
      debug:   options.debug   ?? false,
      timeout: options.timeout ?? 30_000,
    }
    this.engine = new LLEEngine(this.options)
  }

  /**
   * Begin a fluent builder chain from a source document.
   *
   * @param source - HTML, Markdown, template reference, file path, DOCX, CSV, or URL
   * @returns A Builder for chaining locale, theme, skills, and export
   */
  from(source: Source): Builder {
    return new Builder(source, this.engine, this.options)
  }

  /** Shorthand for from({ html }) */
  fromHTML(html: string, baseUrl?: string): Builder {
    return baseUrl 
      ? this.from({ html, baseUrl })
      : this.from({ html })
  }

  /** Shorthand for from({ markdown }) */
  fromMarkdown(md: string): Builder {
    return this.from({ markdown: md })
  }

  /** Shorthand for from({ file }) */
  fromFile(path: string): Builder {
    return this.from({ file: path })
  }

  /** Shorthand for from({ url }) */
  fromURL(url: string): Builder {
    return this.from({ url })
  }

  /** Library version */
  static version(): string {
    return '__LOMBOKPDF_VERSION__'
  }

  /** Feature support matrix for this runtime */
  static supported(): SupportMatrix {
    return {
      cssPagedMedia: true,
      flexbox:       true,
      grid:          true,
      mathml:        true,
      svg:           true,
      bidi:          true,
      harfbuzz:      typeof WebAssembly !== 'undefined',
      wasm:          typeof WebAssembly !== 'undefined',
      locales:       resolveLocale.availableLocales(),
    }
  }
}
