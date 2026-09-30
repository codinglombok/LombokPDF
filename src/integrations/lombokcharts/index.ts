/**
 * LombokPDF × LombokCharts Integration
 *
 * Embeds charts from https://github.com/codinglombok/LombokCharts
 * as crisp, scalable SVG directly into PDF pages.
 *
 * Requires peer dependency: @lombok/charts
 *   npm install @lombok/charts
 *
 * @example
 * ```typescript
 * import { LombokPDF } from 'lombokpdf'
 * import { barChart } from '@lombok/charts/pdf'
 *
 * const chart = barChart({
 *   data: salesData,
 *   x: 'month',
 *   y: 'revenue',
 *   renderer: 'svg',   // always 'svg' for PDF
 *   width: 500,
 *   height: 280,
 * })
 *
 * const doc = await new LombokPDF()
 *   .from({ template: 'report', data })
 *   .embed(chart, { page: 2, x: 40, y: 200, width: 500, height: 280 })
 *   .export('pdf')
 * ```
 */

import type { EmbedPosition } from '../../types.js'

// Type definition for a LombokCharts chart object
export interface LombokChart {
  type:     string
  render(options: { renderer: 'svg' | 'canvas'; width: number; height: number }): Promise<string>
  width:    number
  height:   number
}

/**
 * Embed a LombokCharts chart into PDF bytes at a specific position.
 * Uses the SVG renderer for crisp, resolution-independent output.
 *
 * @param pdfBytes - Raw PDF bytes (Uint8Array) to modify
 * @param chart    - A LombokCharts chart object
 * @param position - Where to embed the chart on the page
 * @returns Modified PDF bytes with chart embedded
 */
export async function embedChartInPDF(
  pdfBytes: Uint8Array,
  chart: unknown,
  position: EmbedPosition,
): Promise<Uint8Array> {
  const lombokChart = chart as LombokChart

  // Resolve dimensions from position or chart defaults
  const width  = position.width  ?? lombokChart.width  ?? 400
  const height = position.height ?? lombokChart.height ?? 250

  // Render chart as SVG (always SVG for PDF — crisp at any size)
  const svg = await lombokChart.render({ renderer: 'svg', width, height })

  // Embed SVG into PDF using pdf-lib
  const { embedSVGInPDF } = await import('./svg-embedder.js')

  return embedSVGInPDF(pdfBytes, svg, {
    page:   (position.page ?? 1) - 1,  // pdf-lib uses 0-based page index
    x:      position.x ?? 40,
    y:      position.y ?? 40,
    width,
    height,
    fit:    position.fit ?? 'contain',
  })
}

/**
 * SVG Embedder — injects an SVG string into a PDF page as a vector XObject.
 */
export interface SVGEmbedOptions {
  page:   number   // 0-based page index
  x:      number   // points from left
  y:      number   // points from top
  width:  number
  height: number
  fit:    'fill' | 'contain' | 'cover'
}
