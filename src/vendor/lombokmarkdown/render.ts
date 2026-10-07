// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/render.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * HTML renderer (CommonMark reference output format; SPEC §5).
 */
import { escapeHTML } from './common.js'
import { type MdNode, walk } from './node.js'

export interface RenderOptions {
  /** Pass raw HTML through; when false it is escaped as text (default false). */
  html: boolean
  /** Replace javascript:, vbscript:, file: and non-image data: URLs with "" (default true). */
  safeLinks: boolean
  /** Render soft line breaks as `<br />` (default false). */
  breaks: boolean
  /** Add `id` attributes to headings (default false). */
  headingIds: boolean
  /** GFM: filter dangerous raw HTML tags when `html` is true (default true with GFM). */
  tagFilter: boolean
}

const reUnsafeProtocol = /^(?:javascript|vbscript|file|data):/i
const reSafeDataProtocol = /^data:image\/(?:png|gif|jpeg|webp);/i
const reTagFilter = /<(\/?)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?=[\s/>]|$)/gi

export function isUnsafeURL(url: string): boolean {
  return reUnsafeProtocol.test(url) && !reSafeDataProtocol.test(url)
}

/** Plain text of inline content (image alt text, heading text). */
export function plainText(node: MdNode): string {
  let out = ''
  for (const { node: c, entering } of walk(node)) {
    if (!entering) continue
    if (c.type === 'text' || c.type === 'code') out += c.literal
    else if (c.type === 'softbreak' || c.type === 'linebreak') out += ' '
  }
  return out
}

/** GitHub-style heading slug; repeated slugs get -1, -2, ... (SPEC §5.4). */
export class Slugger {
  private occurrences = new Map<string, number>()
  slug(value: string): string {
    const base = value.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-')
    let slug = base
    if (this.occurrences.has(slug)) {
      let n = this.occurrences.get(base)!
      do {
        n++
        slug = `${base}-${n}`
      } while (this.occurrences.has(slug))
      this.occurrences.set(base, n)
    }
    this.occurrences.set(slug, 0)
    return slug
  }
}

export class HtmlRenderer {
  private out = ''
  private slugger = new Slugger()

  constructor(private opts: RenderOptions) {}

  /** Whether the output ends with a line feed (tracked so the string is never re-read). */
  private atLineStart = true

  private cr(): void {
    if (!this.atLineStart) this.w('\n')
  }

  private w(s: string): void {
    if (s.length === 0) return
    this.out += s
    this.atLineStart = s[s.length - 1] === '\n'
  }

  private raw(s: string): string {
    if (!this.opts.html) return escapeHTML(s)
    return this.opts.tagFilter ? s.replace(reTagFilter, '&lt;$1$2') : s
  }

  private url(u: string): string {
    return this.opts.safeLinks && isUnsafeURL(u) ? '' : escapeHTML(u)
  }

  render(doc: MdNode): string {
    this.out = ''
    this.atLineStart = true
    this.slugger = new Slugger()
    // Inside an image the children become alt text, so rendering skips until the image exits.
    let skipUntil: MdNode | null = null
    for (const { node: n, entering } of walk(doc)) {
      if (skipUntil) {
        if (n === skipUntil && !entering) skipUntil = null
        continue
      }
      if (n.type === 'image' && entering) {
        this.w(`<img src="${this.url(n.destination)}" alt="${escapeHTML(plainText(n))}"` +
          `${n.title ? ` title="${escapeHTML(n.title)}"` : ''} />`)
        skipUntil = n
        continue
      }
      this.node(n, entering)
    }
    return this.out
  }

  private inTightList(n: MdNode): boolean {
    const grandparent = n.parent?.parent
    return !!grandparent && grandparent.type === 'list' && !!grandparent.listData?.tight
  }

  private node(n: MdNode, entering: boolean): void {
    switch (n.type) {
      case 'document': break
      case 'paragraph':
        if (this.inTightList(n)) break
        if (entering) {
          this.cr()
          this.w('<p>')
        } else {
          this.w('</p>')
          this.cr()
        }
        break
      case 'heading':
        if (entering) {
          this.cr()
          const id = this.opts.headingIds ? ` id="${escapeHTML(this.slugger.slug(plainText(n)))}"` : ''
          this.w(`<h${n.level}${id}>`)
        } else {
          this.w(`</h${n.level}>`)
          this.cr()
        }
        break
      case 'blockquote':
        this.cr()
        this.w(entering ? '<blockquote>' : '</blockquote>')
        this.cr()
        break
      case 'list': {
        const ld = n.listData!
        const tag = ld.type === 'bullet' ? 'ul' : 'ol'
        this.cr()
        if (entering) {
          const start = ld.type === 'ordered' && ld.start !== undefined && ld.start !== 1 ? ` start="${ld.start}"` : ''
          this.w(`<${tag}${start}>`)
        } else {
          this.w(`</${tag}>`)
        }
        this.cr()
        break
      }
      case 'item':
        if (entering) {
          this.w('<li>')
          if (n.checked !== undefined) {
            this.w(n.checked ? '<input checked="" disabled="" type="checkbox"> ' : '<input disabled="" type="checkbox"> ')
          }
        } else {
          this.w('</li>')
          this.cr()
        }
        break
      case 'codeBlock': {
        const lang = n.info ? n.info.split(/[ \t]+/)[0] : ''
        this.cr()
        this.w(`<pre><code${lang ? ` class="language-${escapeHTML(lang)}"` : ''}>${escapeHTML(n.literal)}</code></pre>`)
        this.cr()
        break
      }
      case 'htmlBlock':
        this.cr()
        this.w(this.opts.html ? this.raw(n.literal) : `<p>${escapeHTML(n.literal)}</p>`)
        this.cr()
        break
      case 'thematicBreak':
        this.cr()
        this.w('<hr />')
        this.cr()
        break
      case 'table':
        if (entering) {
          this.cr()
          this.w('<table>\n')
        } else {
          if (n.firstChild && n.firstChild.next) this.w('</tbody>\n')
          this.w('</table>')
          this.cr()
        }
        break
      case 'tableRow':
        if (entering) {
          if (n === n.parent!.firstChild) this.w('<thead>\n')
          else if (n === n.parent!.firstChild!.next) this.w('<tbody>\n')
          this.w('<tr>\n')
        } else {
          this.w('</tr>\n')
          if (n === n.parent!.firstChild) this.w('</thead>\n')
        }
        break
      case 'tableCell': {
        const tag = n.header ? 'th' : 'td'
        this.w(entering ? `<${tag}${n.align ? ` align="${n.align}"` : ''}>` : `</${tag}>\n`)
        break
      }
      case 'text': this.w(escapeHTML(n.literal)); break
      case 'softbreak': this.w(this.opts.breaks ? '<br />\n' : '\n'); break
      case 'linebreak': this.w('<br />\n'); break
      case 'code': this.w(`<code>${escapeHTML(n.literal)}</code>`); break
      case 'htmlInline': this.w(this.raw(n.literal)); break
      case 'emph': this.w(entering ? '<em>' : '</em>'); break
      case 'strong': this.w(entering ? '<strong>' : '</strong>'); break
      case 'delete': this.w(entering ? '<del>' : '</del>'); break
      case 'link':
        this.w(entering
          ? `<a href="${this.url(n.destination)}"${n.title ? ` title="${escapeHTML(n.title)}"` : ''}>`
          : '</a>')
        break
      default: break
    }
  }
}
