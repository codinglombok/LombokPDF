/**
 * LombokPDF — Markdown Import Skill
 * Converts GitHub-Flavored Markdown to HTML for the LLE renderer.
 */

// Dynamic import so it's only loaded when the skill is used
async function getMarked() {
  const { marked } = await import('marked')
  const { gfmHeadingId } = await import('marked-gfm-heading-id')

  marked.use(gfmHeadingId())

  marked.setOptions({
    gfm:     true,
    breaks:  false,
  })

  return marked
}

/**
 * Convert GitHub-Flavored Markdown to HTML.
 *
 * Supported extensions:
 * - GFM tables
 * - Fenced code blocks (with language class)
 * - Strikethrough
 * - Task lists
 * - Auto-links
 * - Heading IDs (for TOC linking)
 */
export async function markdownToHTML(md: string): Promise<string> {
  const marked = await getMarked()
  return marked.parse(md)
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
