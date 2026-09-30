/**
 * LombokPDF — Browser / CDN Entry Point
 *
 * Loads the WASM core asynchronously.
 * Use this bundle when importing from a CDN or bundling for the browser.
 *
 * @example
 * ```html
 * <script type="module">
 *   import { ready, LombokPDF } from 'https://unpkg.com/lombokpdf/dist/browser.js'
 *
 *   await ready()
 *
 *   const pdf = new LombokPDF()
 *   const doc = await pdf.from({ html: '<h1>Hello</h1>' }).export('pdf')
 *   const url = URL.createObjectURL(new Blob([await doc.toBytes()], { type: 'application/pdf' }))
 *   window.open(url)
 * </script>
 * ```
 */

let _readyPromise: Promise<void> | null = null

/**
 * Initialize the LombokPDF WASM core.
 * Must be called (and awaited) before using LombokPDF in a browser environment.
 * Safe to call multiple times — resolves immediately after first init.
 *
 * @param wasmURL - Optional custom WASM URL (defaults to unpkg CDN)
 */
export async function ready(wasmURL?: string): Promise<void> {
  if (_readyPromise) return _readyPromise

  _readyPromise = (async () => {
    const url = wasmURL ??
      `https://unpkg.com/lombokpdf@${(globalThis as any).__LOMBOKPDF_VERSION__ ?? 'latest'}/dist/lombokpdf.wasm`

    ;(globalThis as any).__LOMBOKPDF_WASM_URL__ = url

    // Pre-fetch and compile WASM for faster first render
    if (typeof WebAssembly.compileStreaming === 'function') {
      await WebAssembly.compileStreaming(fetch(url))
    }
  })()

  return _readyPromise
}

// Re-export public API
export { LombokPDF }    from './core/LombokPDF.js'
export { locale }       from './core/locale.js'
export type {
  LombokPDFOptions,
  ExportFormat,
  Source,
  Skill,
} from './types.js'
export const VERSION = '__LOMBOKPDF_VERSION__'
