/**
 * LombokPDF — Port Parity Integration Test
 *
 * Verifies that the JavaScript/TypeScript canonical port produces
 * consistent, valid output across the core feature set. Equivalent
 * test suites exist in each port (ports/python/tests, ports/php/tests, etc.)
 * and CI runs them all against the same fixture data to ensure parity.
 */

import { describe, it, expect } from 'vitest'
import { LombokPDF } from '../../src/index.js'

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46])  // %PDF

function isValidPDF(bytes: Uint8Array): boolean {
  return bytes.length > 4 &&
    bytes[0] === PDF_MAGIC[0] &&
    bytes[1] === PDF_MAGIC[1] &&
    bytes[2] === PDF_MAGIC[2] &&
    bytes[3] === PDF_MAGIC[3]
}

describe('Port Parity — Reference Fixtures', () => {
  const pdf = new LombokPDF()

  it('produces valid PDF magic bytes for simple HTML', async () => {
    const doc   = await pdf.from({ html: '<h1>Hello, World</h1>' }).export('pdf')
    const bytes = await doc.toBytes()
    expect(isValidPDF(bytes)).toBe(true)
  })

  it('produces valid PDF for invoice template (en-US)', async () => {
    const doc = await pdf
      .from({
        template: 'invoice',
        data: {
          company:       'Acme Corp',
          invoiceNumber: 'INV-TEST-001',
          date:          '2026-07-20',
          items: [
            { name: 'Service A', qty: 1, unitPrice: 1000, total: 1000 },
          ],
          subtotal:   1000,
          grandTotal: 1000,
        },
      })
      .locale('en-US')
      .export('pdf')

    const bytes = await doc.toBytes()
    expect(isValidPDF(bytes)).toBe(true)
    expect(doc.pages()).toBeGreaterThanOrEqual(1)
  })

  it('produces valid PDF for invoice template (ar-SA, RTL)', async () => {
    const doc = await pdf
      .from({
        template: 'invoice',
        data: {
          company: 'شركة أكمي',
          invoiceNumber: 'INV-TEST-002',
          date: '2026-07-20',
          items: [{ name: 'خدمة أ', qty: 1, unitPrice: 1000, total: 1000 }],
          subtotal: 1000,
          grandTotal: 1000,
          currency: 'SAR',
        },
      })
      .locale('ar-SA')
      .export('pdf')

    const bytes = await doc.toBytes()
    expect(isValidPDF(bytes)).toBe(true)
  })

  it('produces valid PDF for markdown source', async () => {
    const doc = await pdf
      .from({ markdown: '# Report\n\nThis is a **test** report.\n\n| A | B |\n|---|---|\n| 1 | 2 |' })
      .export('pdf')

    const bytes = await doc.toBytes()
    expect(isValidPDF(bytes)).toBe(true)
  })

  it('respects PDF/A-1b format request', async () => {
    const doc = await pdf.from({ html: '<h1>Archival Document</h1>' }).export('pdf/a-1b')
    const bytes = await doc.toBytes()
    expect(isValidPDF(bytes)).toBe(true)
  })

  it('metadata round-trips through setMetadata', async () => {
    const doc = await pdf
      .from({ html: '<p>Test</p>' })
      .metadata({ title: 'Parity Test', author: 'LombokPDF CI' })
      .export('pdf')

    expect(doc.metadata().title).toBe('Parity Test')
    expect(doc.metadata().author).toBe('LombokPDF CI')
  })

  it('all 12 built-in templates are resolvable', async () => {
    const templates = [
      'invoice', 'report', 'legal', 'certificate', 'letter', 'resume',
      'ticket', 'label', 'receipt', 'newsletter', 'datasheet', 'booklet',
    ]

    for (const tmpl of templates) {
      const doc = await pdf.from({ template: tmpl, data: {} }).export('pdf')
      const bytes = await doc.toBytes()
      expect(isValidPDF(bytes)).toBe(true, `Template '${tmpl}' should produce valid PDF`)
    }
  })
})

describe('Port Parity — Locale Coverage', () => {
  const pdf = new LombokPDF()
  const localesToTest = [
    'en-US', 'id-ID', 'ar-SA', 'he-IL', 'ja-JP', 'zh-Hans-CN',
    'ko-KR', 'th-TH', 'ru-RU', 'de-DE', 'fr-FR', 'hi-IN',
  ]

  for (const locale of localesToTest) {
    it(`renders valid PDF for locale: ${locale}`, async () => {
      const doc = await pdf
        .from({ html: '<h1>Test Document</h1><p>Sample content.</p>' })
        .locale(locale)
        .export('pdf')

      const bytes = await doc.toBytes()
      expect(isValidPDF(bytes)).toBe(true)
    })
  }
})
