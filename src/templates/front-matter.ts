/**
 * LombokPDF — front matter and a safe YAML 1.2 subset.
 *
 * Interim module: in the ecosystem map (docs/map_LombokPDF_v1.0.0.md, section 4)
 * front matter splitting belongs in LombokMarkDown and YAML in LombokSerde. This
 * file has no LombokPDF imports so it can move there unchanged, with its tests.
 *
 * Supported YAML (enough for template front matter and config-style data):
 * - block mappings and block sequences (indentation with spaces), `- key: value` items
 * - flow sequences and mappings on one line: `[a, "b", 3]`, `{ k: v, n: [1, 2] }`
 * - plain, single-quoted and double-quoted scalars (escapes \\ \" \/ \0 \a \b \t \n \v \f \r \e \xXX \uXXXX \UXXXXXXXX)
 * - literal `|` and folded `>` block scalars with `-` / `+` chomping
 * - core schema resolution: null (`~`, `null`, empty), booleans (`true`/`false`),
 *   integers (decimal, `0x`, `0o`), floats (incl. `.inf`, `.nan`); everything else is a string
 * - `#` comments
 *
 * Rejected with {@link YamlError} instead of guessed: anchors and aliases (`&`, `*`),
 * tags (`!`), directives (`%`), multi-line flow collections, tabs in indentation,
 * duplicate keys, nesting deeper than {@link MAX_YAML_DEPTH}, input larger than
 * {@link MAX_YAML_BYTES}. Mappings are created without a prototype, so keys like
 * `__proto__` are plain data.
 */

export type YamlValue = null | boolean | number | string | YamlValue[] | { [key: string]: YamlValue }

export const MAX_YAML_DEPTH = 64
export const MAX_YAML_BYTES = 1 << 20

export class YamlError extends Error {
  /** 1-based line number in the YAML text (0 when not tied to a line). */
  readonly line: number
  constructor(message: string, line: number) {
    super(line > 0 ? `${message} (line ${line})` : message)
    this.name = 'YamlError'
    this.line = line
  }
}

export interface FrontMatter {
  /** Parsed front matter; an empty object when the source has none. */
  data: { [key: string]: YamlValue }
  /** The source without the front matter block. */
  content: string
  /** True when a front matter block was found. */
  present: boolean
}

/**
 * Split `---` YAML front matter from the start of `source` and parse it.
 * The block starts with a line `---` on the first line (after an optional BOM)
 * and ends at the next line that is `---` or `...`.
 */
export function parseFrontMatter(source: string): FrontMatter {
  const text = source.startsWith('﻿') ? source.slice(1) : source
  const open = /^---[ \t]*\r?\n/.exec(text)
  if (!open) return { data: Object.create(null) as { [key: string]: YamlValue }, content: source, present: false }

  const rest = text.slice(open[0].length)
  const close = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(rest)
  if (!close) throw new YamlError('front matter is not closed with ---', 0)

  const yaml = rest.slice(0, close.index)
  const content = rest.slice(close.index + close[0].length)
  const value = parseYaml(yaml)
  if (value === null) return { data: Object.create(null) as { [key: string]: YamlValue }, content, present: true }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new YamlError('front matter must be a mapping', 1)
  }
  return { data: value, content, present: true }
}

// ─── YAML parser ─────────────────────────────────────────────────────────────

interface Line {
  /** 1-based line number */
  no: number
  indent: number
  /** content after indentation, comments removed, trailing spaces trimmed */
  text: string
}

/** Parse a YAML document (subset described at the top of this file). */
export function parseYaml(input: string): YamlValue {
  if (input.length > MAX_YAML_BYTES) throw new YamlError(`input larger than ${MAX_YAML_BYTES} characters`, 0)
  const parser = new Parser(input.replace(/\r\n?/g, '\n').split('\n'))
  const first = parser.peek()
  if (!first) return null
  if (first.indent !== 0) throw new YamlError('document must start at column 1', first.no)
  const value = parser.block(0, 0)
  const extra = parser.peek()
  if (extra) throw new YamlError('unexpected indentation', extra.no)
  return value
}

class Parser {
  private pos = 0
  private readonly raw: string[]

  constructor(raw: string[]) {
    this.raw = raw
  }

  /** Next non-blank, non-comment line without consuming it. */
  peek(): Line | undefined {
    while (this.pos < this.raw.length) {
      const raw = this.raw[this.pos]!
      const no = this.pos + 1
      const indentMatch = /^[ \t]*/.exec(raw)![0]
      if (indentMatch.includes('\t') && raw.trim() !== '') throw new YamlError('tabs are not allowed in indentation', no)
      const text = stripComment(raw.slice(indentMatch.length), no).trimEnd()
      if (text === '') { this.pos++; continue }
      if (indentMatch.length === 0 && text.startsWith('%')) throw new YamlError('directives are not supported', no)
      if (indentMatch.length === 0 && (text === '---' || text === '...')) throw new YamlError('multiple documents are not supported', no)
      return { no, indent: indentMatch.length, text }
    }
    return undefined
  }

  private next(): Line {
    const line = this.peek()!
    this.pos++
    return line
  }

  /** Parse the block node whose lines start at column `indent`. */
  block(indent: number, depth: number): YamlValue {
    if (depth > MAX_YAML_DEPTH) throw new YamlError(`nesting deeper than ${MAX_YAML_DEPTH}`, this.peek()?.no ?? 0)
    const line = this.peek()!
    if (isSeqItem(line.text)) return this.sequence(indent, depth)
    if (findMappingColon(line.text, line.no) >= 0) return this.mapping(indent, depth)
    // A lone scalar or flow collection as the whole node
    this.next()
    const after = this.peek()
    if (after && after.indent >= indent) throw new YamlError('multi-line plain scalars are not supported', after.no)
    return inlineValue(line.text, line.no, depth)
  }

  private mapping(indent: number, depth: number): YamlValue {
    const out = Object.create(null) as { [key: string]: YamlValue }
    for (let line = this.peek(); line && line.indent === indent; line = this.peek()) {
      if (isSeqItem(line.text)) throw new YamlError('sequence item where a mapping key was expected', line.no)
      const colon = findMappingColon(line.text, line.no)
      if (colon < 0) throw new YamlError('expected "key: value"', line.no)
      this.next()
      const key = keyText(line.text.slice(0, colon).trim(), line.no)
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new YamlError(`duplicate key "${key}"`, line.no)
      out[key] = this.valueAfterIndicator(line.text.slice(colon + 1).trim(), indent, line.no, depth, true)
    }
    const stray = this.peek()
    if (stray && stray.indent > indent) throw new YamlError('unexpected indentation', stray.no)
    return out
  }

  private sequence(indent: number, depth: number): YamlValue {
    const out: YamlValue[] = []
    for (let line = this.peek(); line && line.indent === indent && isSeqItem(line.text); line = this.peek()) {
      const content = line.text.slice(1).trimStart()
      const offset = line.text.length - content.length
      if (content !== '' && (isSeqItem(content) || findMappingColon(content, line.no) >= 0)) {
        // "- key: value" or "- - x": the item is a block node starting inside this line
        this.raw[this.pos] = ' '.repeat(indent + offset) + content
        out.push(this.block(indent + offset, depth + 1))
      } else {
        this.next()
        out.push(this.valueAfterIndicator(content, indent, line.no, depth, false))
      }
    }
    const stray = this.peek()
    if (stray && stray.indent > indent) throw new YamlError('unexpected indentation', stray.no)
    return out
  }

  /** Value after "key:" or "-": inline text, block scalar, nested block, or null. */
  private valueAfterIndicator(rest: string, indent: number, no: number, depth: number, inMapping: boolean): YamlValue {
    if (/^[|>]/.test(rest)) return this.blockScalar(rest, indent, no)
    if (rest !== '') return inlineValue(rest, no, depth + 1)
    const next = this.peek()
    if (next && next.indent > indent) return this.block(next.indent, depth + 1)
    // "key:" followed by a sequence at the same indentation is a common YAML style
    if (inMapping && next && next.indent === indent && isSeqItem(next.text)) return this.sequence(indent, depth + 1)
    return null
  }

  private blockScalar(header: string, parentIndent: number, no: number): string {
    const m = /^([|>])([+-]?)$/.exec(header)
    if (!m) throw new YamlError(`unsupported block scalar header "${header}"`, no)
    const folded = m[1] === '>'
    const chomp = m[2]

    const lines: string[] = []
    let contentIndent = -1
    while (this.pos < this.raw.length) {
      const raw = this.raw[this.pos]!
      if (raw.trim() === '') { lines.push(''); this.pos++; continue }
      const ind = /^ */.exec(raw)![0].length
      if (ind <= parentIndent) break
      if (contentIndent < 0) contentIndent = ind
      if (ind < contentIndent) throw new YamlError('block scalar line is less indented than its first line', this.pos + 1)
      lines.push(raw.slice(contentIndent))
      this.pos++
    }

    let trailing = 0
    while (lines.length > 0 && lines[lines.length - 1] === '') { lines.pop(); trailing++ }

    let body: string
    if (!folded) {
      body = lines.join('\n')
    } else {
      body = ''
      for (let i = 0; i < lines.length; i++) {
        const cur = lines[i]!
        if (i > 0) {
          const prev = lines[i - 1]!
          const moreIndented = cur.startsWith(' ') || prev.startsWith(' ')
          body += cur === '' || prev === '' || moreIndented ? '\n' : ' '
        }
        body += cur
      }
      body = body.replace(/\n\n/g, '\n')
    }

    if (lines.length === 0) return chomp === '+' ? '\n'.repeat(trailing) : ''
    if (chomp === '-') return body
    if (chomp === '+') return body + '\n' + '\n'.repeat(trailing)
    return body + '\n'
  }
}

function isSeqItem(text: string): boolean {
  return text === '-' || text.startsWith('- ')
}

/** Remove a `#` comment that is outside quotes and starts the line or follows whitespace. */
function stripComment(text: string, no: number): string {
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quote === '"') {
      if (c === '\\') i++
      else if (c === '"') quote = ''
    } else if (quote === "'") {
      if (c === "'") {
        if (text[i + 1] === "'") i++
        else quote = ''
      }
    } else if (c === '#' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\t')) {
      return text.slice(0, i)
    } else if ((c === '"' || c === "'") && (i === 0 || /[\s[{,:-]/.test(text[i - 1]!))) {
      quote = c
    }
  }
  if (quote) throw new YamlError('unterminated quoted string', no)
  return text
}

/** Index of the ":" that separates a mapping key from its value, or -1. */
function findMappingColon(text: string, no: number): number {
  if (text.startsWith('[') || text.startsWith('{')) return -1
  let i = 0
  if (text.startsWith('"') || text.startsWith("'")) {
    i = endOfQuoted(text, 0, no)
    const after = text.slice(i).trimStart()
    return after.startsWith(':') && (after.length === 1 || /\s/.test(after[1]!)) ? text.length - after.length : -1
  }
  for (; i < text.length; i++) {
    if (text[i] === ':' && (i + 1 === text.length || text[i + 1] === ' ')) return i
  }
  return -1
}

function keyText(raw: string, no: number): string {
  if (raw === '') throw new YamlError('empty mapping key', no)
  if (raw.startsWith('"') || raw.startsWith("'")) {
    const end = endOfQuoted(raw, 0, no)
    if (end !== raw.length) throw new YamlError('unexpected text after quoted key', no)
    return unquote(raw, no)
  }
  if (/^[&*!%@`?|>]/.test(raw)) throw new YamlError(`unsupported key syntax "${raw}"`, no)
  return raw
}

/** Index just after the closing quote of the quoted scalar starting at `start`. */
function endOfQuoted(text: string, start: number, no: number): number {
  const q = text[start]
  for (let i = start + 1; i < text.length; i++) {
    if (q === '"' && text[i] === '\\') { i++; continue }
    if (text[i] === q) {
      if (q === "'" && text[i + 1] === "'") { i++; continue }
      return i + 1
    }
  }
  throw new YamlError('unterminated quoted string', no)
}

const ESCAPES: Record<string, string> = {
  '0': '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b',
  ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: ' ', L: ' ', P: ' ',
}

function unquote(token: string, no: number): string {
  const body = token.slice(1, -1)
  if (token[0] === "'") return body.replace(/''/g, "'")
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!
    if (c !== '\\') { out += c; continue }
    const e = body[++i]
    if (e === undefined) throw new YamlError('dangling escape in string', no)
    const width = e === 'x' ? 2 : e === 'u' ? 4 : e === 'U' ? 8 : 0
    if (width > 0) {
      const hex = body.slice(i + 1, i + 1 + width)
      if (!new RegExp(`^[0-9A-Fa-f]{${width}}$`).test(hex)) throw new YamlError(`invalid \\${e} escape`, no)
      const cp = parseInt(hex, 16)
      if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new YamlError(`invalid code point \\${e}${hex}`, no)
      out += String.fromCodePoint(cp)
      i += width
      continue
    }
    const mapped = ESCAPES[e]
    if (mapped === undefined) throw new YamlError(`unknown escape \\${e}`, no)
    out += mapped
  }
  return out
}

/** Value written on one line: quoted scalar, flow collection, or plain scalar. */
function inlineValue(text: string, no: number, depth: number): YamlValue {
  if (text.startsWith('[') || text.startsWith('{')) {
    const flow = new FlowParser(text, no)
    const value = flow.value(depth)
    flow.end()
    return value
  }
  if (text.startsWith('"') || text.startsWith("'")) {
    const end = endOfQuoted(text, 0, no)
    if (text.slice(end).trim() !== '') throw new YamlError('unexpected text after quoted string', no)
    return unquote(text, no)
  }
  return plainScalar(text, no)
}

function plainScalar(text: string, no: number): YamlValue {
  if (/^[&*]/.test(text)) throw new YamlError('anchors and aliases are not supported', no)
  if (text.startsWith('!')) throw new YamlError('tags are not supported', no)
  if (/^[@`]/.test(text)) throw new YamlError(`plain scalar cannot start with "${text[0]}"`, no)
  if (/^(?:~|null|Null|NULL)$/.test(text)) return null
  if (/^(?:true|True|TRUE)$/.test(text)) return true
  if (/^(?:false|False|FALSE)$/.test(text)) return false
  if (/^[-+]?[0-9]+$/.test(text)) return Number(text)
  if (/^0o[0-7]+$/.test(text)) return parseInt(text.slice(2), 8)
  if (/^0x[0-9a-fA-F]+$/.test(text)) return parseInt(text.slice(2), 16)
  if (/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/.test(text)) return Number(text)
  if (/^[-+]?\.(?:inf|Inf|INF)$/.test(text)) return text.startsWith('-') ? -Infinity : Infinity
  if (/^\.(?:nan|NaN|NAN)$/.test(text)) return NaN
  return text
}

class FlowParser {
  private i = 0
  private readonly s: string
  private readonly no: number

  constructor(s: string, no: number) {
    this.s = s
    this.no = no
  }

  private ws(): void {
    while (this.s[this.i] === ' ') this.i++
  }

  end(): void {
    this.ws()
    if (this.i !== this.s.length) throw new YamlError('unexpected text after flow collection', this.no)
  }

  value(depth: number): YamlValue {
    if (depth > MAX_YAML_DEPTH) throw new YamlError(`nesting deeper than ${MAX_YAML_DEPTH}`, this.no)
    this.ws()
    const c = this.s[this.i]
    if (c === undefined) throw new YamlError('flow collections must be on one line', this.no)
    if (c === '[') return this.seq(depth)
    if (c === '{') return this.map(depth)
    return this.scalar()
  }

  private scalar(): YamlValue {
    const c = this.s[this.i]
    if (c === '"' || c === "'") {
      const end = endOfQuoted(this.s, this.i, this.no)
      const v = unquote(this.s.slice(this.i, end), this.no)
      this.i = end
      return v
    }
    const start = this.i
    while (this.i < this.s.length && !/[,\]}]/.test(this.s[this.i]!) &&
      !(this.s[this.i] === ':' && /[\s,\]}]|^$/.test(this.s[this.i + 1] ?? ''))) this.i++
    const text = this.s.slice(start, this.i).trim()
    return text === '' ? null : plainScalar(text, this.no)
  }

  private seq(depth: number): YamlValue[] {
    this.i++
    const out: YamlValue[] = []
    this.ws()
    if (this.s[this.i] === ']') { this.i++; return out }
    for (;;) {
      out.push(this.value(depth + 1))
      this.ws()
      const c = this.s[this.i++]
      if (c === ']') return out
      if (c !== ',') throw new YamlError('expected "," or "]" in flow sequence', this.no)
      this.ws()
      if (this.s[this.i] === ']') { this.i++; return out }
    }
  }

  private map(depth: number): { [key: string]: YamlValue } {
    this.i++
    const out = Object.create(null) as { [key: string]: YamlValue }
    this.ws()
    if (this.s[this.i] === '}') { this.i++; return out }
    for (;;) {
      this.ws()
      const k = this.scalar()
      if (k === null || typeof k === 'object') throw new YamlError('invalid key in flow mapping', this.no)
      const key = String(k)
      this.ws()
      let v: YamlValue = null
      if (this.s[this.i] === ':') {
        this.i++
        this.ws()
        v = this.s[this.i] === ',' || this.s[this.i] === '}' ? null : this.value(depth + 1)
      }
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new YamlError(`duplicate key "${key}"`, this.no)
      out[key] = v
      this.ws()
      const c = this.s[this.i++]
      if (c === '}') return out
      if (c !== ',') throw new YamlError('expected "," or "}" in flow mapping', this.no)
      this.ws()
      if (this.s[this.i] === '}') { this.i++; return out }
    }
  }
}
