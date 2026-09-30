/**
 * LombokPDF — Footnote/Endnote Processor
 * Processes footnote markers (e.g. superscript refs) and lays out notes.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { FootnotesOptions } from './index.js'

export const FootnoteProcessor = {
  async process(doc: LombokDocument, options: FootnotesOptions): Promise<LombokDocument> {
    const {
      style          = 'footnote',
      numberStyle    = 'decimal',
      restartPerPage = false,
      separator      = true,
    } = options

    // Footnote extraction and layout requires access to the semantic HTML
    // tree at render time (to find <sup class="footnote-ref"> markers and
    // their corresponding <aside class="footnote"> content, then re-flow
    // them to the bottom of each page or an endnotes section).
    //
    // This is implemented natively by the Stage 2 WASM LLE renderer's
    // paged-media engine, since footnote placement interacts with page
    // break decisions during layout — it cannot be reliably done as a
    // pure post-processing pass on already-paginated PDF bytes.
    //
    // Stage 1 recommendation: include footnotes directly in your HTML/template
    // using CSS `float: footnote` (Paged Media spec) if your target renderer
    // supports it, or use manual endnote sections with cross-reference links.

    console.warn(
      '[LombokPDF/footnotes] Full footnote re-flow requires the Stage 2 WASM LLE renderer. ' +
      'This is a no-op in the Stage 1 PDFKit backend — use CSS float:footnote in your source HTML instead.'
    )

    return doc
  },
}

