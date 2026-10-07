// Salinan dari LombokDocx v1.1.0 (16e37bd), src/docx.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * LombokDocx - public API: extractor, builder/writer, XML parser.
 */
import { DocxError } from './errors.js'
import { renderHTML, escapeHTML } from './render.js'
import { documentToText, readDocx } from './wordml.js'
import { parseXML } from './xml.js'
import { writeZip } from './zip.js'
import type {
  DocxAlign, DocxDocument, DocxMetadata, DocxOptions, DocxParagraph, DocxRun, HTMLRenderOptions, XMLElement,
} from './types.js'

/**
 * XML parser kept for compatibility with 1.0.0. Throws `DocxError('INVALID_XML')`
 * for malformed input or a DTD (SPEC §3).
 */
export class XMLParser {
  constructor(private xml: string, private options: { maxDepth?: number } = {}) {}

  parse(): XMLElement {
    return parseXML(this.xml, this.options)
  }
}

export type DocxSource = string | Uint8Array | ArrayBuffer

async function loadSource(source: DocxSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source
  if (source instanceof ArrayBuffer) return new Uint8Array(source)
  const fs = await import('node:fs/promises')
  return new Uint8Array(await fs.readFile(source))
}

/**
 * Reads a .docx file. `source` is a file path (Node.js, Deno, Bun) or the file bytes
 * (any runtime).
 */
export class DocxExtractor {
  private doc?: DocxDocument

  constructor(private source: DocxSource, private options: DocxOptions = {}) {}

  async extract(): Promise<DocxDocument> {
    this.doc ??= readDocx(await loadSource(this.source), this.options)
    return this.doc
  }

  /** Block texts joined by LF; table cells by TAB (SPEC §6.1). */
  async extractText(): Promise<string> {
    return documentToText(await this.extract())
  }

  async extractHTML(options?: HTMLRenderOptions): Promise<string> {
    return renderHTML(await this.extract(), options)
  }
}

export interface BuilderParagraphOptions {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** `#RRGGBB` */
  color?: string
  /** Points; written in half-points. */
  fontSize?: number
  align?: DocxAlign
  /** Heading level 1-9 (written as style `Heading<n>`). */
  heading?: number
}

function runFromOptions(text: string, f: BuilderParagraphOptions | undefined): DocxRun {
  const run: DocxRun = { text }
  if (!f) return run
  if (f.bold) run.bold = true
  if (f.italic) run.italic = true
  if (f.underline) run.underline = true
  if (f.strike) run.strike = true
  if (f.color && /^#?[0-9a-fA-F]{6}$/.test(f.color)) run.color = `#${f.color.replace('#', '').toUpperCase()}`
  if (f.fontSize !== undefined && f.fontSize > 0) run.fontSize = Math.round(f.fontSize * 2) / 2
  return run
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Characters not allowed in XML 1.0 are dropped when writing. */
function xmlText(s: string): string {
  return xmlEscape(s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, ''))
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/**
 * Builds a document in memory and writes it as HTML or as a .docx file.
 */
export class DocxBuilder {
  private doc: DocxDocument = { paragraphs: [], tables: [], blocks: [], images: [], metadata: {} }

  addParagraph(text: string, formatting?: BuilderParagraphOptions): this {
    const para: DocxParagraph = { text, runs: text === '' ? [] : [runFromOptions(text, formatting)] }
    if (formatting?.heading !== undefined && Number.isInteger(formatting.heading) && formatting.heading >= 1 && formatting.heading <= 9) {
      para.style = `Heading${formatting.heading}`
      para.heading = formatting.heading
    }
    if (formatting?.align) para.formatting = { align: formatting.align }
    this.doc.paragraphs.push(para)
    this.doc.blocks.push({ type: 'paragraph', paragraph: para })
    return this
  }

  addTable(rows: string[][]): this {
    const table = {
      rows: rows.map(row => ({
        cells: row.map(cellText => ({
          text: cellText,
          paragraphs: cellText.split('\n').map(t => ({ text: t, runs: t === '' ? [] : [{ text: t }] })),
        })),
      })),
    }
    this.doc.tables.push(table)
    this.doc.blocks.push({ type: 'table', table })
    return this
  }

  setMetadata(metadata: Partial<DocxMetadata>): this {
    this.doc.metadata = { ...this.doc.metadata, ...metadata }
    return this
  }

  build(): DocxDocument {
    return this.doc
  }

  toHTML(options?: HTMLRenderOptions): string {
    return renderHTML(this.doc, options)
  }

  toText(): string {
    return documentToText(this.doc)
  }

  /** Writes a .docx package (stored ZIP, deterministic bytes; SPEC §8). */
  toDocx(): Uint8Array {
    const usedHeadings = new Set<number>()
    const runXml = (r: DocxRun): string => {
      const props: string[] = []
      if (r.bold) props.push('<w:b/>')
      if (r.italic) props.push('<w:i/>')
      if (r.strike) props.push('<w:strike/>')
      if (r.color) props.push(`<w:color w:val="${r.color.slice(1)}"/>`)
      if (r.fontSize) props.push(`<w:sz w:val="${Math.round(r.fontSize * 2)}"/>`)
      if (r.underline) props.push('<w:u w:val="single"/>')
      const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''
      const parts = r.text.split(/(\t|\n)/).filter(s => s !== '')
      const content = parts.map(s => (s === '\t' ? '<w:tab/>' : s === '\n' ? '<w:br/>' : `<w:t xml:space="preserve">${xmlText(s)}</w:t>`)).join('')
      return `<w:r>${rPr}${content}</w:r>`
    }
    const paraXml = (p: DocxParagraph): string => {
      const pPr: string[] = []
      if (p.heading) {
        usedHeadings.add(p.heading)
        pPr.push(`<w:pStyle w:val="Heading${p.heading}"/>`)
      }
      const align = p.formatting?.align
      if (align && align !== 'left') pPr.push(`<w:jc w:val="${align === 'justify' ? 'both' : align}"/>`)
      return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${p.runs.map(runXml).join('')}</w:p>`
    }
    let body = ''
    let prevTable = false
    for (const b of this.doc.blocks) {
      // Two adjacent tables would merge into one; Word separates them with an empty paragraph.
      if (b.type === 'table' && prevTable) body += '<w:p/>'
      prevTable = b.type === 'table'
      if (b.type === 'paragraph') {
        body += paraXml(b.paragraph)
        continue
      }
      const cols = Math.max(1, ...b.table.rows.map(r => r.cells.length))
      body += '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>'
      body += '<w:gridCol/>'.repeat(cols) + '</w:tblGrid>'
      for (const row of b.table.rows) {
        body += '<w:tr>'
        for (const cell of row.cells) {
          const paras = cell.paragraphs?.length ? cell.paragraphs : [{ text: cell.text, runs: cell.text ? [{ text: cell.text }] : [] }]
          body += `<w:tc>${paras.map(paraXml).join('')}</w:tc>`
        }
        body += '</w:tr>'
      }
      body += '</w:tbl>'
    }
    const document = `${XML_DECL}<w:document xmlns:w="${W_NS}"><w:body>${body}<w:sectPr/></w:body></w:document>`
    const headingStyles = [...usedHeadings].sort((a, b) => a - b).map(n =>
      `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/>` +
      `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="${n - 1}"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="${Math.max(24, 36 - (n - 1) * 4)}"/></w:rPr></w:style>`).join('')
    const styles = `${XML_DECL}<w:styles xmlns:w="${W_NS}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal">` +
      `<w:name w:val="Normal"/><w:qFormat/></w:style>${headingStyles}</w:styles>`

    const m = this.doc.metadata
    const coreFields: string[] = []
    if (m.title) coreFields.push(`<dc:title>${xmlText(m.title)}</dc:title>`)
    if (m.subject) coreFields.push(`<dc:subject>${xmlText(m.subject)}</dc:subject>`)
    if (m.author) coreFields.push(`<dc:creator>${xmlText(m.author)}</dc:creator>`)
    if (m.keywords?.length) coreFields.push(`<cp:keywords>${xmlText(m.keywords.join(', '))}</cp:keywords>`)
    if (m.description) coreFields.push(`<dc:description>${xmlText(m.description)}</dc:description>`)
    if (m.lastModifiedBy) coreFields.push(`<cp:lastModifiedBy>${xmlText(m.lastModifiedBy)}</cp:lastModifiedBy>`)
    const w3c = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')
    if (m.created && !Number.isNaN(m.created.getTime())) coreFields.push(`<dcterms:created xsi:type="dcterms:W3CDTF">${w3c(m.created)}</dcterms:created>`)
    if (m.modified && !Number.isNaN(m.modified.getTime())) coreFields.push(`<dcterms:modified xsi:type="dcterms:W3CDTF">${w3c(m.modified)}</dcterms:modified>`)
    const core = `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${coreFields.join('')}</cp:coreProperties>`

    const contentTypes = `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>'
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    const pkgRels = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>'
    const docRels = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/></Relationships>`

    return writeZip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: pkgRels },
      { name: 'word/document.xml', data: document },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml', data: styles },
      { name: 'docProps/core.xml', data: core },
    ])
  }
}

export { DocxError, escapeHTML }
