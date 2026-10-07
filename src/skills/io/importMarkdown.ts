/**
 * LombokPDF — Markdown Import Skill
 * Converts CommonMark 0.31.2 + GitHub-Flavored Markdown to HTML for the LLE renderer,
 * using LombokMarkDown (vendored in src/vendor/lombokmarkdown).
 */

import { markdownToHTML as renderMarkdown } from '../../vendor/lombokmarkdown/index.js'

export interface MarkdownToHTMLOptions {
  /**
   * Pass raw HTML in the Markdown source through to the renderer (default true,
   * so documents can carry `<style>`, `<div class>` and similar layout markup).
   * Set to false for Markdown written by untrusted users: raw HTML is then
   * shown as text.
   */
  html?: boolean
  /** Render soft line breaks as `<br />` (default false). */
  breaks?: boolean
}

/**
 * Convert GitHub-Flavored Markdown to HTML.
 *
 * Supported extensions:
 * - GFM tables
 * - Fenced code blocks (with language class)
 * - Strikethrough
 * - Task lists
 * - Extended autolinks
 * - GitHub-style heading IDs (for TOC linking)
 *
 * `javascript:`, `vbscript:`, `file:` and non-image `data:` link targets are always removed.
 */
export async function markdownToHTML(md: string, options: MarkdownToHTMLOptions = {}): Promise<string> {
  return renderMarkdown(md, {
    gfm:        true,
    headingIds: true,
    safeLinks:  true,
    html:       options.html ?? true,
    breaks:     options.breaks ?? false,
  })
}

/**
 * Skill wrapper — use in Builder.pipe() via importMarkdown()
 */
export function importMarkdown() {
  return {
    name: 'importMarkdown' as const,
    async apply(doc: unknown) {
      // No-op when used as pipe skill (conversion happens in Builder._resolveSource)
      return doc
    },
  }
}
