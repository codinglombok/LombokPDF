/**
 * LombokPDF — Cross-Reference Processor
 * Numbers figures/tables/equations and resolves {{ref:id}} markers.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import type { CrossRefOptions } from './index.js'

export const CrossRefProcessor = {
  async process(doc: LombokDocument, options: CrossRefOptions): Promise<LombokDocument> {
    // Cross-reference numbering (Figure 1, Table 2, etc.) and resolving
    // {{ref:fig-1}} style markers to "Figure 1 (page 4)" requires a
    // two-pass layout: first pass to assign numbers/pages, second pass
    // to substitute references. This is implemented in the Stage 2 WASM
    // LLE renderer, which supports CSS `counter()` and `target-counter()`
    // (CSS Generated Content for Paged Media, Level 3).
    //
    // Stage 1 recommendation: use CSS counters directly in your template:
    //   .figure-caption::before { content: "Figure " counter(figure) ": "; counter-increment: figure; }

    console.warn(
      '[LombokPDF/crossRef] Two-pass cross-reference resolution requires the Stage 2 WASM LLE renderer. ' +
      'Use CSS counter()/target-counter() in your source HTML for Stage 1.'
    )

    return doc
  },
}
