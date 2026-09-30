/**
 * Stage 1 JS renderer — PDFKit backed.
 * Handles basic HTML → PDF with CSS Paged Media subset.
 * Replaced by WASM backend in Stage 2.
 */

import PDFDocument from 'pdfkit'
import { parse } from 'parse5'
import type { RenderOptions } from './engine.js'
import type { LombokPDFOptions } from '../../types.js'
import { BiDiResolver } from '../bidi/resolver.js'
import { applyPageConfig } from './page.js'
import { CSSOMParser } from '../cssom/parser.js'
import { ThemeResolver } from '../../integrations/lombokcss/resolver.js'

export async function renderWithPDFKit(
  html: string,
  renderOpts: RenderOptions,
  engineOpts: Required<LombokPDFOptions>,
): Promise<Uint8Array> {
  const { locale, theme, page, metadata } = renderOpts

  // Resolve page dimensions
  const { width, height, margins } = applyPageConfig(page)

  // Create PDF document
  const doc = new PDFDocument({
    size:        [width, height],
    margins,
    autoFirstPage: false,
    pdfVersion:  renderOpts.format === 'pdf/a-1b' ? '1.4' : '1.7',
    info: {
      Title:    metadata.title    ?? '',
      Author:   metadata.author   ?? '',
      Subject:  metadata.subject  ?? '',
      Keywords: metadata.keywords?.join(', ') ?? '',
      Creator:  'LombokPDF',
      Producer: `LombokPDF ${(globalThis as any).__LOMBOKPDF_VERSION__ ?? '1.0.0'}`,
    },
  })

  // Collect PDF bytes
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  // Parse HTML
  const tree = parse(html)

  // Resolve theme tokens (LombokCSS)
  const tokens = await ThemeResolver.resolve(theme)

  // Parse inline + embedded CSS
  const cssom = CSSOMParser.parse(tree, tokens)

  // Add first page
  doc.addPage()

  // Render nodes
  const bidi = new BiDiResolver(locale.direction ?? 'ltr')
  await renderNode(tree, doc, cssom, bidi, locale)

  // Finalize
  doc.end()

  // Wait for stream to finish
  await new Promise<void>((resolve) => doc.on('end', resolve))

  return new Uint8Array(Buffer.concat(chunks))
}

async function renderNode(
  node: any,
  doc: PDFKit.PDFDocument,
  cssom: any,
  bidi: BiDiResolver,
  locale: any,
): Promise<void> {
  if (!node) return

  if (node.nodeName === '#text') {
    const text = bidi.resolve(node.value ?? '')
    if (text.trim()) {
      doc.text(text, { lineGap: 2 })
    }
    return
  }

  // Handle element nodes
  const el  = node
  const tag = (el.tagName ?? '').toLowerCase()

  switch (tag) {
    case 'h1': {
      doc.moveDown(0.5)
      doc.fontSize(24).font('Helvetica-Bold')
      break
    }
    case 'h2': {
      doc.moveDown(0.3)
      doc.fontSize(18).font('Helvetica-Bold')
      break
    }
    case 'h3': {
      doc.fontSize(14).font('Helvetica-Bold')
      break
    }
    case 'p': {
      doc.moveDown(0.3)
      doc.fontSize(11).font('Helvetica')
      break
    }
    case 'strong':
    case 'b': {
      doc.font('Helvetica-Bold')
      break
    }
    case 'em':
    case 'i': {
      doc.font('Helvetica-Oblique')
      break
    }
    case 'table': {
      await renderTable(el, doc, bidi)
      return
    }
    case 'hr': {
      doc.moveDown(0.3)
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke()
      doc.moveDown(0.3)
      return
    }
    case 'br': {
      doc.moveDown(0.3)
      return
    }
    case 'img': {
      const src = el.attrs?.find((a: any) => a.name === 'src')?.value
      if (src && src.startsWith('data:')) {
        const base64 = src.split(',')[1]!
        const buf = Buffer.from(base64, 'base64')
        doc.image(buf, { fit: [400, 300] })
      }
      return
    }
    case 'ul':
    case 'ol': {
      await renderList(el, doc, tag === 'ol', bidi)
      return
    }
    default:
      break
  }

  // Recurse into children
  for (const child of el.childNodes ?? []) {
    await renderNode(child, doc, cssom, bidi, locale)
  }

  // Reset font after inline elements
  if (['strong', 'b', 'em', 'i'].includes(tag)) {
    doc.font('Helvetica').fontSize(11)
  }
}

async function renderTable(table: any, doc: PDFKit.PDFDocument, bidi: BiDiResolver): Promise<void> {
  const rows: string[][] = []
  const allTrs = findAll(table, 'tr')

  for (const tr of allTrs) {
    const cells = findAll(tr, 'td').concat(findAll(tr, 'th'))
    rows.push(cells.map(c => extractText(c)))
  }

  if (rows.length === 0) return

  const colCount  = Math.max(...rows.map(r => r.length))
  const colWidth  = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / colCount
  const rowHeight = 20

  doc.moveDown(0.3)

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    const y   = doc.y

    for (let c = 0; c < colCount; c++) {
      const x    = doc.page.margins.left + c * colWidth
      const cell = row[c] ?? ''

      doc.rect(x, y, colWidth, rowHeight).stroke()

      const resolved = bidi.resolve(cell)
      doc.text(resolved, x + 4, y + 4, {
        width:  colWidth - 8,
        height: rowHeight - 8,
        ellipsis: true,
        font: r === 0 ? 'Helvetica-Bold' : 'Helvetica',
      })
    }

    doc.y = y + rowHeight
  }

  doc.moveDown(0.3)
}

async function renderList(
  el: any,
  doc: PDFKit.PDFDocument,
  ordered: boolean,
  bidi: BiDiResolver,
): Promise<void> {
  const items = findAll(el, 'li')
  doc.moveDown(0.2)
  items.forEach((item, i) => {
    const text   = bidi.resolve(extractText(item))
    const bullet = ordered ? `${i + 1}. ` : '• '
    doc.text(`${bullet}${text}`, {
      indent: 20,
      lineGap: 2,
    })
  })
  doc.moveDown(0.2)
}

function findAll(node: any, tag: string): any[] {
  const result: any[] = []
  if (!node) return result
  if ((node.tagName ?? '').toLowerCase() === tag) result.push(node)
  for (const child of node.childNodes ?? []) {
    result.push(...findAll(child, tag))
  }
  return result
}

function extractText(node: any): string {
  if (!node) return ''
  if (node.nodeName === '#text') return node.value ?? ''
  return (node.childNodes ?? []).map(extractText).join('')
}
