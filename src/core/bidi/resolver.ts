/**
 * Unicode Bidirectional Algorithm (UAX #9) resolver.
 * Stage 1: heuristic paragraph-level BiDi.
 * Stage 2+: full UAX #9 via WASM (via bidi-js or Rust icu4x bindings).
 */

type Direction = 'ltr' | 'rtl' | 'auto'

// Strong RTL Unicode ranges (simplified for Stage 1)
const RTL_CHARS = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0800-\u083F]/

export class BiDiResolver {
  private readonly baseDir: Direction

  constructor(baseDir: Direction = 'ltr') {
    this.baseDir = baseDir
  }

  /**
   * Resolve text for a paragraph.
   * Returns the text with proper Unicode directional marks prepended.
   */
  resolve(text: string): string {
    if (!text.trim()) return text

    const direction = this._detectDirection(text)

    // Prepend Unicode directional marks so PDF renderers respect direction
    if (direction === 'rtl') {
      return '\u202B' + text + '\u202C'  // RLE … PDF
    }

    if (this.baseDir === 'rtl') {
      return '\u202A' + text + '\u202C'  // LRE … PDF (override base RTL)
    }

    return text
  }

  /**
   * Detect the primary direction of a paragraph.
   * Uses Unicode first strong character algorithm (P2/P3 from UAX #9).
   */
  private _detectDirection(text: string): Direction {
    if (this.baseDir !== 'auto') {
      // If RTL text found in LTR base document, override for this para
      const rtlCount  = (text.match(RTL_CHARS) ?? []).length
      const totalLen  = text.replace(/\s/g, '').length
      if (rtlCount > 0 && rtlCount / totalLen > 0.3) return 'rtl'
      return this.baseDir
    }

    // auto: detect from first strong character
    for (const char of text) {
      if (RTL_CHARS.test(char)) return 'rtl'
      if (/[A-Za-z\u00C0-\u024F]/.test(char)) return 'ltr'
    }

    return 'ltr'
  }

  /** Wrap a block in RTL context markers */
  static rtlBlock(text: string): string {
    return '\u202B' + text + '\u202C'
  }

  /** Wrap a block in LTR context markers */
  static ltrBlock(text: string): string {
    return '\u202A' + text + '\u202C'
  }
}
