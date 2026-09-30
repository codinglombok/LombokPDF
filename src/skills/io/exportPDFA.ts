/**
 * LombokPDF — PDF/A Converter
 * Converts a PDF to PDF/A format (ISO 19005) for long-term archival.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { PDFAConverter } from './pdfa-converter.js'

export interface PDFAExportOptions {
  conformance?: 'A-1b' | 'A-2b' | 'A-3b'
  includeMetadata?: boolean
}

export async function exportPDFA(
  doc: LombokDocument,
  options: PDFAExportOptions = {}
): Promise<Buffer> {
  const { conformance = 'A-1b' } = options
  
  // Stage 1: Basic PDF/A-1b conformance using pdf-lib and embedded color profile
  // Full color management and extended conformance levels (A-2, A-3) ship with
  // the Stage 2 WASM renderer.
  
  const level = conformance === 'A-1b' ? '1b' : conformance === 'A-2b' ? '2b' : '1b'
  const resultDoc = await PDFAConverter.convert(doc, level as '1b' | '2b')
  return resultDoc._getRaw()
}

export { PDFAConverter }
