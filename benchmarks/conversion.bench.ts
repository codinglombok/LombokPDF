/**
 * LombokPDF — Performance Benchmarks
 * Run: npm run bench
 */

import { bench, describe, beforeAll } from 'vitest'
import { LombokPDF } from '../src/index.js'

let pdf: LombokPDF

beforeAll(() => { pdf = new LombokPDF() })

const HTML_SIMPLE   = '<h1>Hello World</h1><p>Simple one-page document for benchmark purposes.</p>'
const HTML_TABLE    = `
  <h1>Sales Report Q4</h1>
  <table>
    <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
    <tbody>
      ${Array.from({ length: 30 }, (_, i) =>
        `<tr><td>Product ${i + 1}</td><td>${(i + 1) * 17}</td><td>$${(i + 1) * 299}.00</td></tr>`
      ).join('')}
    </tbody>
  </table>
`
const HTML_MULTIPAGE = Array.from({ length: 5 }, (_, i) => `
  <h1>Chapter ${i + 1}</h1>
  <p>${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(80)}</p>
`).join('<div style="page-break-after: always"></div>')

const HTML_ARABIC = `
  <html dir="rtl" lang="ar">
  <head><meta charset="UTF-8"></head>
  <body>
    <h1>تقرير المبيعات الربع الرابع</h1>
    <p>هذا تقرير عن أداء المبيعات في الربع الأخير من العام. نستعرض فيه أهم المؤشرات والنتائج.</p>
    <table>
      <thead><tr><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead>
      <tbody>
        ${Array.from({ length: 10 }, (_, i) =>
          `<tr><td>منتج ${i + 1}</td><td>${(i+1)*10}</td><td>${(i+1)*500} ريال</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </body></html>
`

describe('LombokPDF Benchmarks', () => {

  bench('simple HTML → PDF (1 page)', async () => {
    const doc = await pdf.from({ html: HTML_SIMPLE }).export('pdf')
    await doc.toBytes()
  }, { iterations: 20 })

  bench('table HTML → PDF (1 page, 30 rows)', async () => {
    const doc = await pdf.from({ html: HTML_TABLE }).export('pdf')
    await doc.toBytes()
  }, { iterations: 10 })

  bench('multi-page HTML → PDF (5 pages)', async () => {
    const doc = await pdf.from({ html: HTML_MULTIPAGE }).export('pdf')
    await doc.toBytes()
  }, { iterations: 10 })

  bench('Arabic HTML → PDF (RTL, 1 page)', async () => {
    const doc = await pdf.from({ html: HTML_ARABIC }).locale('ar-SA').export('pdf')
    await doc.toBytes()
  }, { iterations: 10 })

  bench('invoice template → PDF (id-ID locale)', async () => {
    const data = {
      company:       'PT Lombok Digital',
      invoiceNumber: 'INV-2026-001',
      date:          '2026-07-20',
      dueDate:       '2026-08-20',
      taxRate:       0.11,
      currency:      'IDR',
      items: Array.from({ length: 5 }, (_, i) => ({
        name:      `Layanan ${i + 1}`,
        qty:       1,
        unitPrice: (i + 1) * 500_000,
        total:     (i + 1) * 500_000,
      })),
      subtotal:   7_500_000,
      tax:          825_000,
      grandTotal: 8_325_000,
    }

    const doc = await pdf.from({ template: 'invoice', data }).locale('id-ID').export('pdf')
    await doc.toBytes()
  }, { iterations: 10 })

  bench('toBase64() encoding', async () => {
    const doc = await pdf.from({ html: HTML_SIMPLE }).export('pdf')
    await doc.toBase64()
  }, { iterations: 50 })

})
