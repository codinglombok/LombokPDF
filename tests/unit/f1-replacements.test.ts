/**
 * Tests for the F1 replacements (docs/map_LombokPDF_v1.0.0.md section 10):
 * front matter / YAML subset, Markdown and DOCX import, HTML parsing in the CSSOM,
 * QR code drawing helpers, and CLI argument handling.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

import { parseFrontMatter, parseYaml, YamlError, MAX_YAML_DEPTH } from '../../src/templates/front-matter.js'
import { markdownToHTML } from '../../src/skills/io/importMarkdown.js'
import { docxToHTML } from '../../src/skills/io/importDocx.js'
import { CSSOMParser } from '../../src/core/cssom/parser.js'
import { parse } from '../../src/vendor/lombokhtml/index.js'
import { DocxBuilder } from '../../src/vendor/lombokdocx/index.js'
import { moduleRuns, hexToRGB } from '../../src/skills/marks/qrcode-generator.js'
import { buildApp, normalizeArgv } from '../../src/cli/index.js'

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v))

// ─── Front matter / YAML ─────────────────────────────────────────────────────

describe('parseFrontMatter', () => {
  it('parses every built-in template', () => {
    const dir = new URL('../../templates/', import.meta.url)
    for (const name of readdirSync(dir)) {
      const fm = parseFrontMatter(readFileSync(new URL(`${name}/template.html`, dir), 'utf8'))
      expect(fm.present, name).toBe(true)
      expect(typeof fm.data['title'], name).toBe('string')
      expect(typeof fm.data['variables'], name).toBe('object')
      expect(fm.content.startsWith('---'), name).toBe(false)
    }
  })

  it('returns the source unchanged without front matter', () => {
    const fm = parseFrontMatter('# Hello\n---\n')
    expect(fm.present).toBe(false)
    expect(fm.content).toBe('# Hello\n---\n')
    expect(plain(fm.data)).toEqual({})
  })

  it('handles BOM, CRLF and the ... terminator', () => {
    const fm = parseFrontMatter('\uFEFF---\r\ntitle: Hi\r\n...\r\nbody')
    expect(plain(fm.data)).toEqual({ title: 'Hi' })
    expect(fm.content).toBe('body')
  })

  it('rejects an unclosed block and a non-mapping document', () => {
    expect(() => parseFrontMatter('---\ntitle: x\n')).toThrow(YamlError)
    expect(() => parseFrontMatter('---\n- a\n---\n')).toThrow(/mapping/)
  })
})

describe('parseYaml', () => {
  it('parses nested mappings, sequences and flow collections', () => {
    const doc = [
      'a:',
      '  b:',
      '    - x',
      '    - y: 1',
      '      z: [1, 2, {q: "w"}]',
      'list:',
      '- 1',
      '- two # comment',
      '- "three # not"',
      "- 'it''s'",
      'empty:',
      'flowEmpty: {}',
      'seqEmpty: []',
    ].join('\n')
    expect(plain(parseYaml(doc))).toEqual({
      a: { b: ['x', { y: 1, z: [1, 2, { q: 'w' }] }] },
      list: [1, 'two', 'three # not', "it's"],
      empty: null,
      flowEmpty: {},
      seqEmpty: [],
    })
  })

  it('resolves scalars with the YAML 1.2 core schema', () => {
    expect(plain(parseYaml('a: ~\nb: TRUE\nc: false\nd: 0x1F\ne: 0o17\nf: 1.5e3\ng: -7\nh: 10:30\ni: "007"\nj: .inf'))).toEqual({
      a: null, b: true, c: false, d: 31, e: 15, f: 1500, g: -7, h: '10:30', i: '007', j: null,
    })
    expect(parseYaml('x: .inf')).toEqual({ x: Infinity })
    expect(Number.isNaN((parseYaml('x: .nan') as { x: number }).x)).toBe(true)
  })

  it('keeps URLs and colons inside values', () => {
    expect(plain(parseYaml('url: http://x.y/z?a=1#frag\ntitle: Resume / CV'))).toEqual({
      url: 'http://x.y/z?a=1#frag', title: 'Resume / CV',
    })
  })

  it('decodes double-quoted escapes', () => {
    expect(parseYaml('s: "a\\tb\\n\\u00e9\\U0001F600\\x41\\"\\\\"')).toEqual({ s: 'a\tb\né\u{1F600}A"\\' })
    expect(() => parseYaml('s: "\\q"')).toThrow(/escape/)
  })

  it('supports literal and folded block scalars with chomping', () => {
    const doc = 'lit: |\n  one\n  two\nfold: >-\n  folded\n  text\n\n  para\nkeep: |+\n  x\n\nend: 1'
    expect(plain(parseYaml(doc))).toEqual({ lit: 'one\ntwo\n', fold: 'folded text\npara', keep: 'x\n\n', end: 1 })
  })

  it('creates mappings without a prototype', () => {
    const v = parseYaml('__proto__: {polluted: true}\nconstructor: x') as Record<string, unknown>
    expect(Object.getPrototypeOf(v)).toBe(null)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    expect(plain(v['__proto__'])).toEqual({ polluted: true })
  })

  it('rejects unsupported or ambiguous YAML instead of guessing', () => {
    for (const bad of [
      'a: &anchor 1', 'a: *alias', 'a: !tag x', '%YAML 1.2', 'a: 1\na: 2', '\ta: 1',
      'a: [1, 2', 'a: "open', 'a:\n  b: 1\n c: 2', 'a: 1\n---\nb: 2',
    ]) {
      expect(() => parseYaml(bad), bad).toThrow(YamlError)
    }
  })

  it('reports the line number', () => {
    try {
      parseYaml('a: 1\nb: 2\nb: 3')
      expect.unreachable()
    } catch (e) {
      expect((e as YamlError).line).toBe(3)
    }
  })

  it('limits nesting depth', () => {
    const deep = '['.repeat(MAX_YAML_DEPTH + 5) + ']'.repeat(MAX_YAML_DEPTH + 5)
    expect(() => parseYaml(`a: ${deep}`)).toThrow(/nesting/)
  })
})

// ─── Markdown and DOCX import ────────────────────────────────────────────────

describe('markdownToHTML (LombokMarkDown)', () => {
  it('renders GFM with heading ids', async () => {
    const html = await markdownToHTML('# Hello World\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n~~x~~ - [x] t')
    expect(html).toContain('<h1 id="hello-world">Hello World</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('<del>x</del>')
  })

  it('drops javascript: links', async () => {
    const html = await markdownToHTML('[x](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('passes raw HTML by default and escapes it on request', async () => {
    expect(await markdownToHTML('<div class="kpi">x</div>')).toContain('<div class="kpi">')
    expect(await markdownToHTML('<div>x</div>', { html: false })).toContain('&lt;div&gt;')
  })
})

describe('docxToHTML (LombokDocx)', () => {
  it('converts headings, formatting and tables', async () => {
    const bytes = new DocxBuilder()
      .addParagraph('Kontrak', { bold: true })
      .addTable([['Nama', 'Peran'], ['A', 'Pihak pertama']])
      .toDocx()
    const html = await docxToHTML(bytes)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<strong>Kontrak</strong>')
    expect(html).toContain('Pihak pertama')
  })

  it('reports invalid files with the LombokDocx error code', async () => {
    await expect(docxToHTML(new Uint8Array([1, 2, 3]))).rejects.toThrow(/LombokPDF\/importDocx: INVALID_ZIP/)
  })
})

// ─── HTML parsing (LombokHTML) in the CSSOM ──────────────────────────────────

describe('CSSOMParser with LombokHTML', () => {
  it('collects <style> blocks and @page rules', () => {
    const tree = parse('<html><head><style>h1 { color: var(--brand) } @page { size: A5; margin: 1cm }</style></head><body><h1>x</h1></body></html>')
    const cssom = CSSOMParser.parse(tree, { '--brand': '#123456' })
    expect(cssom.getStyle('h1')).toEqual({ color: '#123456' })
    expect(cssom.pages['default']).toEqual({ size: 'A5', margin: '1cm' })
  })
})

// ─── QR code drawing helpers ─────────────────────────────────────────────────

describe('QR helpers', () => {
  it('merges adjacent dark modules into runs', () => {
    expect(moduleRuns([[true, true, false, true], [false, false, false, false], [true, false, true, true]])).toEqual([
      { x: 0, y: 0, w: 2 }, { x: 3, y: 0, w: 1 }, { x: 0, y: 2, w: 1 }, { x: 2, y: 2, w: 2 },
    ])
  })

  it('parses hex colours', () => {
    expect(hexToRGB('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRGB('#f00')).toEqual([1, 0, 0])
    expect(() => hexToRGB('red')).toThrow(/invalid color/)
  })
})

// ─── CLI (LombokCLIParse) ────────────────────────────────────────────────────

describe('CLI', () => {
  const app = buildApp('9.9.9')
  const run = (argv: string[]) => app.parse(['lombokpdf', ...normalizeArgv(argv)])

  it('maps -v to --version', () => {
    expect(() => run(['-v'])).toThrow(expect.objectContaining({ code: 'VERSION', text: 'lombokpdf 9.9.9\n' }))
  })

  it('collects merge files in any position', () => {
    expect(normalizeArgv(['merge', 'a.pdf', '-o', 'x.pdf', 'b.pdf'])).toEqual(['merge', '-o', 'x.pdf', '--', 'a.pdf', 'b.pdf'])
    const sub = run(['merge', 'a.pdf', '--output=x.pdf', 'b.pdf']).subcommand()!
    expect(sub.name).toBe('merge')
    expect(sub.matches.getStr('output')).toBe('x.pdf')
    expect(sub.matches.rest()).toEqual(['a.pdf', 'b.pdf'])
  })

  it('applies defaults and typed options', () => {
    const m = run(['splitimg', 'p.png', '--cols', '4', '--show-borders']).subcommand()!.matches
    expect(m.getInt('cols')).toBe(4)
    expect(m.getInt('rows')).toBe(3)
    expect(m.getBool('show-borders')).toBe(true)
    expect(m.getStr('output')).toBe('grid.pdf')
  })

  it('parses nested form subcommands', () => {
    const form = run(['form', 'fill', 'f.pdf', '--flatten']).subcommand()!
    const fill = form.matches.subcommand()!
    expect([form.name, fill.name]).toEqual(['form', 'fill'])
    expect(fill.matches.getStr('file')).toBe('f.pdf')
    expect(fill.matches.getBool('flatten')).toBe(true)
  })

  it('reads the signing password from CERT_PASS', () => {
    const m = app.parseWithEnv(['sign', 'a.pdf', '--cert', 'c.p12'], { CERT_PASS: 's3cret' }).subcommand()!.matches
    expect(m.getStr('pass')).toBe('s3cret')
  })

  it('reports invalid values with stable codes', () => {
    expect(() => run(['convert'])).toThrow(expect.objectContaining({ code: 'MISSING_REQUIRED' }))
    expect(() => run(['splitimg', 'p.png', '--cols', 'abc'])).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
    expect(() => run(['nope'])).toThrow(expect.objectContaining({ code: 'UNKNOWN_SUBCOMMAND' }))
  })
})
