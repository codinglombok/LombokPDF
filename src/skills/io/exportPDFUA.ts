/**
 * LombokPDF — PDF/UA Converter
 * Converts a PDF to PDF/UA format (ISO 14289) for universal accessibility.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { PDFUAConverter } from './pdfua-converter.js'

export interface PDFUAExportOptions {
  conformance?: 'UA-1' | 'UA-2'
  includeMetadata?: boolean
  includeAltText?: boolean
}

export async function exportPDFUA(
  doc: LombokDocument,
  options: PDFUAExportOptions = {}
): Promise<Buffer> {
  // Stage 1: Basic PDF/UA-1 with document-level accessibility flags
  // Full tagged-PDF structure tree and enhanced accessibility features ship with
  // the Stage 2 WASM renderer.
  
  const resultDoc = await PDFUAConverter.convert(doc)
  return resultDoc._getRaw()
}

export { PDFUAConverter }
