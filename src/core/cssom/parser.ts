/**
 * LombokPDF CSS Object Model (CSSOM) Parser
 *
 * Parses embedded <style> blocks and inline style attributes from the parsed HTML tree.
 * Merges with LombokCSS design tokens.
 *
 * Stage 1: basic property extraction for font, color, margin, padding.
 * Stage 2+: full CSS Paged Media — @page, @page :left/:right, named pages,
 *           running elements, generated content, CSS counters.
 */

import type { DefaultTreeAdapterMap } from 'parse5'

type Node = DefaultTreeAdapterMap['node']

export interface CSSPropertyMap {
  [selector: string]: Record<string, string>
}

export interface ComputedPageRules {
  margin?:  string
  size?:    string
  bleed?:   string
  marks?:   string
  running?: { element: string; type: 'running' | 'first' | 'last' | 'start' }
}

export interface CSSOM {
  rules:  CSSPropertyMap
  pages:  Record<string, ComputedPageRules>
  tokens: Record<string, string>

  /**
   * Look up computed style for a selector.
   * Merges token values with inline overrides.
   */
  getStyle(selector: string): Record<string, string>

  /** Look up a CSS custom property (design token) value */
  getToken(name: string): string | undefined
}

export const CSSOMParser = {
  parse(tree: Node, tokens: Record<string, string> = {}): CSSOM {
    const rules: CSSPropertyMap = {}
    const pages: Record<string, ComputedPageRules> = {}

    // Walk tree and collect <style> blocks
    const styleBlocks = collectStyleBlocks(tree)

    for (const css of styleBlocks) {
      parseCSS(css, rules, pages)
    }

    return {
      rules,
      pages,
      tokens,

      getStyle(selector: string) {
        const base = rules[selector] ?? {}
        // Replace var() references with token values
        return Object.fromEntries(
          Object.entries(base).map(([k, v]) => [k, resolveTokens(v, tokens)])
        )
      },

      getToken(name: string) {
        return tokens[name]
      },
    }
  },
}

function collectStyleBlocks(node: any): string[] {
  const blocks: string[] = []
  if (!node) return blocks

  if (node.tagName === 'style') {
    const text = node.childNodes
      ?.map((c: any) => c.value ?? '')
      .join('') ?? ''
    if (text) blocks.push(text)
  }

  for (const child of node.childNodes ?? []) {
    blocks.push(...collectStyleBlocks(child))
  }

  return blocks
}

function parseCSS(
  css: string,
  rules: CSSPropertyMap,
  pages: Record<string, ComputedPageRules>,
): void {
  // Naive Stage-1 CSS parser — splits on { } blocks
  // Stage 2+ uses a full CSS parser (cssparser via WASM)
  const ruleRegex = /([^{}]+)\{([^}]*)\}/g
  let match

  while ((match = ruleRegex.exec(css)) !== null) {
    const selector   = (match[1] ?? '').trim()
    const properties = (match[2] ?? '').trim()

    const propMap: Record<string, string> = {}
    for (const decl of properties.split(';')) {
      const [prop, value] = decl.split(':').map(s => s.trim())
      if (prop && value) propMap[prop] = value
    }

    if (selector.startsWith('@page')) {
      // CSS Paged Media @page rule
      const pageName = selector.replace('@page', '').trim() || 'default'
      pages[pageName] = {
        margin: propMap['margin'],
        size:   propMap['size'],
        bleed:  propMap['bleed'],
        marks:  propMap['marks'],
      }
    } else {
      rules[selector] = { ...(rules[selector] ?? {}), ...propMap }
    }
  }
}

function resolveTokens(value: string, tokens: Record<string, string>): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, name) => tokens[`--${name}`] ?? `var(--${name})`)
}
