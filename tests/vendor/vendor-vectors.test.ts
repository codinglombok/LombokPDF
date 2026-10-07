/**
 * Menjalankan vector milik library asal terhadap salinan di src/vendor/
 * (docs/map_LombokPDF_v1.0.0.md bagian 3, butir 2). Logika runner mengikuti
 * runner TypeScript di repo asal; berkas vector disalin apa adanya
 * (SHA-256 tercatat di src/vendor/MANIFEST.json).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import * as H from '../../src/vendor/lombokhtml/index.js'
import { Markdown, type MarkdownOptions } from '../../src/vendor/lombokmarkdown/index.js'
import * as X from '../../src/vendor/lombokdocx/index.js'
import { App, ArgType, ParseError, type Matches } from '../../src/vendor/lombokcliparse/index.js'

const load = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./vectors/${name}`, import.meta.url), 'utf8')) as T

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().map(k => [k, (val as Record<string, unknown>)[k]]))
      : val)
}

// ─── LombokHTML ──────────────────────────────────────────────────────────────

describe('salinan LombokHTML 0.2.0', () => {
  const doc = load<{ cases: { id: string; kind: string; input: Record<string, any>; expected: unknown }[] }>(
    'lombokhtml-vectors-v1.json')

  const tokenJson = (t: H.Token): unknown => {
    switch (t.type) {
      case 'StartTag': return ['StartTag', t.name, t.attrs, t.selfClosing]
      case 'EndTag': return ['EndTag', t.name]
      case 'DOCTYPE': return ['DOCTYPE', t.name, t.publicId, t.systemId, t.correct]
      default: return [t.type, t.data]
    }
  }

  const policy = (p: { tags?: string[]; attrs?: [string, string][]; schemes?: string[] } | undefined): H.Policy => {
    const out = new H.Policy()
    for (const t of p?.tags ?? []) out.allowTag(t)
    for (const [t, a] of p?.attrs ?? []) out.allowAttr(t, a)
    for (const s of p?.schemes ?? []) out.allowScheme(s)
    return out
  }

  const run = (kind: string, i: Record<string, any>): unknown => {
    switch (kind) {
      case 'decode': return H.decodeEntities(i['text'])
      case 'escapeText': return H.escapeText(i['text'])
      case 'escapeAttr': return H.escapeAttr(i['text'])
      case 'tokenize': return H.tokenize(i['html']).map(tokenJson)
      case 'parse': return H.parse(i['html']).serialize()
      case 'textContent': return H.stripTags(i['html'])
      case 'extractText': return H.htmlToText(i['html'])
      case 'sanitize': {
        const p = policy(i['policy'])
        const out = H.sanitize(i['html'], p)
        expect(H.sanitize(out, p)).toBe(out)
        return out
      }
      case 'safeUrl': return i['schemes'] ? H.isSafeUrl(i['url'], i['schemes']) : H.isSafeUrl(i['url'])
      case 'query': return H.parse(i['html']).query(i['selector']).map(e => e.serialize())
      case 'meta': return H.parse(i['html']).meta()
      case 'tables': return H.parse(i['html']).tables()
      default: throw new Error(kind)
    }
  }

  it('memuat minimal 100 kasus', () => expect(doc.cases.length).toBeGreaterThanOrEqual(100))
  for (const c of doc.cases) {
    it(c.id, () => {
      let got: unknown
      try {
        got = { ok: run(c.kind, c.input) }
      } catch (e) {
        if (!(e instanceof H.SelectorError)) throw e
        got = { error: e.code }
      }
      expect(got).toEqual(c.expected)
    })
  }
})

// ─── LombokMarkDown ──────────────────────────────────────────────────────────

describe('salinan LombokMarkDown 2.0.0', () => {
  const doc = load<{ cases: { id: string; fn: string; input: string; options?: MarkdownOptions; expected: unknown }[] }>(
    'lombokmarkdown-vectors-v1.json')

  it('memuat minimal 100 kasus', () => expect(doc.cases.length).toBeGreaterThanOrEqual(100))
  for (const c of doc.cases) {
    it(c.id, () => {
      const md = new Markdown(c.input, c.options)
      const got = c.fn === 'html' ? md.getHTML()
        : c.fn === 'metadata' ? md.getMetadata()
        : c.fn === 'toc' ? md.getTableOfContents()
        : c.fn === 'ast' ? md.getAST()
        : (() => { throw new Error(`fn tidak dikenal ${c.fn}`) })()
      expect(canonical(got)).toBe(canonical(c.expected))
    })
  }
})

// ─── LombokDocx ──────────────────────────────────────────────────────────────

describe('salinan LombokDocx 1.1.0', () => {
  interface Case {
    id: string; fn: string; input: string; expected: any
    call?: string; name?: string; readFirst?: string; limits?: any
    maxSize?: number; maxDepth?: number; options?: X.DocxOptions
  }
  const doc = load<{ cases: Case[] }>('lombokdocx-vectors-v1.json')

  const bytes = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, 'base64'))
  const digest = (b: Uint8Array) => ({ size: b.length, sha256: createHash('sha256').update(b).digest('hex') })

  const run = (c: Case): unknown => {
    switch (c.fn) {
      case 'inflate':
        return digest(X.inflateRaw(bytes(c.input), c.maxSize ?? 0x7fffffff))
      case 'zip': {
        const z = new X.ZipReader(bytes(c.input), c.limits)
        if (c.call === 'open') return { entries: z.entries.map(e => e.name) }
        if (c.call === 'read') {
          if (c.readFirst) z.read(c.readFirst)
          return z.read(c.name!)
        }
        const read: Record<string, unknown> = {}
        for (const name of Object.keys(c.expected.read)) {
          const b = z.read(name)
          read[name] = b ? digest(b) : null
        }
        return { entries: z.entries.map(e => e.name), read }
      }
      case 'xml':
        return X.parseXML(c.input, { maxDepth: c.maxDepth })
      case 'docx': {
        const d = X.readDocx(bytes(c.input), c.options)
        return {
          blocks: d.blocks,
          images: d.images.map(i => ({ id: i.id, name: i.name, type: i.type, ...digest(i.data) })),
          metadata: JSON.parse(JSON.stringify(d.metadata)),
          text: X.documentToText(d),
          html: X.renderHTML(d),
        }
      }
      default:
        throw new Error(`fn tidak dikenal ${c.fn}`)
    }
  }

  it('memuat minimal 100 kasus', () => expect(doc.cases.length).toBeGreaterThanOrEqual(100))
  for (const c of doc.cases) {
    it(c.id, () => {
      if (c.expected && typeof c.expected === 'object' && 'error' in c.expected) {
        let caught: unknown
        try { run(c) } catch (e) { caught = e }
        expect(caught).toBeInstanceOf(X.DocxError)
        expect((caught as X.DocxError).code).toBe(c.expected.error)
        return
      }
      expect(canonical(run(c))).toBe(canonical(c.expected))
    })
  }
})

// ─── LombokCLIParse ──────────────────────────────────────────────────────────

describe('salinan LombokCLIParse 0.2.0', () => {
  interface ArgDef { kind?: string; name: string; help: string; type?: string; required?: boolean; short?: string | null; default?: string | null; env?: string | null }
  interface AppDef { name: string; description: string; version: string | null; positionals: ArgDef[]; args: ArgDef[]; subcommands: AppDef[] }
  const doc = load<{ cases: { id: string; app: AppDef; argv: string[]; env: Record<string, string>; expected: unknown }[] }>(
    'lombokcliparse-vectors-v1.json')

  const view = new DataView(new ArrayBuffer(8))
  const bits = (x: number): string => {
    view.setFloat64(0, x)
    return '0x' + view.getBigUint64(0).toString(16).padStart(16, '0')
  }
  const opt = (v: string | null | undefined): string | undefined => (v === null ? undefined : v)

  const build = (d: AppDef): App => {
    const app = new App(d.name, d.description)
    if (d.version !== null) app.version(d.version)
    for (const p of d.positionals) app.positional(p.name, p.help, p.type as ArgType, p.required)
    for (const a of d.args) {
      if (a.kind === 'flag') app.flag(a.name, a.help, opt(a.short))
      else app.option(a.name, a.help, a.type as ArgType, opt(a.short), opt(a.default), opt(a.env))
    }
    for (const s of d.subcommands) app.subcommand(build(s))
    return app
  }

  const encode = (m: Matches): unknown => {
    const values: Record<string, unknown> = {}
    for (const [k, v] of m.values()) {
      const t = m.typeOf(k)
      values[k] = t === ArgType.Int ? { int: String(v) }
        : t === ArgType.Float ? { float: bits(v as number) }
        : t === ArgType.Bool ? { bool: v }
        : { str: v }
    }
    const sub = m.subcommand()
    return { values, flags: m.flags(), rest: m.rest(), subcommand: sub ? { name: sub.name, matches: encode(sub.matches) } : null }
  }

  it('memuat minimal 100 kasus', () => expect(doc.cases.length).toBeGreaterThanOrEqual(100))
  for (const c of doc.cases) {
    it(c.id, () => {
      let got: unknown
      try {
        got = { matches: encode(build(c.app).parseWithEnv(c.argv, c.env)) }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e
        if (e.code === 'HELP') got = { help: e.text }
        else if (e.code === 'VERSION') got = { version: e.text }
        else {
          const err: Record<string, string> = { code: e.code, arg: e.arg, message: e.message }
          if (e.value !== undefined) err['value'] = e.value
          got = { error: err }
        }
      }
      expect(got).toStrictEqual(c.expected)
    })
  }
})
