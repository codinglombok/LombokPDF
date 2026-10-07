// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/markdown.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * LombokMarkDown - CommonMark 0.31.2 + GFM Markdown to HTML (public API).
 */
import { BlockParser } from './blocks.js'
import { type MdNode, walk } from './node.js'
import { HtmlRenderer, Slugger, isUnsafeURL, plainText } from './render.js'
import type { ASTNode, MarkdownMetadata, MarkdownOptions, TOCEntry } from './types.js'

const DEFAULTS: Required<Pick<MarkdownOptions, 'gfm' | 'breaks' | 'html' | 'safeLinks' | 'headingIds'>> = {
  gfm: true,
  breaks: false,
  html: false,
  safeLinks: true,
  headingIds: false,
}

/** Builds the public AST node for one internal node (without children). */
function shallowAST(n: MdNode, safeLinks: boolean): ASTNode {
  const url = (u: string) => (safeLinks && isUnsafeURL(u) ? '' : u)
  switch (n.type) {
    case 'document': return { type: 'root', children: [] }
    case 'heading': return { type: 'heading', depth: n.level, children: [] }
    case 'paragraph': return { type: 'paragraph', children: [] }
    case 'blockquote': return { type: 'blockquote', children: [] }
    case 'list': {
      const ld = n.listData!
      const node: ASTNode = { type: 'list', ordered: ld.type === 'ordered', loose: !ld.tight, children: [] }
      if (ld.type === 'ordered') node.start = ld.start
      return node
    }
    case 'item': {
      const node: ASTNode = { type: 'listItem', children: [] }
      if (n.checked !== undefined) node.checked = n.checked
      return node
    }
    case 'codeBlock': {
      const node: ASTNode = { type: 'codeBlock', value: n.literal }
      const lang = n.info.split(/[ \t]+/)[0]
      if (lang) node.lang = lang
      if (n.info) node.meta = n.info
      return node
    }
    case 'htmlBlock': return { type: 'html', value: n.literal }
    case 'thematicBreak': return { type: 'thematicBreak' }
    case 'table': return { type: 'table', children: [] }
    case 'tableRow': return { type: 'tableRow', header: n.header, children: [] }
    case 'tableCell': {
      const node: ASTNode = { type: 'tableCell', header: n.header, children: [] }
      if (n.align) node.align = n.align
      return node
    }
    case 'text': return { type: 'text', value: n.literal }
    case 'softbreak': return { type: 'softBreak' }
    case 'linebreak': return { type: 'lineBreak' }
    case 'emph': return { type: 'emphasis', children: [] }
    case 'strong': return { type: 'strong', children: [] }
    case 'delete': return { type: 'delete', children: [] }
    case 'code': return { type: 'code', value: n.literal, inline: true }
    case 'htmlInline': return { type: 'html', value: n.literal, inline: true }
    case 'link': {
      const node: ASTNode = { type: 'link', href: url(n.destination), children: [] }
      if (n.title) node.title = n.title
      return node
    }
    case 'image': {
      const node: ASTNode = { type: 'image', href: url(n.destination), alt: plainText(n) }
      if (n.title) node.title = n.title
      return node
    }
  }
}

/** Converts the internal tree to the public AST (SPEC §6), iteratively. */
function toAST(root: MdNode, safeLinks: boolean): ASTNode {
  const stack: ASTNode[] = []
  let result: ASTNode | undefined
  let skip: MdNode | null = null
  for (const { node, entering } of walk(root)) {
    if (skip) {
      if (node === skip && !entering) skip = null
      continue
    }
    if (!entering) {
      result = stack.pop()
      continue
    }
    const ast = shallowAST(node, safeLinks)
    stack[stack.length - 1]?.children?.push(ast)
    // images keep only alt text; leaves have no exit event
    if (node.type === 'image') skip = node
    else if (ast.children) stack.push(ast)
    else if (!stack.length) result = ast
  }
  return result!
}

function collectMetadata(doc: MdNode, safeLinks: boolean): MarkdownMetadata {
  const meta: MarkdownMetadata = { headings: [], links: [], images: [], codeBlocks: [] }
  const url = (u: string) => (safeLinks && isUnsafeURL(u) ? '' : u)
  for (const { node: n, entering } of walk(doc)) {
    if (!entering) continue
    switch (n.type) {
      case 'heading':
        meta.headings.push({ level: n.level, text: plainText(n) })
        break
      case 'codeBlock': {
        const lang = n.info.split(/[ \t]+/)[0]
        const entry: { lang?: string; code: string } = { code: n.literal.replace(/\n$/, '') }
        if (lang) entry.lang = lang
        meta.codeBlocks.push(entry)
        break
      }
      case 'link': {
        const entry: { text: string; url: string; title?: string } = { text: plainText(n), url: url(n.destination) }
        if (n.title) entry.title = n.title
        meta.links.push(entry)
        break
      }
      case 'image': {
        const entry: { alt: string; src: string; title?: string } = { alt: plainText(n), src: url(n.destination) }
        if (n.title) entry.title = n.title
        meta.images.push(entry)
        break
      }
    }
  }
  return meta
}

/**
 * Usage:
 *   new Markdown('# Hello\n\nThis is **bold**').getHTML()
 *   // => '<h1>Hello</h1>\n<p>This is <strong>bold</strong></p>\n'
 */
export class Markdown {
  private readonly input: string
  private readonly options: MarkdownOptions & typeof DEFAULTS
  private doc?: MdNode
  private ast?: ASTNode[]
  private metadata?: MarkdownMetadata
  private html?: string

  constructor(input: string, options?: MarkdownOptions) {
    this.input = input
    this.options = { ...DEFAULTS, ...options }
  }

  /** Parses the input; later calls are no-ops. Returns `this` for chaining. */
  parse(): this {
    if (this.doc) return this
    this.doc = new BlockParser({ gfm: this.options.gfm }).parse(this.input)
    this.html = new HtmlRenderer({
      html: this.options.html,
      safeLinks: this.options.safeLinks,
      breaks: this.options.breaks,
      headingIds: this.options.headingIds,
      tagFilter: this.options.gfm,
    }).render(this.doc)
    this.ast = toAST(this.doc, this.options.safeLinks).children ?? []
    this.metadata = collectMetadata(this.doc, this.options.safeLinks)
    return this
  }

  getHTML(): string {
    return this.parse().html!
  }

  /** Top-level AST nodes (children of the root). */
  getAST(): ASTNode[] {
    return this.parse().ast!
  }

  getMetadata(): MarkdownMetadata {
    return this.parse().metadata!
  }

  /** Nested table of contents; ids match `headingIds: true` output. */
  getTableOfContents(): TOCEntry[] {
    const slugger = new Slugger()
    const toc: TOCEntry[] = []
    const stack: TOCEntry[] = []
    for (const h of this.getMetadata().headings) {
      const entry: TOCEntry = { level: h.level, text: h.text, id: slugger.slug(h.text), children: [] }
      while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) stack.pop()
      if (stack.length === 0) toc.push(entry)
      else stack[stack.length - 1].children!.push(entry)
      stack.push(entry)
    }
    return toc
  }

  toJSON(): { ast: ASTNode[]; metadata: MarkdownMetadata; html: string } {
    return { ast: this.getAST(), metadata: this.getMetadata(), html: this.getHTML() }
  }

  getLinks(): MarkdownMetadata['links'] {
    return this.getMetadata().links
  }

  getImages(): MarkdownMetadata['images'] {
    return this.getMetadata().images
  }

  getCodeBlocks(): MarkdownMetadata['codeBlocks'] {
    return this.getMetadata().codeBlocks
  }

  getHeadings(): MarkdownMetadata['headings'] {
    return this.getMetadata().headings
  }
}

/** Converts Markdown to HTML in one call. */
export function markdownToHTML(input: string, options?: MarkdownOptions): string {
  return new Markdown(input, options).getHTML()
}

export type { ASTNode, MarkdownMetadata, MarkdownOptions, TOCEntry }
