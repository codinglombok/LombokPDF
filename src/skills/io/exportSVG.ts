/**
 * LombokPDF — SVG Page Exporter
 * Converts a PDF page to a vector SVG representation.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { SVGExporter } from './svg-exporter.js'

export interface SVGExportOptions {
  pageNum?: number
  includeMetadata?: boolean
}

export async function exportSVG(
  doc: LombokDocument,
  options: SVGExportOptions = {}
): Promise<string> {
  const { pageNum = 1 } = options
  return SVGExporter.export(doc, pageNum)
}

export { SVGExporter }
