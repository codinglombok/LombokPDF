// Salinan dari LombokDocx v1.1.0 (16e37bd), src/xml.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * Non-validating XML 1.0 parser for Office Open XML parts (SPEC §3).
 * Iterative (no recursion), rejects DTDs, resolves only predefined and
 * numeric character references.
 */
import { DocxError } from './errors.js'
import type { XMLElement } from './types.js'

export interface XMLParseOptions {
  /** Maximum element nesting depth (default 256). */
  maxDepth?: number
}

const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function bad(msg: string): never {
  throw new DocxError('INVALID_XML', msg)
}

function isNameStop(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '/' || c === '>' || c === '=' || c === '<' || c === '"' || c === "'"
}

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n'
}

function decodeRefs(s: string, attr: boolean): string {
  if (s.indexOf('&') < 0 && !(attr && /[\t\n]/.test(s))) return s
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '&') {
      const end = s.indexOf(';', i)
      if (end < 0) bad('unterminated entity reference')
      const ref = s.slice(i + 1, end)
      if (ref[0] === '#') {
        const cp = ref[1] === 'x' ? (/^[0-9a-fA-F]+$/.test(ref.slice(2)) ? parseInt(ref.slice(2), 16) : NaN)
          : /^[0-9]+$/.test(ref.slice(1)) ? parseInt(ref.slice(1), 10) : NaN
        if (!(cp === 0x9 || cp === 0xa || cp === 0xd || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff))) {
          bad(`invalid character reference &${ref};`)
        }
        out += String.fromCodePoint(cp)
      } else {
        const v = PREDEFINED[ref]
        if (v === undefined) bad(`undefined entity &${ref};`)
        out += v
      }
      i = end + 1
    } else {
      out += attr && (c === '\t' || c === '\n') ? ' ' : c
      i++
    }
  }
  return out
}

/** Decodes bytes of an XML part: UTF-16 by BOM, otherwise UTF-8 (BOM removed). */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  const s = new TextDecoder('utf-8').decode(bytes)
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

/** Parses an XML document and returns its root element. */
export function parseXML(input: string, options: XMLParseOptions = {}): XMLElement {
  const maxDepth = options.maxDepth ?? 256
  const xml = input.indexOf('\r') >= 0 ? input.replace(/\r\n?/g, '\n') : input
  const n = xml.length
  const stack: XMLElement[] = []
  let root: XMLElement | undefined
  let i = xml.charCodeAt(0) === 0xfeff ? 1 : 0

  const pushText = (t: string) => {
    if (t === '') return
    const top = stack[stack.length - 1]
    if (!top) {
      if (/[^ \t\n]/.test(t)) bad('text outside the root element')
      return
    }
    const last = top.children[top.children.length - 1]
    if (typeof last === 'string') top.children[top.children.length - 1] = last + t
    else top.children.push(t)
  }

  while (i < n) {
    if (xml[i] !== '<') {
      const lt = xml.indexOf('<', i)
      const end = lt < 0 ? n : lt
      const raw = xml.slice(i, end)
      if (raw.indexOf(']]>') >= 0) bad("']]>' in text")
      pushText(decodeRefs(raw, false))
      i = end
      continue
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4)
      if (end < 0) bad('unterminated comment')
      i = end + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', i)) {
      if (!stack.length) bad('CDATA outside the root element')
      const end = xml.indexOf(']]>', i + 9)
      if (end < 0) bad('unterminated CDATA section')
      pushText(xml.slice(i + 9, end))
      i = end + 3
      continue
    }
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2)
      if (end < 0) bad('unterminated processing instruction')
      i = end + 2
      continue
    }
    if (xml.startsWith('<!', i)) bad('DTD and declarations are not allowed')
    if (xml[i + 1] === '/') {
      let j = i + 2
      while (j < n && !isNameStop(xml[j])) j++
      const name = xml.slice(i + 2, j)
      while (j < n && isSpace(xml[j])) j++
      if (xml[j] !== '>') bad(`malformed end tag </${name}`)
      const top = stack.pop()
      if (!top || top.name !== name) bad(`mismatched end tag </${name}>`)
      i = j + 1
      continue
    }
    // start tag
    let j = i + 1
    while (j < n && !isNameStop(xml[j])) j++
    const name = xml.slice(i + 1, j)
    if (name === '') bad('empty element name')
    const el: XMLElement = { name, attributes: {}, children: [] }
    let selfClosing = false
    for (;;) {
      while (j < n && isSpace(xml[j])) j++
      if (j >= n) bad(`unterminated start tag <${name}`)
      if (xml[j] === '>') {
        j++
        break
      }
      if (xml[j] === '/') {
        if (xml[j + 1] !== '>') bad(`malformed start tag <${name}`)
        selfClosing = true
        j += 2
        break
      }
      const a = j
      while (j < n && !isNameStop(xml[j])) j++
      const aname = xml.slice(a, j)
      if (aname === '') bad(`malformed attribute in <${name}`)
      while (j < n && isSpace(xml[j])) j++
      if (xml[j] !== '=') bad(`attribute without value in <${name}`)
      j++
      while (j < n && isSpace(xml[j])) j++
      const q = xml[j]
      if (q !== '"' && q !== "'") bad(`unquoted attribute value in <${name}`)
      const close = xml.indexOf(q, j + 1)
      if (close < 0) bad(`unterminated attribute value in <${name}`)
      const rawVal = xml.slice(j + 1, close)
      if (rawVal.indexOf('<') >= 0) bad(`'<' in attribute value in <${name}`)
      if (Object.prototype.hasOwnProperty.call(el.attributes, aname)) bad(`duplicate attribute ${aname} in <${name}`)
      el.attributes[aname] = decodeRefs(rawVal, true)
      j = close + 1
    }
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(el)
    else if (root) bad('more than one root element')
    else root = el
    if (!selfClosing) {
      if (stack.length >= maxDepth) throw new DocxError('LIMIT_EXCEEDED', 'XML nesting too deep')
      stack.push(el)
    }
    i = j
  }
  if (stack.length) bad(`unclosed element <${stack[stack.length - 1].name}>`)
  if (!root) bad('no root element')
  return root
}

/** Returns child elements with the given qualified name. */
export function childElements(el: XMLElement, name?: string): XMLElement[] {
  const out: XMLElement[] = []
  for (const c of el.children) if (typeof c !== 'string' && (name === undefined || c.name === name)) out.push(c)
  return out
}

export function firstChild(el: XMLElement | undefined, name: string): XMLElement | undefined {
  if (!el) return undefined
  for (const c of el.children) if (typeof c !== 'string' && c.name === name) return c
  return undefined
}

/** Concatenated text of all descendant text nodes. */
export function textContent(el: XMLElement): string {
  let out = ''
  const stack: (XMLElement | string)[] = [el]
  while (stack.length) {
    const node = stack.pop()!
    if (typeof node === 'string') out += node
    else for (let k = node.children.length - 1; k >= 0; k--) stack.push(node.children[k])
  }
  return out
}
