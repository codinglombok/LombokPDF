// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/blocks.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * Block parser: CommonMark 0.31.2 §4-§5 (appendix "A parsing strategy") plus GFM
 * tables and task list items.
 */
import { CLOSETAG, OPENTAG, isSpaceOrTab, trimBlank, trimEndBlank, unescapeString } from './common.js'
import { InlineParser, type RefMap } from './inlines.js'
import { type Align, type ListData, MdNode, type NodeType, walk } from './node.js'

const CODE_INDENT = 4

const reHtmlBlockOpen: RegExp[] = [
  /./,
  /^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
  /^<!--/,
  /^<[?]/,
  /^<![A-Za-z]/,
  /^<!\[CDATA\[/,
  /^<[/]?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[123456]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|[/]?[>]|$)/i,
  new RegExp('^(?:' + OPENTAG + '|' + CLOSETAG + ')\\s*$', 'i'),
]
/** End conditions of HTML block types 1-5 (CommonMark 0.31.2 §4.6); types 2-5 are fixed strings. */
const reHtmlBlockType1Close = /<\/(?:script|pre|textarea|style)>/i
function htmlBlockEnds(type: number, line: string): boolean {
  switch (type) {
    case 1: return reHtmlBlockType1Close.test(line)
    case 2: return line.includes('-->')
    case 3: return line.includes('?>')
    case 4: return line.includes('>')
    case 5: return line.includes(']]>')
    default: return false
  }
}
const reThematicBreak = /^(?:\*[ \t]*){3,}$|^(?:_[ \t]*){3,}$|^(?:-[ \t]*){3,}$/
const reMaybeSpecial = /^[#`~*+_=<>0-9-|:]/
const reNonSpace = /[^ \t\f\v\r\n]/
const reBulletListMarker = /^[*+-]/
const reOrderedListMarker = /^(\d{1,9})([.)])/
const reATXHeadingMarker = /^#{1,6}(?:[ \t]+|$)/
const reCodeFence = /^`{3,}(?!.*`)|^~{3,}/
const reClosingCodeFence = /^(?:`{3,}|~{3,})(?=[ \t]*$)/
const reSetextHeadingLine = /^(?:=+|-+)[ \t]*$/
const reLineEnding = /\r\n|\n|\r/
const reTaskMarker = /^\[([ xX])\](?=[ \t]|$)/
// Characters a delimiter row may contain; the cell structure is validated after splitting.
const reTableDelimChars = /^[|:\- \t]+$/

export interface BlockOptions {
  gfm: boolean
}

/** Splits a GFM table row into raw cell strings (unescaped pipes split cells). */
export function splitTableRow(line: string): string[] {
  let s = trimBlank(line)
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (c === '|') {
      cells.push(trimBlank(cur))
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(trimBlank(cur))
  return cells
}

function delimAlign(cell: string): Align {
  const l = cell.startsWith(':')
  const r = cell.endsWith(':')
  return l && r ? 'center' : l ? 'left' : r ? 'right' : null
}

/** True when the block, or the last item/child of a nested list, ends with a blank line. */
function endsWithBlankLine(block: MdNode | null): boolean {
  while (block) {
    if (block.lastLineBlank) return true
    if (block.type === 'list' || block.type === 'item') block = block.lastChild
    else break
  }
  return false
}

export class BlockParser {
  doc = new MdNode('document')
  private tip: MdNode = this.doc
  private oldtip: MdNode = this.doc
  private currentLine = ''
  private lineNumber = 0
  private offset = 0
  private column = 0
  private nextNonspace = 0
  private nextNonspaceColumn = 0
  private indent = 0
  private indented = false
  private blank = false
  private partiallyConsumedTab = false
  private allClosed = true
  private lastMatchedContainer: MdNode = this.doc
  refmap: RefMap = new Map()
  private inline: InlineParser

  constructor(private options: BlockOptions) {
    this.inline = new InlineParser(this.refmap, { gfm: options.gfm })
  }

  parse(input: string): MdNode {
    this.doc = new MdNode('document')
    this.doc.startLine = 1
    this.tip = this.doc
    this.refmap.clear()
    this.lineNumber = 0
    this.lastMatchedContainer = this.doc
    const lines = input.split(reLineEnding)
    let len = lines.length
    if (input.length > 0 && /(?:\r\n|\n|\r)$/.test(input)) len -= 1
    for (let i = 0; i < len; i++) this.incorporateLine(lines[i])
    while (this.tip) {
      const parent = this.tip.parent
      this.finalize(this.tip)
      if (!parent) break
      this.tip = parent
    }
    this.processInlines(this.doc)
    return this.doc
  }

  // ---------------------------------------------------------------- helpers
  /** Cache of the last whitespace scan on this line (tab-free runs only). */
  private scanFrom = -1
  private scanTo = -1

  private findNextNonspace(): void {
    const ln = this.currentLine
    if (this.offset >= this.scanFrom && this.offset <= this.scanTo && !this.partiallyConsumedTab) {
      // the run [scanFrom, scanTo) holds only spaces, so the result follows directly
      this.nextNonspace = this.scanTo
      this.nextNonspaceColumn = this.column + (this.scanTo - this.offset)
      const c = ln.charAt(this.scanTo)
      this.blank = c === '\n' || c === '\r' || c === ''
      this.indent = this.nextNonspaceColumn - this.column
      this.indented = this.indent >= CODE_INDENT
      return
    }
    let i = this.offset
    let cols = this.column
    let sawTab = false
    let c: string
    while ((c = ln.charAt(i)) !== '') {
      if (c === ' ') {
        i++
        cols++
      } else if (c === '\t') {
        i++
        cols += 4 - (cols % 4)
        sawTab = true
      } else break
    }
    if (!sawTab) {
      this.scanFrom = this.offset
      this.scanTo = i
    } else {
      this.scanFrom = this.scanTo = -1
    }
    this.blank = c === '\n' || c === '\r' || c === ''
    this.nextNonspace = i
    this.nextNonspaceColumn = cols
    this.indent = this.nextNonspaceColumn - this.column
    this.indented = this.indent >= CODE_INDENT
  }

  private advanceNextNonspace(): void {
    this.offset = this.nextNonspace
    this.column = this.nextNonspaceColumn
    this.partiallyConsumedTab = false
  }

  private advanceOffset(count: number, columns: boolean): void {
    const ln = this.currentLine
    let c: string
    while (count > 0 && (c = ln[this.offset]) !== undefined) {
      if (c === '\t') {
        const charsToTab = 4 - (this.column % 4)
        if (columns) {
          this.partiallyConsumedTab = charsToTab > count
          const charsToAdvance = charsToTab > count ? count : charsToTab
          this.column += charsToAdvance
          this.offset += this.partiallyConsumedTab ? 0 : 1
          count -= charsToAdvance
        } else {
          this.partiallyConsumedTab = false
          this.column += charsToTab
          this.offset += 1
          count -= 1
        }
      } else {
        this.partiallyConsumedTab = false
        this.offset += 1
        this.column += 1
        count -= 1
      }
    }
  }

  private addLine(): void {
    if (this.partiallyConsumedTab) {
      this.offset += 1
      const charsToTab = 4 - (this.column % 4)
      this.tip.content += ' '.repeat(charsToTab)
    }
    this.tip.content += this.currentLine.slice(this.offset) + '\n'
  }

  private canContain(parent: NodeType, child: NodeType): boolean {
    switch (parent) {
      case 'document': case 'blockquote': return child !== 'item'
      case 'list': return child === 'item'
      case 'item': return child !== 'item'
      default: return false
    }
  }

  private addChild(type: NodeType): MdNode {
    while (!this.canContain(this.tip.type, type)) this.finalize(this.tip)
    const node = new MdNode(type)
    node.startLine = this.lineNumber
    this.tip.append(node)
    this.tip = node
    return node
  }

  private closeUnmatchedBlocks(): void {
    if (!this.allClosed) {
      while (this.oldtip !== this.lastMatchedContainer) {
        const parent = this.oldtip.parent!
        this.finalize(this.oldtip)
        this.oldtip = parent
      }
      this.allClosed = true
    }
  }

  // ---------------------------------------------------------------- continue
  /** 0 = matched, 1 = not matched, 2 = line consumed (closing fence). */
  private continueBlock(c: MdNode): 0 | 1 | 2 {
    const ln = this.currentLine
    switch (c.type) {
      case 'document': case 'list': return 0
      case 'blockquote':
        if (!this.indented && ln[this.nextNonspace] === '>') {
          this.advanceNextNonspace()
          this.advanceOffset(1, false)
          if (isSpaceOrTab(ln[this.offset])) this.advanceOffset(1, true)
          return 0
        }
        return 1
      case 'item':
        if (this.blank) {
          if (c.firstChild === null) return 1
          this.advanceNextNonspace()
        } else if (this.indent >= c.listData!.markerOffset + c.listData!.padding) {
          this.advanceOffset(c.listData!.markerOffset + c.listData!.padding, true)
        } else {
          return 1
        }
        return 0
      case 'heading': case 'thematicBreak': return 1
      case 'codeBlock': {
        if (c.fenced) {
          const match = this.indent <= 3 && ln[this.nextNonspace] === c.fenceChar && reClosingCodeFence.exec(ln.slice(this.nextNonspace))
          if (match && match[0].length >= c.fenceLength) {
            this.finalize(c)
            return 2
          }
          let i = c.fenceOffset
          while (i > 0 && isSpaceOrTab(ln[this.offset])) {
            this.advanceOffset(1, true)
            i--
          }
        } else if (this.indent >= CODE_INDENT) {
          this.advanceOffset(CODE_INDENT, true)
        } else if (this.blank) {
          this.advanceNextNonspace()
        } else {
          return 1
        }
        return 0
      }
      case 'htmlBlock':
        return this.blank && (c.htmlBlockType === 6 || c.htmlBlockType === 7) ? 1 : 0
      case 'paragraph':
        return this.blank ? 1 : 0
      case 'table':
        return this.blank ? 1 : 0
      default:
        return 1
    }
  }

  private acceptsLines(t: NodeType): boolean {
    return t === 'paragraph' || t === 'codeBlock' || t === 'htmlBlock'
  }

  // ---------------------------------------------------------------- finalize
  private finalize(block: MdNode): void {
    const above = block.parent
    block.open = false
    switch (block.type) {
      case 'paragraph': {
        let pos: number
        let hasRef = false
        while (block.content[0] === '[' && (pos = this.inline.parseReference(block.content, this.refmap))) {
          block.content = block.content.slice(pos)
          hasRef = true
        }
        if (hasRef && !reNonSpace.test(block.content)) block.unlink()
        break
      }
      case 'codeBlock':
        if (block.fenced) {
          const content = block.content
          const nl = content.indexOf('\n')
          const first = content.slice(0, nl)
          block.info = unescapeString(first.trim())
          block.literal = content.slice(nl + 1)
        } else {
          block.literal = trimTrailingBlankLines(block.content)
        }
        block.content = ''
        break
      case 'htmlBlock':
        block.literal = block.content.replace(/\n$/, '')
        block.content = ''
        break
      case 'list': {
        let tight = true
        let item = block.firstChild
        while (item) {
          if (endsWithBlankLine(item) && item.next) {
            tight = false
            break
          }
          let sub = item.firstChild
          while (sub) {
            if (endsWithBlankLine(sub) && (item.next || sub.next)) {
              tight = false
              break
            }
            sub = sub.next
          }
          if (!tight) break
          item = item.next
        }
        block.listData!.tight = tight
        break
      }
      default:
        break
    }
    this.tip = above ?? this.doc
  }

  // ---------------------------------------------------------------- block starts
  private parseListMarker(container: MdNode): ListData | null {
    if (this.indent >= 4) return null
    // a marker is at most 10 characters, so a short window avoids copying long lines
    const rest = this.currentLine.slice(this.nextNonspace, this.nextNonspace + 12)
    let data: ListData
    let markerLen: number
    let m: RegExpExecArray | null
    if ((m = reBulletListMarker.exec(rest))) {
      data = { type: 'bullet', tight: true, bulletChar: m[0][0], markerOffset: this.indent, padding: 0 }
      markerLen = m[0].length
    } else if ((m = reOrderedListMarker.exec(rest)) && (container.type !== 'paragraph' || m[1] === '1')) {
      data = { type: 'ordered', tight: true, start: parseInt(m[1], 10), delimiter: m[2] as '.' | ')', markerOffset: this.indent, padding: 0 }
      markerLen = m[0].length
    } else {
      return null
    }
    const nextc = this.currentLine[this.nextNonspace + markerLen]
    if (!(nextc === undefined || nextc === '\t' || nextc === ' ')) return null
    if (container.type === 'paragraph' && !reNonSpace.test(this.currentLine.slice(this.nextNonspace + markerLen))) return null
    this.advanceNextNonspace()
    this.advanceOffset(markerLen, true)
    const spacesStartCol = this.column
    const spacesStartOffset = this.offset
    do {
      this.advanceOffset(1, true)
    } while (this.column - spacesStartCol < 5 && isSpaceOrTab(this.currentLine[this.offset]))
    const blankItem = this.currentLine[this.offset] === undefined
    const spacesAfterMarker = this.column - spacesStartCol
    if (spacesAfterMarker >= 5 || spacesAfterMarker < 1 || blankItem) {
      data.padding = markerLen + 1
      this.column = spacesStartCol
      this.offset = spacesStartOffset
      if (isSpaceOrTab(this.currentLine[this.offset])) this.advanceOffset(1, true)
    } else {
      data.padding = markerLen + spacesAfterMarker
    }
    return data
  }

  /** 0 = no match, 1 = matched container start, 2 = matched leaf start. */
  private tryStarts(container: MdNode): 0 | 1 | 2 {
    const ln = this.currentLine
    const c0 = ln[this.nextNonspace]
    let restCache: string | undefined
    const rest = (): string => (restCache ??= ln.slice(this.nextNonspace))
    // block quote
    if (!this.indented && c0 === '>') {
      this.advanceNextNonspace()
      this.advanceOffset(1, false)
      if (isSpaceOrTab(ln[this.offset])) this.advanceOffset(1, true)
      this.closeUnmatchedBlocks()
      this.addChild('blockquote')
      return 1
    }
    // ATX heading
    let m: RegExpExecArray | null
    if (!this.indented && c0 === '#' && (m = reATXHeadingMarker.exec(rest()))) {
      this.advanceNextNonspace()
      this.advanceOffset(m[0].length, false)
      this.closeUnmatchedBlocks()
      const h = this.addChild('heading')
      h.level = m[0].trim().length
      h.content = stripClosingSequence(ln.slice(this.offset))
      this.advanceOffset(ln.length - this.offset, false)
      return 2
    }
    // fenced code
    if (!this.indented && (c0 === '`' || c0 === '~') && (m = reCodeFence.exec(rest()))) {
      const fenceLength = m[0].length
      this.closeUnmatchedBlocks()
      const cb = this.addChild('codeBlock')
      cb.fenced = true
      cb.fenceLength = fenceLength
      cb.fenceChar = m[0][0]
      cb.fenceOffset = this.indent
      this.advanceNextNonspace()
      this.advanceOffset(fenceLength, false)
      return 2
    }
    // HTML block
    if (!this.indented && c0 === '<') {
      for (let t = 1; t <= 7; t++) {
        if (reHtmlBlockOpen[t].test(rest()) && (t < 7 || (container.type !== 'paragraph' && !(!this.allClosed && !this.blank && this.tip.type === 'paragraph')))) {
          this.closeUnmatchedBlocks()
          const b = this.addChild('htmlBlock')
          b.htmlBlockType = t
          return 2
        }
      }
    }
    // GFM table (header = last paragraph line, this line = delimiter row)
    if (this.options.gfm && !this.indented && container.type === 'paragraph' && rest().includes('|') && rest().includes('-') && reTableDelimChars.test(rest())) {
      const lines = container.content.replace(/\n$/, '').split('\n')
      const headerLine = lines[lines.length - 1]
      const header = splitTableRow(headerLine)
      const delims = splitTableRow(rest())
      if (header.length === delims.length && delims.every(d => /^:?-+:?$/.test(d))) {
        this.closeUnmatchedBlocks()
        const parent = container.parent!
        const table = new MdNode('table')
        table.startLine = this.lineNumber
        table.aligns = delims.map(delimAlign)
        table.rawRows.push(header)
        if (lines.length > 1) {
          container.content = lines.slice(0, -1).join('\n') + '\n'
          this.finalize(container)
          parent.append(table)
        } else {
          container.insertAfter(table)
          container.unlink()
        }
        table.parent = parent
        this.tip = table
        this.advanceOffset(ln.length - this.offset, false)
        return 2
      }
    }
    // setext heading
    if (!this.indented && container.type === 'paragraph' && (c0 === '=' || c0 === '-') && (m = reSetextHeadingLine.exec(rest()))) {
      this.closeUnmatchedBlocks()
      let pos: number
      while (container.content[0] === '[' && (pos = this.inline.parseReference(container.content, this.refmap))) {
        container.content = container.content.slice(pos)
      }
      if (container.content.length > 0) {
        const heading = new MdNode('heading')
        heading.startLine = container.startLine
        heading.level = m[0][0] === '=' ? 1 : 2
        heading.content = container.content
        container.insertAfter(heading)
        container.unlink()
        this.tip = heading
        this.advanceOffset(ln.length - this.offset, false)
        return 2
      }
    }
    // thematic break
    if (!this.indented && (c0 === '*' || c0 === '-' || c0 === '_') && maybeThematicBreak(ln, this.nextNonspace) && reThematicBreak.test(rest())) {
      this.closeUnmatchedBlocks()
      this.addChild('thematicBreak')
      this.advanceOffset(ln.length - this.offset, false)
      return 2
    }
    // list item
    if (!this.indented || container.type === 'list') {
      const data = this.parseListMarker(container)
      if (data) {
        this.closeUnmatchedBlocks()
        const tip = this.tip
        if (tip.type !== 'list' || !listsMatch(tip.listData!, data)) {
          const list = this.addChild('list')
          list.listData = data
        }
        const item = this.addChild('item')
        item.listData = data
        if (this.options.gfm) {
          const tm = reTaskMarker.exec(this.currentLine.slice(this.offset))
          if (tm && reNonSpace.test(this.currentLine.slice(this.offset + 3))) {
            item.checked = tm[1] !== ' '
            this.advanceOffset(3, false)
            if (isSpaceOrTab(this.currentLine[this.offset])) this.advanceOffset(1, true)
          }
        }
        return 1
      }
    }
    // indented code
    if (this.indented && this.tip.type !== 'paragraph' && !this.blank) {
      this.advanceOffset(CODE_INDENT, true)
      this.closeUnmatchedBlocks()
      this.addChild('codeBlock')
      return 2
    }
    return 0
  }

  // ---------------------------------------------------------------- main loop
  private incorporateLine(input: string): void {
    let container: MdNode = this.doc
    this.oldtip = this.tip
    this.offset = 0
    this.column = 0
    this.blank = false
    this.partiallyConsumedTab = false
    this.lineNumber += 1
    const ln = input.includes('\u0000') ? input.replace(/\0/g, '\ufffd') : input
    this.currentLine = ln
    this.scanFrom = this.scanTo = -1

    let lastChild: MdNode | null
    while ((lastChild = container.lastChild) && lastChild.open) {
      container = lastChild
      this.findNextNonspace()
      const r = this.continueBlock(container)
      if (r === 2) return
      if (r === 1) {
        container = container.parent!
        break
      }
    }
    this.allClosed = container === this.oldtip
    this.lastMatchedContainer = container
    let matchedLeaf = container.type !== 'paragraph' && this.acceptsLines(container.type)

    while (!matchedLeaf) {
      this.findNextNonspace()
      if (!this.indented && !reMaybeSpecial.test(ln[this.nextNonspace] ?? '')) {
        this.advanceNextNonspace()
        break
      }
      const r = this.tryStarts(container)
      if (r === 0) {
        this.advanceNextNonspace()
        break
      }
      container = this.tip
      if (r === 2) matchedLeaf = true
    }

    if (!this.allClosed && !this.blank && this.tip.type === 'paragraph') {
      this.addLine()
    } else {
      this.closeUnmatchedBlocks()
      if (this.blank && container.lastChild) container.lastChild.lastLineBlank = true
      const t = container.type
      const lastLineBlank = this.blank &&
        !(t === 'blockquote' || (t === 'codeBlock' && container.fenced) || (t === 'item' && !container.firstChild && container.startLine === this.lineNumber))
      let cont: MdNode | null = container
      while (cont) {
        cont.lastLineBlank = lastLineBlank
        cont = cont.parent
      }
      if (this.acceptsLines(t)) {
        this.addLine()
        if (t === 'htmlBlock' && htmlBlockEnds(container.htmlBlockType, ln.slice(this.offset))) {
          this.finalize(container)
        }
      } else if (t === 'table' && !this.blank) {
        // the delimiter row itself leaves nothing after the offset
        if (this.offset < ln.length) container.rawRows.push(splitTableRow(ln.slice(this.offset)))
      } else if (this.offset < ln.length && !this.blank) {
        this.addChild('paragraph')
        this.advanceNextNonspace()
        this.addLine()
      }
    }
  }

  // ---------------------------------------------------------------- inlines
  private processInlines(root: MdNode): void {
    const targets: MdNode[] = []
    for (const { node, entering } of walk(root)) {
      if (entering && (node.type === 'paragraph' || node.type === 'heading' || node.type === 'table')) targets.push(node)
    }
    for (const n of targets) {
      if (n.type !== 'table') {
        this.inline.parse(n)
        continue
      }
      const width = n.aligns.length
      n.rawRows.forEach((cells, r) => {
        const row = n.append(new MdNode('tableRow'))
        row.header = r === 0
        for (let i = 0; i < width; i++) {
          const cell = row.append(new MdNode('tableCell'))
          cell.header = r === 0
          cell.align = n.aligns[i]
          this.inline.parse(cell, cells[i] ?? '')
        }
      })
      n.rawRows = []
    }
  }
}

/** Cheap pre-check: the first three non-blank characters are the same marker. */
function maybeThematicBreak(ln: string, start: number): boolean {
  const c = ln[start]
  let count = 0
  for (let i = start; i < ln.length && count < 3; i++) {
    const ch = ln[i]
    if (ch === c) count++
    else if (ch !== ' ' && ch !== '\t') return false
  }
  return count >= 3
}

/** Removes an optional ATX closing sequence (CommonMark 0.31.2 §4.2) in linear time. */
function stripClosingSequence(s: string): string {
  let end = s.length
  while (end > 0 && (s[end - 1] === ' ' || s[end - 1] === '\t')) end--
  let j = end
  while (j > 0 && s[j - 1] === '#') j--
  if (j === end) return s
  const k = trimEndBlank(s.slice(0, j)).length
  if (k === 0) return ''
  return j > 0 && (s[j - 1] === ' ' || s[j - 1] === '\t') ? s.slice(0, k) : s
}

/** Indented code: drop trailing lines made of spaces, keep one final LF (linear time). */
function trimTrailingBlankLines(content: string): string {
  let end = content.length
  let cut = -1
  for (let i = end - 1; i >= 0; i--) {
    const c = content[i]
    if (c === '\n') cut = i
    else if (c !== ' ') break
  }
  return cut >= 0 ? content.slice(0, cut) + '\n' : content
}

function listsMatch(a: ListData, b: ListData): boolean {
  return a.type === b.type && a.delimiter === b.delimiter && a.bulletChar === b.bulletChar
}
