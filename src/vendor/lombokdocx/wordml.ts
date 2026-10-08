// Salinan dari LombokDocx v1.1.0 (16e37bd), src/wordml.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * WordprocessingML (ECMA-376 / ISO/IEC 29500) to DocxDocument mapping (SPEC §4-§5).
 */
import { DocxError } from './errors.js'
import { childElements, decodeXmlBytes, firstChild, parseXML, textContent } from './xml.js'
import { ZipReader } from './zip.js'
import type {
  DocxAlign, DocxBlock, DocxDocument, DocxImage, DocxMetadata, DocxOptions, DocxParagraph, DocxRun,
  DocxTable, DocxTableCell, XMLElement,
} from './types.js'

/** Namespace URI to canonical prefix (transitional and strict OOXML). */
const NS: Record<string, string> = {
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
  'http://purl.oclc.org/ooxml/wordprocessingml/main': 'w',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
  'http://purl.oclc.org/ooxml/officeDocument/relationships': 'r',
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
  'http://purl.oclc.org/ooxml/drawingml/main': 'a',
  'urn:schemas-microsoft-com:vml': 'v',
  'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
  'http://schemas.openxmlformats.org/package/2006/relationships': 'rel',
  'http://schemas.openxmlformats.org/package/2006/metadata/core-properties': 'cp',
  'http://purl.org/dc/elements/1.1/': 'dc',
  'http://purl.org/dc/terms/': 'dcterms',
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties': 'ep',
  'http://purl.oclc.org/ooxml/officeDocument/extendedProperties': 'ep',
}

const REL_OFFICE_DOCUMENT = /\/officeDocument$/
const REL_STYLES = /\/styles$/
const REL_NUMBERING = /\/numbering$/
const REL_CORE = /\/metadata\/core-properties$/
const REL_APP = /\/extended-properties$/
const REL_IMAGE = /\/image$/

/** Rewrites element and attribute names to canonical prefixes by namespace URI. */
export function canonicalize(el: XMLElement, scope: Record<string, string> = {}): XMLElement {
  let local = scope
  for (const [k, v] of Object.entries(el.attributes)) {
    if (k === 'xmlns' || k.startsWith('xmlns:')) {
      if (local === scope) local = { ...scope }
      local[k === 'xmlns' ? '' : k.slice(6)] = v
    }
  }
  const rename = (q: string, isAttr: boolean): string => {
    const c = q.indexOf(':')
    if (c < 0) {
      if (isAttr) return q
      const uri = local['']
      return uri !== undefined && NS[uri] ? `${NS[uri]}:${q}` : q
    }
    const prefix = q.slice(0, c)
    if (prefix === 'xmlns' || prefix === 'xml') return q
    const uri = local[prefix]
    return uri !== undefined && NS[uri] ? `${NS[uri]}:${q.slice(c + 1)}` : q
  }
  const attributes: Record<string, string> = {}
  for (const [k, v] of Object.entries(el.attributes)) attributes[rename(k, true)] = v
  return {
    name: rename(el.name, false),
    attributes,
    children: el.children.map(c => (typeof c === 'string' ? c : canonicalize(c, local))),
  }
}

interface Rel { type: string; target: string; external: boolean }

/** Resolves a relationship target against the directory of its source part. */
export function resolvePart(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return normalizePath(target.slice(1))
  const dir = sourcePart.includes('/') ? sourcePart.slice(0, sourcePart.lastIndexOf('/') + 1) : ''
  return normalizePath(dir + target)
}

function normalizePath(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

function relsPartFor(part: string): string {
  const slash = part.lastIndexOf('/')
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp', svg: 'image/svg+xml', emf: 'image/emf', wmf: 'image/wmf',
}

export function mimeFor(name: string): string {
  const dot = name.lastIndexOf('.')
  return (dot >= 0 && MIME[name.slice(dot + 1).toLowerCase()]) || 'application/octet-stream'
}

const OFF = new Set(['0', 'false', 'off'])

function onOff(el: XMLElement | undefined): boolean | undefined {
  if (!el) return undefined
  const v = el.attributes['w:val']
  return v === undefined || !OFF.has(v.toLowerCase())
}

function val(el: XMLElement | undefined): string | undefined {
  return el?.attributes['w:val']
}

function strip(s: string): string {
  return s.replace(/^[ \t\n]+|[ \t\n]+$/g, '')
}

/** Context shared while reading one package. */
class Reader {
  rels = new Map<string, Rel>()
  styles = new Map<string, { name: string; basedOn?: string; numId?: string; ilvl?: string }>()
  numbering = new Map<string, Map<number, string>>()
  imageIds: string[] = []
  constructor(readonly opts: DocxOptions) {}

  // ---------------------------------------------------------------- body
  blocks(container: XMLElement): DocxBlock[] {
    const out: DocxBlock[] = []
    const walk = (parent: XMLElement) => {
      for (const c of childElements(parent)) {
        if (c.name === 'w:p') out.push({ type: 'paragraph', paragraph: this.paragraph(c) })
        else if (c.name === 'w:tbl') out.push({ type: 'table', table: this.table(c) })
        else if (c.name === 'w:sdt') {
          const content = firstChild(c, 'w:sdtContent')
          if (content) walk(content)
        } else if (c.name === 'w:customXml' || c.name === 'w:ins' || c.name === 'w:moveTo') walk(c)
        else if (c.name === 'mc:AlternateContent') {
          const choice = firstChild(c, 'mc:Choice') ?? firstChild(c, 'mc:Fallback')
          if (choice) walk(choice)
        }
      }
    }
    walk(container)
    return out
  }

  paragraph(p: XMLElement): DocxParagraph {
    const pPr = firstChild(p, 'w:pPr')
    const runs: DocxRun[] = []
    this.inline(p, runs, undefined)
    const merged = mergeRuns(runs)
    const para: DocxParagraph = { text: merged.map(r => r.text).join(''), runs: merged }
    const style = val(firstChild(pPr, 'w:pStyle'))
    if (style !== undefined) {
      para.style = style
      const name = this.styles.get(style)?.name ?? ''
      const m = /^heading ([1-9])$/i.exec(name) ?? (this.styles.has(style) ? null : /^heading([1-9])$/i.exec(style))
      if (m) para.heading = Number(m[1])
    }
    const numPr = firstChild(pPr, 'w:numPr')
    let numId = val(firstChild(numPr, 'w:numId'))
    let lvlRaw = val(firstChild(numPr, 'w:ilvl'))
    if (style !== undefined && (numId === undefined || lvlRaw === undefined)) {
      // Numbering inherited from the paragraph style chain (w:basedOn), at most 16 hops.
      let id: string | undefined = style
      for (let hop = 0; id !== undefined && hop < 16; hop++) {
        const st = this.styles.get(id)
        if (!st) break
        if (numId === undefined && st.numId !== undefined) numId = st.numId
        if (lvlRaw === undefined && st.ilvl !== undefined) lvlRaw = st.ilvl
        id = st.basedOn
      }
    }
    if (numId !== undefined && numId !== '0') {
      lvlRaw ??= '0'
      const level = /^[0-8]$/.test(lvlRaw) ? Number(lvlRaw) : 0
      const fmt = this.numbering.get(numId)?.get(level)
      para.list = { numId, level, ordered: fmt !== undefined && fmt !== 'bullet' && fmt !== 'none' }
    }
    const jc = val(firstChild(pPr, 'w:jc'))
    const align: DocxAlign | undefined =
      jc === 'center' ? 'center'
        : jc === 'right' || jc === 'end' ? 'right'
          : jc === 'both' || jc === 'distribute' ? 'justify'
            : jc === 'left' || jc === 'start' ? 'left' : undefined
    if (align) para.formatting = { align }
    return para
  }

  inline(parent: XMLElement, out: DocxRun[], href: string | undefined): void {
    for (const c of childElements(parent)) {
      switch (c.name) {
        case 'w:r':
          this.run(c, out, href)
          break
        case 'w:hyperlink': {
          let target: string | undefined
          const id = c.attributes['r:id']
          if (id !== undefined) {
            const rel = this.rels.get(id)
            if (rel?.external) target = rel.target
          } else if (c.attributes['w:anchor'] !== undefined) {
            target = `#${c.attributes['w:anchor']}`
          }
          this.inline(c, out, target ?? href)
          break
        }
        case 'w:ins': case 'w:moveTo': case 'w:smartTag': case 'w:customXml': case 'w:fldSimple': case 'w:dir': case 'w:bdo':
          this.inline(c, out, href)
          break
        case 'w:sdt': {
          const content = firstChild(c, 'w:sdtContent')
          if (content) this.inline(content, out, href)
          break
        }
        case 'mc:AlternateContent': {
          const choice = firstChild(c, 'mc:Choice') ?? firstChild(c, 'mc:Fallback')
          if (choice) this.inline(choice, out, href)
          break
        }
        default:
          break
      }
    }
  }

  run(r: XMLElement, out: DocxRun[], href: string | undefined): void {
    const rPr = firstChild(r, 'w:rPr')
    let text = ''
    let image: string | undefined
    for (const c of childElements(r)) {
      switch (c.name) {
        case 'w:t': text += textContent(c); break
        case 'w:tab': case 'w:ptab': text += '\t'; break
        case 'w:br': case 'w:cr': text += '\n'; break
        case 'w:noBreakHyphen': text += '‑'; break
        case 'w:softHyphen': text += '­'; break
        case 'w:drawing': case 'w:pict': case 'w:object': case 'mc:AlternateContent':
          image ??= findImageId(c)
          break
        default: break
      }
    }
    if (text === '' && image === undefined) return
    const run: DocxRun = { text }
    if (this.opts.preserveFormatting !== false && rPr) {
      if (onOff(firstChild(rPr, 'w:b'))) run.bold = true
      if (onOff(firstChild(rPr, 'w:i'))) run.italic = true
      const u = firstChild(rPr, 'w:u')
      if (u && (val(u) ?? 'single') !== 'none') run.underline = true
      if (onOff(firstChild(rPr, 'w:strike')) || onOff(firstChild(rPr, 'w:dstrike'))) run.strike = true
      const color = val(firstChild(rPr, 'w:color'))
      if (color && /^[0-9a-fA-F]{6}$/.test(color)) run.color = `#${color.toUpperCase()}`
      const sz = val(firstChild(rPr, 'w:sz'))
      if (sz && /^[0-9]+$/.test(sz) && Number(sz) > 0) run.fontSize = Number(sz) / 2
    }
    if (href !== undefined) run.href = href
    if (image !== undefined) {
      run.image = image
      if (!this.imageIds.includes(image)) this.imageIds.push(image)
    }
    out.push(run)
  }

  table(tbl: XMLElement): DocxTable {
    const rows: DocxTableCell[][] = []
    const active = new Map<number, DocxTableCell>()
    const trs: XMLElement[] = []
    const collectRows = (parent: XMLElement) => {
      for (const c of childElements(parent)) {
        if (c.name === 'w:tr') trs.push(c)
        else if (c.name === 'w:sdt') { const s = firstChild(c, 'w:sdtContent'); if (s) collectRows(s) }
        else if (c.name === 'w:customXml') collectRows(c)
      }
    }
    collectRows(tbl)
    for (const tr of trs) {
      const tcs: XMLElement[] = []
      const collectCells = (parent: XMLElement) => {
        for (const c of childElements(parent)) {
          if (c.name === 'w:tc') tcs.push(c)
          else if (c.name === 'w:sdt') { const s = firstChild(c, 'w:sdtContent'); if (s) collectCells(s) }
          else if (c.name === 'w:customXml') collectCells(c)
        }
      }
      collectCells(tr)
      const row: DocxTableCell[] = []
      let col = 0
      for (const tc of tcs) {
        const tcPr = firstChild(tc, 'w:tcPr')
        const spanRaw = val(firstChild(tcPr, 'w:gridSpan'))
        const span = spanRaw && /^[0-9]+$/.test(spanRaw) && Number(spanRaw) > 1 ? Number(spanRaw) : 1
        const vMergeEl = firstChild(tcPr, 'w:vMerge')
        const vMerge = vMergeEl ? (val(vMergeEl) ?? 'continue') : undefined
        if (vMerge === 'continue' && active.has(col)) {
          const start = active.get(col)!
          start.rowSpan = (start.rowSpan ?? 1) + 1
          col += span
          continue
        }
        const blocks = this.blocks(tc)
        const paragraphs = blocks.flatMap(b => (b.type === 'paragraph' ? [b.paragraph] : []))
        const tables = blocks.flatMap(b => (b.type === 'table' ? [b.table] : []))
        const cell: DocxTableCell = { text: blocks.map(blockText).join('\n'), paragraphs }
        if (tables.length) cell.tables = tables
        if (span > 1) cell.colSpan = span
        for (let k = col; k < col + span; k++) active.delete(k)
        if (vMerge === 'restart') active.set(col, cell)
        row.push(cell)
        col += span
      }
      rows.push(row)
    }
    const table: DocxTable = { rows: rows.map(cells => ({ cells })) }
    const tblW = firstChild(firstChild(tbl, 'w:tblPr'), 'w:tblW')
    if (tblW && tblW.attributes['w:type'] === 'dxa' && /^[0-9]+$/.test(tblW.attributes['w:w'] ?? '')) {
      table.width = Number(tblW.attributes['w:w'])
    }
    return table
  }
}

function findImageId(el: XMLElement): string | undefined {
  const stack: XMLElement[] = [el]
  while (stack.length) {
    const n = stack.shift()!
    if (n.name === 'a:blip' && n.attributes['r:embed']) return n.attributes['r:embed']
    if (n.name === 'v:imagedata' && n.attributes['r:id']) return n.attributes['r:id']
    if (n.name === 'mc:AlternateContent') {
      const choice = firstChild(n, 'mc:Choice') ?? firstChild(n, 'mc:Fallback')
      if (choice) stack.push(choice)
      continue
    }
    for (const c of childElements(n)) stack.push(c)
  }
  return undefined
}

function sameFormat(a: DocxRun, b: DocxRun): boolean {
  return a.image === undefined && b.image === undefined && a.bold === b.bold && a.italic === b.italic &&
    a.underline === b.underline && a.strike === b.strike && a.color === b.color && a.fontSize === b.fontSize &&
    a.href === b.href
}

/** Merges adjacent runs with identical formatting (SPEC §4.4). */
export function mergeRuns(runs: DocxRun[]): DocxRun[] {
  const out: DocxRun[] = []
  for (const r of runs) {
    const last = out[out.length - 1]
    if (last && sameFormat(last, r)) last.text += r.text
    else out.push({ ...r })
  }
  return out
}

export function tableText(t: DocxTable): string {
  return t.rows.map(r => r.cells.map(c => c.text).join('\t')).join('\n')
}

export function blockText(b: DocxBlock): string {
  return b.type === 'paragraph' ? b.paragraph.text : tableText(b.table)
}

/** Plain text of a document: block texts joined by LF (SPEC §6). */
export function documentToText(doc: Pick<DocxDocument, 'blocks'>): string {
  return doc.blocks.map(blockText).join('\n')
}

function readXmlPart(zip: ZipReader, name: string, opts: DocxOptions): XMLElement | undefined {
  const bytes = zip.read(name)
  if (!bytes) return undefined
  return canonicalize(parseXML(decodeXmlBytes(bytes), { maxDepth: opts.maxDepth }))
}

function readRels(zip: ZipReader, part: string, opts: DocxOptions): Map<string, Rel> {
  const map = new Map<string, Rel>()
  const root = readXmlPart(zip, relsPartFor(part), opts)
  if (!root) return map
  for (const r of childElements(root)) {
    if (r.name !== 'rel:Relationship' && r.name !== 'Relationship') continue
    const id = r.attributes['Id']
    const target = r.attributes['Target']
    if (id === undefined || target === undefined || map.has(id)) continue
    const external = r.attributes['TargetMode'] === 'External'
    map.set(id, { type: r.attributes['Type'] ?? '', target: external ? target : resolvePart(part, target), external })
  }
  return map
}

function findRel(rels: Map<string, Rel>, re: RegExp): Rel | undefined {
  for (const r of rels.values()) if (!r.external && re.test(r.type)) return r
  return undefined
}

function readMetadata(zip: ZipReader, pkgRels: Map<string, Rel>, opts: DocxOptions): DocxMetadata {
  const meta: DocxMetadata = {}
  const core = readXmlPart(zip, findRel(pkgRels, REL_CORE)?.target ?? 'docProps/core.xml', opts)
  if (core) {
    const get = (name: string) => {
      const el = firstChild(core, name)
      const v = el ? strip(textContent(el)) : ''
      return v === '' ? undefined : v
    }
    const date = (name: string) => {
      const v = get(name)
      if (!v || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(v)) return undefined
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? undefined : d
    }
    const set = <K extends keyof DocxMetadata>(k: K, v: DocxMetadata[K] | undefined) => { if (v !== undefined) meta[k] = v }
    set('title', get('dc:title'))
    set('subject', get('dc:subject'))
    set('author', get('dc:creator'))
    const kw = get('cp:keywords')
    if (kw) {
      const list = kw.split(/[,;]/).map(strip).filter(Boolean)
      if (list.length) meta.keywords = list
    }
    set('description', get('dc:description'))
    set('lastModifiedBy', get('cp:lastModifiedBy'))
    set('created', date('dcterms:created'))
    set('modified', date('dcterms:modified'))
  }
  const app = readXmlPart(zip, findRel(pkgRels, REL_APP)?.target ?? 'docProps/app.xml', opts)
  if (app) {
    const num = (name: string) => {
      const el = firstChild(app, name)
      const v = el ? strip(textContent(el)) : ''
      return /^[0-9]+$/.test(v) ? Number(v) : undefined
    }
    const pages = num('ep:Pages'); if (pages !== undefined) meta.pageCount = pages
    const words = num('ep:Words'); if (words !== undefined) meta.wordCount = words
    const chars = num('ep:Characters'); if (chars !== undefined) meta.characterCount = chars
  }
  return meta
}

/** Reads a .docx package (SPEC §4). */
export function readDocx(bytes: Uint8Array, options: DocxOptions = {}): DocxDocument {
  const zip = new ZipReader(bytes, {
    maxEntries: options.maxEntries,
    maxEntrySize: options.maxEntrySize,
    maxTotalSize: options.maxTotalSize,
  })
  const pkgRels = readRels(zip, '', options)
  const mainPart = findRel(pkgRels, REL_OFFICE_DOCUMENT)?.target ?? 'word/document.xml'
  const docRoot = readXmlPart(zip, mainPart, options)
  if (!docRoot) throw new DocxError('MISSING_PART', `main document part not found: ${mainPart}`)
  const body = firstChild(docRoot, 'w:body')
  if (docRoot.name !== 'w:document' || !body) throw new DocxError('MISSING_PART', 'main part has no w:document/w:body')

  const reader = new Reader(options)
  reader.rels = readRels(zip, mainPart, options)
  const stylesRel = findRel(reader.rels, REL_STYLES)
  const styles = stylesRel ? readXmlPart(zip, stylesRel.target, options) : undefined
  if (styles) {
    for (const s of childElements(styles, 'w:style')) {
      const id = s.attributes['w:styleId']
      if (id === undefined || reader.styles.has(id)) continue
      const numPr = firstChild(firstChild(s, 'w:pPr'), 'w:numPr')
      reader.styles.set(id, {
        name: val(firstChild(s, 'w:name')) ?? '',
        basedOn: val(firstChild(s, 'w:basedOn')),
        numId: val(firstChild(numPr, 'w:numId')),
        ilvl: val(firstChild(numPr, 'w:ilvl')),
      })
    }
  }
  const numRel = findRel(reader.rels, REL_NUMBERING)
  const numbering = numRel ? readXmlPart(zip, numRel.target, options) : undefined
  if (numbering) {
    const abstract = new Map<string, Map<number, string>>()
    for (const an of childElements(numbering, 'w:abstractNum')) {
      const levels = new Map<number, string>()
      for (const lvl of childElements(an, 'w:lvl')) {
        const ilvl = lvl.attributes['w:ilvl']
        const fmt = val(firstChild(lvl, 'w:numFmt'))
        if (ilvl !== undefined && /^[0-8]$/.test(ilvl) && fmt !== undefined) levels.set(Number(ilvl), fmt)
      }
      const id = an.attributes['w:abstractNumId']
      if (id !== undefined) abstract.set(id, levels)
    }
    for (const num of childElements(numbering, 'w:num')) {
      const id = num.attributes['w:numId']
      const aid = val(firstChild(num, 'w:abstractNumId'))
      if (id !== undefined && aid !== undefined && abstract.has(aid)) reader.numbering.set(id, abstract.get(aid)!)
    }
  }

  const blocks = reader.blocks(body)
  const images: DocxImage[] = []
  if (options.extractImages !== false) {
    for (const id of reader.imageIds) {
      const rel = reader.rels.get(id)
      if (!rel || rel.external || !REL_IMAGE.test(rel.type)) continue
      const data = zip.read(rel.target)
      if (data) images.push({ id, name: rel.target, type: mimeFor(rel.target), data })
    }
  }
  return {
    paragraphs: blocks.flatMap(b => (b.type === 'paragraph' ? [b.paragraph] : [])),
    tables: blocks.flatMap(b => (b.type === 'table' ? [b.table] : [])),
    blocks,
    images,
    metadata: options.extractMetadata === false ? {} : readMetadata(zip, pkgRels, options),
  }
}
