// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/inlines.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * Inline parser: CommonMark 0.31.2 §6 plus GFM strikethrough and extended autolinks.
 */
import {
  ESCAPABLE, decodeEntity, normalizeReference, normalizeURI, reEntityHere, reHtmlTag, trimBlank, trimEndSpaces,
  unescapeString,
} from './common.js'
import { MdNode, text, walk } from './node.js'

export interface RefDef {
  destination: string
  title: string
}

export type RefMap = Map<string, RefDef>

interface Delimiter {
  cc: string
  numdelims: number
  origdelims: number
  node: MdNode
  previous: Delimiter | null
  next: Delimiter | null
  canOpen: boolean
  canClose: boolean
}

interface Bracket {
  node: MdNode
  previous: Bracket | null
  previousDelimiter: Delimiter | null
  index: number
  image: boolean
  active: boolean
  bracketAfter: boolean
}

const reEscapable = new RegExp('^' + ESCAPABLE)
const reLinkTitle = new RegExp(
  '^(?:"(' + '\\\\' + ESCAPABLE + '|\\\\[^\\\\]' + '|[^\\\\"\\x00])*"' +
  '|' + "'(" + '\\\\' + ESCAPABLE + "|\\\\[^\\\\]" + "|[^\\\\'\\x00])*'" +
  '|' + '\\((' + '\\\\' + ESCAPABLE + '|\\\\[^\\\\]' + '|[^\\\\()\\x00])*\\))',
)
const reLinkDestinationBraces = /^(?:<(?:[^<>\n\\\x00]|\\.)*>)/
const reSpnl = /^ *(?:\n *)?/
const reWhitespaceChar = /^[ \t\n\x0b\x0c\x0d]/
const reUnicodeWhitespaceChar = /^[\t\n\f\r\p{Zs}]/u
const rePunctuation = /^[\p{P}\p{S}]/u
const reInitialSpace = /^ */
const reEmailAutolink = /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/
const reAutolink = /^<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\x00-\x20]*>/i
const reMain = /^[^\n`[\]\\!<&*_~]+/
const reTicks = /`+/g
const reTicksHere = /^`+/
/** Nesting limit for parentheses in link destinations (CommonMark 0.31.2 §6.3 allows a limit). */
const MAX_PARENS = 32

export interface InlineOptions {
  gfm: boolean
}

export class InlineParser {
  private subject = ''
  private pos = 0
  private delimiters: Delimiter | null = null
  private brackets: Bracket | null = null
  /** Positions of backtick runs by length, built once per subject (avoids quadratic scans). */
  private tickRuns: Map<number, number[]> | null = null

  constructor(public refmap: RefMap, private options: InlineOptions) {}

  private peek(): string | undefined {
    return this.pos < this.subject.length ? this.subject[this.pos] : undefined
  }

  private match(re: RegExp): string | null {
    const m = re.exec(this.subject.slice(this.pos))
    if (!m) return null
    this.pos += m.index + m[0].length
    return m[0]
  }

  private spnl(): boolean {
    this.match(reSpnl)
    return true
  }

  /** Parses `block.content` into inline children of `block`. */
  parse(block: MdNode, source = block.content): void {
    this.subject = trimBlank(source, true)
    this.terminators = null
    this.pos = 0
    this.delimiters = null
    this.brackets = null
    this.tickRuns = null
    while (this.parseInline(block));
    block.content = ''
    this.processEmphasis(null)
    if (this.options.gfm) extendedAutolinks(block)
  }

  private parseInline(block: MdNode): boolean {
    const c = this.peek()
    if (c === undefined) return false
    let res = false
    switch (c) {
      case '\n': res = this.parseNewline(block); break
      case '\\': res = this.parseBackslash(block); break
      case '`': res = this.parseBackticks(block); break
      case '*': case '_': res = this.handleDelim(c, block); break
      case '~': res = this.options.gfm ? this.handleDelim(c, block) : false; break
      case '[': res = this.parseOpenBracket(block); break
      case '!': res = this.parseBang(block); break
      case ']': res = this.parseCloseBracket(block); break
      case '<': res = this.parseAutolink(block) || this.parseHtmlTag(block); break
      case '&': res = this.parseEntity(block); break
      default: res = this.parseString(block)
    }
    if (!res) {
      this.pos += 1
      block.append(text(c))
    }
    return true
  }

  private parseNewline(block: MdNode): boolean {
    this.pos += 1
    const last = block.lastChild
    if (last && last.type === 'text' && last.literal.endsWith(' ')) {
      const hard = last.literal.length >= 2 && last.literal[last.literal.length - 2] === ' '
      last.literal = trimEndSpaces(last.literal)
      block.append(new MdNode(hard ? 'linebreak' : 'softbreak'))
    } else {
      block.append(new MdNode('softbreak'))
    }
    this.match(reInitialSpace)
    return true
  }

  private parseBackslash(block: MdNode): boolean {
    this.pos += 1
    const c = this.peek()
    if (c === '\n') {
      this.pos += 1
      block.append(new MdNode('linebreak'))
    } else if (c !== undefined && reEscapable.test(c)) {
      block.append(text(c))
      this.pos += 1
    } else {
      block.append(text('\\'))
    }
    return true
  }

  private parseBackticks(block: MdNode): boolean {
    const ticks = this.match(reTicksHere)
    if (!ticks) return false
    const afterOpen = this.pos
    if (!this.tickRuns) {
      this.tickRuns = new Map()
      reTicks.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = reTicks.exec(this.subject))) {
        const list = this.tickRuns.get(m[0].length) ?? []
        list.push(m.index)
        this.tickRuns.set(m[0].length, list)
      }
    }
    const runs = this.tickRuns.get(ticks.length) ?? []
    // first run of the same length that starts after the opener (binary search)
    let lo = 0
    let hi = runs.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (runs[mid] < afterOpen) lo = mid + 1
      else hi = mid
    }
    if (lo < runs.length) {
      const closeAt = runs[lo]
      let contents = this.subject.slice(afterOpen, closeAt).replace(/\n/g, ' ')
      if (contents.length > 0 && /[^ ]/.test(contents) && contents[0] === ' ' && contents[contents.length - 1] === ' ') {
        contents = contents.slice(1, -1)
      }
      const node = new MdNode('code')
      node.literal = contents
      block.append(node)
      this.pos = closeAt + ticks.length
      return true
    }
    this.pos = afterOpen
    block.append(text(ticks))
    return true
  }

  private charBefore(): string {
    if (this.pos === 0) return '\n'
    const code = this.subject.charCodeAt(this.pos - 1)
    if (code >= 0xdc00 && code <= 0xdfff && this.pos >= 2) {
      const hi = this.subject.charCodeAt(this.pos - 2)
      if (hi >= 0xd800 && hi <= 0xdbff) return this.subject.slice(this.pos - 2, this.pos)
    }
    return this.subject[this.pos - 1]
  }

  private scanDelims(cc: string): { numdelims: number; canOpen: boolean; canClose: boolean } | null {
    const startpos = this.pos
    const before = this.charBefore()
    let numdelims = 0
    while (this.peek() === cc) {
      numdelims++
      this.pos++
    }
    if (numdelims === 0) return null
    const after = this.pos < this.subject.length ? String.fromCodePoint(this.subject.codePointAt(this.pos)!) : '\n'
    const afterWs = reUnicodeWhitespaceChar.test(after)
    const afterPunct = rePunctuation.test(after)
    const beforeWs = reUnicodeWhitespaceChar.test(before)
    const beforePunct = rePunctuation.test(before)
    const left = !afterWs && (!afterPunct || beforeWs || beforePunct)
    const right = !beforeWs && (!beforePunct || afterWs || afterPunct)
    let canOpen: boolean
    let canClose: boolean
    if (cc === '_') {
      canOpen = left && (!right || beforePunct)
      canClose = right && (!left || afterPunct)
    } else {
      canOpen = left
      canClose = right
    }
    this.pos = startpos
    return { numdelims, canOpen, canClose }
  }

  private handleDelim(cc: string, block: MdNode): boolean {
    const res = this.scanDelims(cc)
    if (!res) return false
    const startpos = this.pos
    this.pos += res.numdelims
    const node = text(this.subject.slice(startpos, this.pos))
    block.append(node)
    if ((res.canOpen || res.canClose) && !(cc === '~' && res.numdelims > 2)) {
      this.delimiters = {
        cc, numdelims: res.numdelims, origdelims: res.numdelims, node, previous: this.delimiters, next: null,
        canOpen: res.canOpen, canClose: res.canClose,
      }
      if (this.delimiters.previous) this.delimiters.previous.next = this.delimiters
    }
    return true
  }

  private removeDelimiter(d: Delimiter): void {
    if (d.previous) d.previous.next = d.next
    if (d.next) d.next.previous = d.previous
    else this.delimiters = d.previous
  }

  private processEmphasis(stackBottom: Delimiter | null): void {
    const openersBottom: Record<string, Delimiter | null> = {}
    let closer = this.delimiters
    while (closer && closer.previous !== stackBottom) closer = closer.previous
    while (closer) {
      const cc = closer.cc
      if (!closer.canClose) {
        closer = closer.next
        continue
      }
      const key = cc === '~' ? `~${closer.numdelims}` : `${cc}${closer.canOpen ? 1 : 0}${closer.origdelims % 3}`
      let opener = closer.previous
      let found = false
      const bottom = openersBottom[key] ?? stackBottom
      while (opener && opener !== stackBottom && opener !== bottom) {
        let odd = false
        if (cc !== '~') {
          odd = (closer.canOpen || opener.canClose) && closer.origdelims % 3 !== 0 &&
            (opener.origdelims + closer.origdelims) % 3 === 0
        }
        const sameTilde = cc !== '~' || opener.numdelims === closer.numdelims
        if (opener.cc === cc && opener.canOpen && !odd && sameTilde) {
          found = true
          break
        }
        opener = opener.previous
      }
      const oldCloser = closer
      if (found && opener) {
        let use: number
        let type: 'emph' | 'strong' | 'delete'
        if (cc === '~') {
          use = closer.numdelims
          type = 'delete'
        } else {
          use = closer.numdelims >= 2 && opener.numdelims >= 2 ? 2 : 1
          type = use === 2 ? 'strong' : 'emph'
        }
        const openerInl = opener.node
        const closerInl = closer.node
        opener.numdelims -= use
        closer.numdelims -= use
        openerInl.literal = openerInl.literal.slice(0, openerInl.literal.length - use)
        closerInl.literal = closerInl.literal.slice(0, closerInl.literal.length - use)
        const emph = new MdNode(type)
        let tmp = openerInl.next
        while (tmp && tmp !== closerInl) {
          const next = tmp.next
          emph.append(tmp)
          tmp = next
        }
        openerInl.insertAfter(emph)
        // remove delimiters between opener and closer
        let d = closer.previous
        while (d && d !== opener) {
          const prev = d.previous
          this.removeDelimiter(d)
          d = prev
        }
        if (opener.numdelims === 0) {
          openerInl.unlink()
          this.removeDelimiter(opener)
        }
        if (closer.numdelims === 0) {
          closerInl.unlink()
          const next = closer.next
          this.removeDelimiter(closer)
          closer = next
        }
      } else {
        closer = closer.next
      }
      if (!found) {
        openersBottom[key] = oldCloser.previous
        if (!oldCloser.canOpen) this.removeDelimiter(oldCloser)
      }
    }
    while (this.delimiters && this.delimiters !== stackBottom) this.removeDelimiter(this.delimiters)
  }

  private parseLinkTitle(): string | null {
    const title = this.match(reLinkTitle)
    if (title === null) return null
    return unescapeString(title.slice(1, -1))
  }

  private parseLinkDestination(): string | null {
    let res = this.match(reLinkDestinationBraces)
    if (res !== null) return normalizeURI(unescapeString(res.slice(1, -1)))
    if (this.peek() === '<') return null
    const savepos = this.pos
    let openparens = 0
    let c: string | undefined
    while ((c = this.peek()) !== undefined) {
      if (c === '\\' && this.pos + 1 < this.subject.length && reEscapable.test(this.subject[this.pos + 1])) {
        this.pos += 2
      } else if (c === '(') {
        this.pos += 1
        openparens += 1
        if (openparens > MAX_PARENS) return null
      } else if (c === ')') {
        if (openparens < 1) break
        this.pos += 1
        openparens -= 1
      } else if (/[\x00-\x20\x7f]/.test(c)) {
        break
      } else {
        this.pos += 1
      }
    }
    if (this.pos === savepos && c !== ')') return null
    if (openparens !== 0) return null
    res = this.subject.slice(savepos, this.pos)
    return normalizeURI(unescapeString(res))
  }

  /** Returns the length of a link label at the current position, or 0. */
  parseLinkLabel(): number {
    if (this.peek() !== '[') return 0
    let i = this.pos + 1
    while (i < this.subject.length) {
      const c = this.subject[i]
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '[') return 0
      if (c === ']') {
        const len = i - this.pos + 1
        if (len > 1001) return 0
        this.pos = i + 1
        return len
      }
      i++
    }
    return 0
  }

  private parseOpenBracket(block: MdNode): boolean {
    const startpos = this.pos
    this.pos += 1
    const node = text('[')
    block.append(node)
    this.addBracket(node, startpos, false)
    return true
  }

  private parseBang(block: MdNode): boolean {
    const startpos = this.pos
    this.pos += 1
    if (this.peek() === '[') {
      this.pos += 1
      const node = text('![')
      block.append(node)
      this.addBracket(node, startpos + 1, true)
    } else {
      block.append(text('!'))
    }
    return true
  }

  private addBracket(node: MdNode, index: number, image: boolean): void {
    if (this.brackets) this.brackets.bracketAfter = true
    this.brackets = { node, previous: this.brackets, previousDelimiter: this.delimiters, index, image, active: true, bracketAfter: false }
  }

  private removeBracket(): void {
    if (this.brackets) this.brackets = this.brackets.previous
  }

  private parseCloseBracket(block: MdNode): boolean {
    const startpos = this.pos
    this.pos += 1
    const opener = this.brackets
    if (!opener) {
      block.append(text(']'))
      return true
    }
    if (!opener.active) {
      block.append(text(']'))
      this.removeBracket()
      return true
    }
    const isImage = opener.image
    const savepos = this.pos
    let dest: string | null = null
    let title: string | null = null
    let matched = false
    if (this.peek() === '(') {
      this.pos++
      if (this.spnl() && (dest = this.parseLinkDestination()) !== null && this.spnl()) {
        if (reWhitespaceChar.test(this.subject[this.pos - 1] ?? '')) title = this.parseLinkTitle()
        if (this.spnl() && this.peek() === ')') {
          this.pos += 1
          matched = true
        }
      }
      if (!matched) this.pos = savepos
    }
    if (!matched) {
      const beforeLabel = this.pos
      const n = this.parseLinkLabel()
      let reflabel: string | undefined
      if (n > 2) reflabel = this.subject.slice(beforeLabel, beforeLabel + n)
      else if (!opener.bracketAfter) reflabel = this.subject.slice(opener.index, startpos + 1)
      if (n === 0) this.pos = savepos
      if (reflabel) {
        const link = this.refmap.get(normalizeReference(reflabel))
        if (link) {
          dest = link.destination
          title = link.title
          matched = true
        }
      }
    }
    if (matched) {
      const node = new MdNode(isImage ? 'image' : 'link')
      node.destination = dest ?? ''
      node.title = title ?? ''
      let tmp = opener.node.next
      while (tmp) {
        const next = tmp.next
        node.append(tmp)
        tmp = next
      }
      block.append(node)
      this.processEmphasis(opener.previousDelimiter)
      this.removeBracket()
      opener.node.unlink()
      if (!isImage) {
        let o = this.brackets
        while (o) {
          if (!o.image) o.active = false
          o = o.previous
        }
      }
      return true
    }
    this.removeBracket()
    this.pos = startpos + 1
    block.append(text(']'))
    return true
  }

  private parseAutolink(block: MdNode): boolean {
    let m: string | null
    if ((m = this.match(reEmailAutolink))) {
      const dest = m.slice(1, -1)
      const node = new MdNode('link')
      node.destination = normalizeURI('mailto:' + dest)
      node.append(text(dest))
      block.append(node)
      return true
    }
    if ((m = this.match(reAutolink))) {
      const dest = m.slice(1, -1)
      const node = new MdNode('link')
      node.destination = normalizeURI(dest)
      node.append(text(dest))
      block.append(node)
      return true
    }
    return false
  }

  /** Last positions of HTML terminators in the subject, so unclosed constructs fail in O(1). */
  private terminators: { comment: number; pi: number; cdata: number; gt: number } | null = null

  private parseHtmlTag(block: MdNode): boolean {
    const t = (this.terminators ??= {
      comment: this.subject.lastIndexOf('-->'),
      pi: this.subject.lastIndexOf('?>'),
      cdata: this.subject.lastIndexOf(']]>'),
      gt: this.subject.lastIndexOf('>'),
    })
    const p = this.pos
    if (t.gt < p) return false
    if (this.subject.startsWith('<!--', p) && t.comment < p + 2) return false
    if (this.subject.startsWith('<?', p) && t.pi < p + 2) return false
    if (this.subject.startsWith('<![CDATA[', p) && t.cdata < p + 9) return false
    const m = this.match(reHtmlTag)
    if (m === null) return false
    const node = new MdNode('htmlInline')
    node.literal = m
    block.append(node)
    return true
  }

  private parseEntity(block: MdNode): boolean {
    const m = this.match(reEntityHere)
    if (!m) return false
    const decoded = decodeEntity(m)
    block.append(text(decoded))
    return true
  }

  private parseString(block: MdNode): boolean {
    const m = this.match(reMain)
    if (m === null) return false
    block.append(text(m))
    return true
  }

  /** Parses a link reference definition at the start of `s`; returns characters consumed (0 if none). */
  parseReference(s: string, refmap: RefMap): number {
    this.subject = s
    this.pos = 0
    const startpos = this.pos
    const matchChars = this.parseLinkLabel()
    if (matchChars === 0) return 0
    const rawlabel = this.subject.slice(0, matchChars)
    if (this.peek() === ':') this.pos++
    else {
      this.pos = startpos
      return 0
    }
    this.spnl()
    const dest = this.parseLinkDestination()
    if (dest === null) {
      this.pos = startpos
      return 0
    }
    const beforetitle = this.pos
    this.spnl()
    let title: string | null = null
    if (this.pos !== beforetitle) title = this.parseLinkTitle()
    if (title === null) {
      title = ''
      this.pos = beforetitle
    }
    let atLineEnd = true
    if (this.match(/^ *(?:\n|$)/) === null) {
      if (title === '') atLineEnd = false
      else {
        title = ''
        this.pos = beforetitle
        atLineEnd = this.match(/^ *(?:\n|$)/) !== null
      }
    }
    if (!atLineEnd) {
      this.pos = startpos
      return 0
    }
    const normlabel = normalizeReference(rawlabel)
    if (normlabel === '') {
      this.pos = startpos
      return 0
    }
    if (!refmap.has(normlabel)) refmap.set(normlabel, { destination: dest, title })
    return this.pos - startpos
  }
}

// --- GFM extended autolinks (www., http(s)://, email) -----------------------

const reExtAuto = /(?:^|(?<=[\s*_~(]))(?:(https?:\/\/|ftp:\/\/|www\.)([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)([^\s<]*)|([A-Za-z0-9._+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+))/g

function trimAutolinkTail(path: string): string {
  // Trailing punctuation is not part of the link.
  let p = path
  for (;;) {
    const before = p
    let e = p.length
    while (e > 0 && '?!.,:*_~'.includes(p[e - 1])) e--
    p = p.slice(0, e)
    if (p.endsWith(')')) {
      const open = (p.match(/\(/g) ?? []).length
      const close = (p.match(/\)/g) ?? []).length
      if (close > open) p = p.slice(0, -1)
    }
    const ent = /&[A-Za-z0-9]+;$/.exec(p)
    if (ent) p = p.slice(0, ent.index)
    if (p === before) return p
  }
}

function linkifyText(node: MdNode): void {
  const s = node.literal
  reExtAuto.lastIndex = 0
  const parts: MdNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = reExtAuto.exec(s))) {
    let raw: string
    let href: string
    if (m[4] !== undefined) {
      raw = m[4]
      if (/[-_]$/.test(raw)) continue
      if (raw.endsWith('.')) raw = raw.slice(0, -1)
      href = 'mailto:' + raw
    } else {
      const domain = m[2]
      const segs = domain.split('.')
      if (m[1] === 'www.' ? segs.length < 1 : segs.length < 1) continue
      if (segs.slice(-2).some(seg => seg.includes('_'))) continue
      raw = m[1] + domain + trimAutolinkTail(m[3])
      if (m[1] === 'www.' && domain === '') continue
      href = m[1] === 'www.' ? 'http://' + raw : raw
    }
    if (m.index > last) parts.push(text(s.slice(last, m.index)))
    const link = new MdNode('link')
    link.destination = normalizeURI(href)
    link.append(text(raw))
    parts.push(link)
    last = m.index + raw.length
    reExtAuto.lastIndex = last
  }
  if (!parts.length) return
  if (last < s.length) parts.push(text(s.slice(last)))
  for (const p of parts) node.insertBefore(p)
  node.unlink()
}

function extendedAutolinks(block: MdNode): void {
  const texts: MdNode[] = []
  let skip: MdNode | null = null
  for (const { node, entering } of walk(block)) {
    if (skip) {
      if (node === skip && !entering) skip = null
      continue
    }
    if (entering && (node.type === 'link' || node.type === 'image')) {
      skip = node
      continue
    }
    if (entering && node.type === 'text') texts.push(node)
  }
  // merge runs of adjacent text nodes, then linkify each run
  for (const t of texts) {
    if (!t.parent) continue
    while (t.next && t.next.type === 'text') {
      t.literal += t.next.literal
      t.next.unlink()
    }
  }
  for (const t of texts) if (t.parent) linkifyText(t)
}
