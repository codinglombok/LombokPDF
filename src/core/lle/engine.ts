import type { LocaleConfig, PageConfig, ExportFormat, PDFMetadata } from '../../types.js'
import type { LombokPDFOptions } from '../../types.js'

export interface RenderOptions {
  locale:   LocaleConfig
  theme:    string
  page:     PageConfig
  format:   ExportFormat
  metadata: Partial<PDFMetadata>
}

/**
 * LombokLayout Engine (LLE)
 *
 * The core rendering engine.
 * Stage 1: PDFKit-backed JS implementation with CSS Paged Media subset.
 * Stage 2+: Rust → WASM implementation for full CSS Paged Media + HarfBuzz.
 *
 * The public API is identical regardless of backend — callers never interact
 * with the engine directly; only Builder does.
 */
export class LLEEngine {
  private readonly opts: Required<LombokPDFOptions>
  private wasmInstance: WebAssembly.Instance | null = null

  constructor(opts: Required<LombokPDFOptions>) {
    this.opts = opts
  }

  /**
   * Render HTML to PDF bytes.
   * Returns raw Uint8Array of the PDF/A/PNG/SVG output.
   */
  async render(html: string, renderOpts: RenderOptions): Promise<Uint8Array> {
    // Stage 1: JS-backed rendering
    // Stage 2+: delegate to WASM core
    const backend = await this._getBackend()
    return backend.render(html, renderOpts)
  }

  private async _getBackend(): Promise<LLEBackend> {
    // Try WASM first (Stage 2+), fall back to JS backend (Stage 1)
    if (this.wasmInstance) {
      return new WASMBackend(this.wasmInstance)
    }

    try {
      const wasm = await this._loadWASM()
      this.wasmInstance = wasm
      return new WASMBackend(wasm)
    } catch {
      // WASM not available (Stage 1 / CI environments) — use JS backend
      return new JSBackend(this.opts)
    }
  }

  private async _loadWASM(): Promise<WebAssembly.Instance> {
    // In Node.js, load from package assets
    // In browser, load via fetch from CDN
    const wasmURL = this._resolveWASMPath()
    const response = await fetch(wasmURL)
    const bytes = await response.arrayBuffer()
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {
        // WASM imports: memory, logging, font loading callbacks
        memory: new WebAssembly.Memory({ initial: 64, maximum: 512 }),
        log_str: (ptr: number, len: number) => {
          if (this.opts.debug) {
            // Read string from WASM memory
            console.debug('[LLE WASM]', ptr, len)
          }
        },
      },
    })
    return instance
  }

  private _resolveWASMPath(): string {
    if (typeof window !== 'undefined') {
      // Browser: load from CDN or bundler-provided URL
      return (globalThis as any).__LOMBOKPDF_WASM_URL__ ??
        `https://unpkg.com/lombokpdf@${(globalThis as any).__LOMBOKPDF_VERSION__ ?? 'latest'}/dist/lombokpdf.wasm`
    }
    // Node.js: load from package directory
    return new URL('../../assets/lombokpdf.wasm', import.meta.url).pathname
  }
}

// ─── Backend Abstraction ──────────────────────────────────────────────────────

interface LLEBackend {
  render(html: string, opts: RenderOptions): Promise<Uint8Array>
}

// ─── WASM Backend (Stage 2+) ─────────────────────────────────────────────────

class WASMBackend implements LLEBackend {
  constructor(private readonly instance: WebAssembly.Instance) {}

  async render(html: string, opts: RenderOptions): Promise<Uint8Array> {
    const exports = this.instance.exports as any
    const memory  = exports.memory as WebAssembly.Memory

    // Encode HTML and options as UTF-8 into WASM memory
    const enc       = new TextEncoder()
    const htmlBytes = enc.encode(html)
    const optsBytes = enc.encode(JSON.stringify(opts))

    // Allocate WASM memory
    const htmlPtr = exports.alloc(htmlBytes.length) as number
    const optsPtr = exports.alloc(optsBytes.length) as number

    new Uint8Array(memory.buffer).set(htmlBytes, htmlPtr)
    new Uint8Array(memory.buffer).set(optsBytes, optsPtr)

    // Call render
    const docPtr  = exports.lombok_render_html(htmlPtr, htmlBytes.length, optsPtr, optsBytes.length) as number
    const docLen  = exports.lombok_doc_len(docPtr) as number
    const docData = exports.lombok_doc_ptr(docPtr) as number

    // Copy result out of WASM memory
    const result = new Uint8Array(memory.buffer, docData, docLen).slice()

    // Free WASM allocations
    exports.free(htmlPtr)
    exports.free(optsPtr)
    exports.lombok_doc_free(docPtr)

    return result
  }
}

// ─── JS Backend (Stage 1 / Fallback) ─────────────────────────────────────────

class JSBackend implements LLEBackend {
  constructor(private readonly opts: Required<LombokPDFOptions>) {}

  async render(html: string, renderOpts: RenderOptions): Promise<Uint8Array> {
    // Stage 1: uses PDFKit for basic rendering
    // Full CSS Paged Media support is in the WASM backend.
    const { renderWithPDFKit } = await import('./pdfkit-renderer.js')
    return renderWithPDFKit(html, renderOpts, this.opts)
  }
}
