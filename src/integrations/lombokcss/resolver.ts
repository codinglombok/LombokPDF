/**
 * LombokCSS → LombokPDF Theme Bridge
 *
 * Resolves LombokCSS design tokens for use as CSS custom properties
 * in the PDF rendering pipeline.
 *
 * Requires peer dependency: @lombok/css
 * GitHub: https://github.com/codinglombok/LombokCSS
 */

export type LombokThemeName =
  | 'modern-corporate-flat'
  | 'resonant-stark'
  | 'neo-brutalism'
  | 'semantic-minimalist'
  | 'glassmorphism'

// Built-in token fallbacks (used when @lombok/css is not installed)
const BUILTIN_TOKENS: Record<LombokThemeName, Record<string, string>> = {
  'modern-corporate-flat': {
    '--color-brand-primary':    '#1a73e8',
    '--color-brand-secondary':  '#1557b0',
    '--color-text':             '#1f2937',
    '--color-text-muted':       '#6b7280',
    '--color-border':           '#e5e7eb',
    '--color-bg':               '#f9fafb',
    '--color-bg-card':          '#ffffff',
    '--font-family-sans':       "'Noto Sans', system-ui, sans-serif",
    '--font-family-mono':       "'Noto Sans Mono', 'Courier New', monospace",
    '--space-1': '4pt',  '--space-2': '8pt',  '--space-4': '16pt',
    '--space-6': '24pt', '--space-8': '32pt',
    '--radius-sm': '2pt', '--radius-md': '4pt', '--radius-lg': '8pt',
  },
  'resonant-stark': {
    '--color-brand-primary':    '#000000',
    '--color-brand-secondary':  '#1a1a1a',
    '--color-text':             '#0a0a0a',
    '--color-text-muted':       '#525252',
    '--color-border':           '#000000',
    '--color-bg':               '#ffffff',
    '--color-bg-card':          '#f5f5f5',
    '--font-family-sans':       "'Noto Sans', system-ui, sans-serif",
    '--font-family-mono':       "'Noto Sans Mono', monospace",
    '--space-1': '4pt',  '--space-2': '8pt',  '--space-4': '16pt',
    '--space-6': '24pt', '--space-8': '32pt',
    '--radius-sm': '0',  '--radius-md': '0',  '--radius-lg': '0',
  },
  'neo-brutalism': {
    '--color-brand-primary':    '#ff6b00',
    '--color-brand-secondary':  '#ffd60a',
    '--color-text':             '#000000',
    '--color-text-muted':       '#333333',
    '--color-border':           '#000000',
    '--color-bg':               '#fffbe6',
    '--color-bg-card':          '#ffffff',
    '--font-family-sans':       "'Noto Sans', system-ui, sans-serif",
    '--font-family-mono':       "'Noto Sans Mono', monospace",
    '--space-1': '4pt',  '--space-2': '8pt',  '--space-4': '16pt',
    '--space-6': '24pt', '--space-8': '32pt',
    '--radius-sm': '0',  '--radius-md': '0',  '--radius-lg': '0',
  },
  'semantic-minimalist': {
    '--color-brand-primary':    '#2563eb',
    '--color-brand-secondary':  '#1d4ed8',
    '--color-text':             '#111827',
    '--color-text-muted':       '#9ca3af',
    '--color-border':           '#f3f4f6',
    '--color-bg':               '#ffffff',
    '--color-bg-card':          '#fafafa',
    '--font-family-sans':       "'Noto Sans', system-ui, sans-serif",
    '--font-family-mono':       "'Noto Sans Mono', monospace",
    '--space-1': '4pt',  '--space-2': '8pt',  '--space-4': '16pt',
    '--space-6': '24pt', '--space-8': '32pt',
    '--radius-sm': '2pt', '--radius-md': '6pt', '--radius-lg': '12pt',
  },
  'glassmorphism': {
    '--color-brand-primary':    '#8b5cf6',
    '--color-brand-secondary':  '#7c3aed',
    '--color-text':             '#1e1b4b',
    '--color-text-muted':       '#6d7280',
    '--color-border':           'rgba(139, 92, 246, 0.2)',
    '--color-bg':               '#faf5ff',
    '--color-bg-card':          'rgba(255,255,255,0.7)',
    '--font-family-sans':       "'Noto Sans', system-ui, sans-serif",
    '--font-family-mono':       "'Noto Sans Mono', monospace",
    '--space-1': '4pt',  '--space-2': '8pt',  '--space-4': '16pt',
    '--space-6': '24pt', '--space-8': '32pt',
    '--radius-sm': '4pt', '--radius-md': '8pt', '--radius-lg': '16pt',
  },
}

export const ThemeResolver = {
  /**
   * Resolve a theme name to its CSS custom property token map.
   * Tries @lombok/css first; falls back to built-in tokens.
   */
  async resolve(themeName: string): Promise<Record<string, string>> {
    // Try loading from @lombok/css peer dependency
    try {
      const lombokCSS = await import('@lombok/css' as any)
      if (typeof lombokCSS.getThemeTokens === 'function') {
        const tokens = lombokCSS.getThemeTokens(themeName)
        if (tokens && typeof tokens === 'object') return tokens
      }
    } catch {
      // @lombok/css not installed — use built-in tokens
    }

    const name = themeName.replace(/^lombok\./, '') as LombokThemeName
    const tokens = BUILTIN_TOKENS[name] ?? BUILTIN_TOKENS['modern-corporate-flat']!
    return tokens
  },

  /** Generate a <style> block from tokens for inline CSS injection */
  toCSS(tokens: Record<string, string>): string {
    const vars = Object.entries(tokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')
    return `:root {\n${vars}\n}`
  },
}
