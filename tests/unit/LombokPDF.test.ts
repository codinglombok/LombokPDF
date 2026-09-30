/**
 * LombokPDF — Core Unit Tests
 * Run: npm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LombokPDF } from '../../src/core/LombokPDF.js'
import { locale, resolveLocale } from '../../src/core/locale.js'
import { Document } from '../../src/core/Document.js'
import { Builder } from '../../src/core/Builder.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/core/lle/engine.js', () => ({
  LLEEngine: vi.fn().mockImplementation(() => ({
    render: vi.fn().mockResolvedValue(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]) // %PDF-1.7
    ),
  })),
}))

// ─── LombokPDF class ─────────────────────────────────────────────────────────

describe('LombokPDF', () => {
  describe('constructor', () => {
    it('creates instance with default options', () => {
      const pdf = new LombokPDF()
      expect(pdf).toBeDefined()
    })

    it('accepts locale option', () => {
      const pdf = new LombokPDF({ locale: 'ar-SA' })
      expect(pdf).toBeDefined()
    })

    it('accepts theme option', () => {
      const pdf = new LombokPDF({ theme: 'resonant-stark' })
      expect(pdf).toBeDefined()
    })

    it('accepts all options', () => {
      const pdf = new LombokPDF({
        locale: 'id-ID',
        theme:  'modern-corporate-flat',
        fonts:  { primary: 'Noto Sans' },
        page:   { size: 'A4', orientation: 'portrait' },
        debug:  false,
        timeout: 30_000,
      })
      expect(pdf).toBeDefined()
    })
  })

  describe('from()', () => {
    it('returns a Builder for HTML source', () => {
      const pdf     = new LombokPDF()
      const builder = pdf.from({ html: '<h1>Test</h1>' })
      expect(builder).toBeInstanceOf(Builder)
    })

    it('returns a Builder for template source', () => {
      const pdf     = new LombokPDF()
      const builder = pdf.from({ template: 'invoice', data: { company: 'Acme' } })
      expect(builder).toBeInstanceOf(Builder)
    })

    it('returns a Builder for markdown source', () => {
      const pdf     = new LombokPDF()
      const builder = pdf.from({ markdown: '# Hello' })
      expect(builder).toBeInstanceOf(Builder)
    })
  })

  describe('fromHTML()', () => {
    it('is shorthand for from({ html })', () => {
      const pdf     = new LombokPDF()
      const builder = pdf.fromHTML('<h1>Test</h1>')
      expect(builder).toBeInstanceOf(Builder)
    })
  })

  describe('version()', () => {
    it('returns a version string', () => {
      const v = LombokPDF.version()
      expect(typeof v).toBe('string')
    })
  })

  describe('supported()', () => {
    it('returns support matrix', () => {
      const matrix = LombokPDF.supported()
      expect(matrix).toHaveProperty('cssPagedMedia', true)
      expect(matrix).toHaveProperty('flexbox', true)
      expect(matrix).toHaveProperty('bidi', true)
      expect(Array.isArray(matrix.locales)).toBe(true)
      expect(matrix.locales.length).toBeGreaterThan(50)
    })
  })
})

// ─── locale resolver ─────────────────────────────────────────────────────────

describe('resolveLocale', () => {
  it('resolves en-US to LTR', () => {
    const loc = resolveLocale('en-US')
    expect(loc.direction).toBe('ltr')
    expect(loc.tag).toBe('en-US')
  })

  it('resolves ar-SA to RTL', () => {
    const loc = resolveLocale('ar-SA')
    expect(loc.direction).toBe('rtl')
  })

  it('resolves he-IL to RTL', () => {
    const loc = resolveLocale('he-IL')
    expect(loc.direction).toBe('rtl')
  })

  it('resolves fa-IR to RTL', () => {
    const loc = resolveLocale('fa-IR')
    expect(loc.direction).toBe('rtl')
  })

  it('resolves zh-Hans-CN to LTR', () => {
    const loc = resolveLocale('zh-Hans-CN')
    expect(loc.direction).toBe('ltr')
  })

  it('resolves id-ID to LTR with hyphenation disabled', () => {
    const loc = resolveLocale('id-ID')
    expect(loc.direction).toBe('ltr')
    expect(loc.hyphenation).toBe(false)
  })

  it('resolves de-DE to LTR with hyphenation enabled', () => {
    const loc = resolveLocale('de-DE')
    expect(loc.hyphenation).toBe(true)
  })

  it('passes through existing LocaleConfig', () => {
    const cfg = { tag: 'en-US', direction: 'ltr' as const }
    expect(resolveLocale(cfg)).toBe(cfg)
  })

  it('locale() helper wraps resolveLocale', () => {
    const loc = locale('ja-JP')
    expect(loc.tag).toBe('ja-JP')
    expect(loc.lineBreaking).toBe('strict')
  })

  it('availableLocales() returns 50+ locales', () => {
    const locs = resolveLocale.availableLocales()
    expect(locs.length).toBeGreaterThanOrEqual(50)
    expect(locs).toContain('ar-SA')
    expect(locs).toContain('zh-Hans-CN')
    expect(locs).toContain('id-ID')
    expect(locs).toContain('ja-JP')
  })
})

// ─── Document class ──────────────────────────────────────────────────────────

describe('Document', () => {
  const fakePDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37])

  it('creates document from bytes', () => {
    const doc = new Document(fakePDF)
    expect(doc).toBeDefined()
  })

  it('toBytes() returns the bytes', async () => {
    const doc   = new Document(fakePDF)
    const bytes = await doc.toBytes()
    expect(bytes).toEqual(fakePDF)
  })

  it('toBase64() returns base64 string', async () => {
    const doc = new Document(fakePDF)
    const b64 = await doc.toBase64()
    expect(typeof b64).toBe('string')
    expect(b64.length).toBeGreaterThan(0)
  })

  it('toDataURI() returns data URI', async () => {
    const doc = new Document(fakePDF)
    const uri = await doc.toDataURI()
    expect(uri.startsWith('data:application/pdf;base64,')).toBe(true)
  })

  it('size returns byte length', () => {
    const doc = new Document(fakePDF)
    expect(doc.size).toBe(fakePDF.byteLength)
  })

  it('metadata() returns default metadata', () => {
    const doc  = new Document(fakePDF)
    const meta = doc.metadata()
    expect(typeof meta).toBe('object')
  })

  it('setMetadata() returns new Document with merged metadata', () => {
    const doc  = new Document(fakePDF)
    const doc2 = doc.setMetadata({ title: 'Test', author: 'Lombok' })
    expect(doc2.metadata().title).toBe('Test')
    expect(doc2.metadata().author).toBe('Lombok')
    // Original unchanged
    expect(doc.metadata().title).toBeUndefined()
  })

  it('_withRaw() returns new Document with same metadata', () => {
    const doc  = new Document(fakePDF, { title: 'Test' })
    const newB = new Uint8Array([1, 2, 3])
    const doc2 = doc._withRaw(newB)
    expect(doc2.metadata().title).toBe('Test')
    expect(doc2._getRaw()).toEqual(newB)
  })
})

// ─── Builder class ────────────────────────────────────────────────────────────

describe('Builder', () => {
  let pdf: LombokPDF

  beforeEach(() => {
    pdf = new LombokPDF()
  })

  it('is chainable — locale()', () => {
    const builder = pdf.from({ html: '<p>test</p>' }).locale('fr-FR')
    expect(builder).toBeInstanceOf(Builder)
  })

  it('is chainable — theme()', () => {
    const builder = pdf.from({ html: '<p>test</p>' }).theme('resonant-stark')
    expect(builder).toBeInstanceOf(Builder)
  })

  it('is chainable — metadata()', () => {
    const builder = pdf.from({ html: '<p>test</p>' }).metadata({ title: 'Test' })
    expect(builder).toBeInstanceOf(Builder)
  })

  it('is chainable — page()', () => {
    const builder = pdf.from({ html: '<p>test</p>' }).page({ size: 'Letter' })
    expect(builder).toBeInstanceOf(Builder)
  })

  it('export() resolves to a Document', async () => {
    const doc = await pdf.from({ html: '<h1>Hello</h1>' }).export('pdf')
    expect(doc).toBeInstanceOf(Document)
  })

  it('full chain resolves', async () => {
    const doc = await pdf
      .from({ html: '<h1>مرحباً</h1>' })
      .locale('ar-SA')
      .theme('modern-corporate-flat')
      .metadata({ title: 'Arabic Test' })
      .export('pdf')

    expect(doc).toBeInstanceOf(Document)
    expect(doc.metadata().title).toBe('Arabic Test')
  })

  it('pipe() attaches a skill', async () => {
    const mockSkill = {
      name: 'mock',
      apply: vi.fn().mockImplementation(async (doc: Document) => doc),
    }

    const doc = await pdf.from({ html: '<p>test</p>' }).pipe(mockSkill).export()
    expect(mockSkill.apply).toHaveBeenCalledTimes(1)
    expect(doc).toBeInstanceOf(Document)
  })

  it('multiple pipe() skills run in order', async () => {
    const order: number[] = []
    const skill1 = { name: 's1', apply: vi.fn().mockImplementation(async (d: Document) => { order.push(1); return d }) }
    const skill2 = { name: 's2', apply: vi.fn().mockImplementation(async (d: Document) => { order.push(2); return d }) }
    const skill3 = { name: 's3', apply: vi.fn().mockImplementation(async (d: Document) => { order.push(3); return d }) }

    await pdf.from({ html: '<p>test</p>' })
      .pipe(skill1).pipe(skill2).pipe(skill3).export()

    expect(order).toEqual([1, 2, 3])
  })
})
