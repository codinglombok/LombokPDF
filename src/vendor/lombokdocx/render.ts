// Salinan dari LombokDocx v1.1.0 (16e37bd), src/render.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * DocxDocument to HTML (SPEC §6).
 */
import type { DocxBlock, DocxDocument, DocxImage, DocxParagraph, DocxRun, DocxTable, HTMLRenderOptions } from './types.js'

const SAFE_IMAGE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'])

export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64(data: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < data.length; i += 3) {
    const n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]
  }
  if (i < data.length) {
    const n = (data[i] << 16) | ((data[i + 1] ?? 0) << 8)
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < data.length ? B64[(n >> 6) & 63] : '=') + '='
  }
  return out
}

function safeHref(href: string): boolean {
  return href.startsWith('#') || /^(https?:|mailto:)/i.test(href)
}

class Renderer {
  private images = new Map<string, DocxImage>()
  constructor(doc: DocxDocument, private opts: HTMLRenderOptions) {
    for (const img of doc.images) if (!this.images.has(img.id)) this.images.set(img.id, img)
  }

  run(r: DocxRun): string {
    let h = escapeHTML(r.text).replace(/\n/g, '<br>')
    if (r.bold) h = `<strong>${h}</strong>`
    if (r.italic) h = `<em>${h}</em>`
    if (r.underline) h = `<u>${h}</u>`
    if (r.strike) h = `<s>${h}</s>`
    if (r.color && /^#[0-9A-F]{6}$/.test(r.color)) h = `<span style="color: ${r.color}">${h}</span>`
    if (r.href !== undefined && safeHref(r.href)) h = `<a href="${escapeHTML(r.href)}">${h}</a>`
    if (r.image !== undefined && this.opts.embedImages !== false) {
      const img = this.images.get(r.image)
      if (img && SAFE_IMAGE.has(img.type)) h += `<img src="data:${img.type};base64,${base64(img.data)}" alt="">`
    }
    return h
  }

  runs(p: DocxParagraph): string {
    return p.runs.map(r => this.run(r)).join('')
  }

  paragraph(p: DocxParagraph): string {
    const tag = p.heading !== undefined && p.heading >= 1 ? `h${Math.min(p.heading, 6)}` : 'p'
    const align = p.formatting?.align
    const style = align && align !== 'left' ? ` style="text-align: ${align}"` : ''
    return `<${tag}${style}>${this.runs(p)}</${tag}>\n`
  }

  table(t: DocxTable): string {
    let h = '<table>\n'
    for (const row of t.rows) {
      h += '<tr>\n'
      for (const cell of row.cells) {
        const cs = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''
        const rs = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''
        const content = cell.paragraphs
          ? cell.paragraphs.map(p => this.runs(p)).join('<br>')
          : escapeHTML(cell.text).replace(/\n/g, '<br>')
        const nested = (cell.tables ?? []).map(n => this.table(n)).join('')
        h += `<td${cs}${rs}>${content}${nested}</td>\n`
      }
      h += '</tr>\n'
    }
    return h + '</table>\n'
  }

  blocks(blocks: DocxBlock[]): string {
    let h = ''
    const stack: string[] = []
    const closeAll = () => {
      while (stack.length) h += `</li>\n</${stack.pop()}>\n`
    }
    for (const b of blocks) {
      if (b.type === 'table' || !b.paragraph.list) {
        closeAll()
        h += b.type === 'paragraph' ? this.paragraph(b.paragraph) : this.table(b.table)
        continue
      }
      const list = b.paragraph.list
      const tag = list.ordered ? 'ol' : 'ul'
      const depth = list.level + 1
      while (stack.length > depth) h += `</li>\n</${stack.pop()}>\n`
      if (stack.length === depth) {
        if (stack[depth - 1] === tag) {
          h += '</li>\n'
        } else {
          h += `</li>\n</${stack.pop()}>\n<${tag}>\n`
          stack.push(tag)
        }
      } else {
        // Levels skipped on the way down get an open <li> so every open list has one.
        while (stack.length < depth) {
          h += stack.length < depth - 1 ? `<${tag}>\n<li>` : `<${tag}>\n`
          stack.push(tag)
        }
      }
      h += `<li>${this.runs(b.paragraph)}`
    }
    closeAll()
    return h
  }
}

/** Renders a document as an HTML fragment (SPEC §6). */
export function renderHTML(doc: DocxDocument, options: HTMLRenderOptions = {}): string {
  const r = new Renderer(doc, options)
  let h = ''
  if (options.includeTitle !== false && doc.metadata.title) h += `<h1>${escapeHTML(doc.metadata.title)}</h1>\n`
  return h + r.blocks(doc.blocks)
}
