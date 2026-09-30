/**
 * LombokPDF — Next.js App Router Example
 * Package: works with npm install lombokpdf directly (no adapter package needed)
 *
 * File location: app/api/invoice/[id]/route.ts
 *
 * This demonstrates the recommended pattern for using LombokPDF
 * in a Next.js App Router API route.
 */

import { LombokPDF } from 'lombokpdf'
import { NextRequest, NextResponse } from 'next/server'

// Reuse the instance across requests (module-level singleton)
const pdf = new LombokPDF({ locale: 'en-US' })

interface RouteContext {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const order = await getOrder(params.id)   // your data-fetching logic
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const locale = request.nextUrl.searchParams.get('locale') ?? 'en-US'
    const format = (request.nextUrl.searchParams.get('format') ?? 'pdf') as any

    const doc = await pdf
      .from({ template: 'invoice', data: order })
      .locale(locale)
      .export(format)

    const bytes = await doc.toBytes()

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${params.id}.pdf"`,
        'X-LombokPDF-Pages':   String(doc.pages()),
        'Cache-Control':       'private, max-age=0, no-cache',
      },
    })
  } catch (err) {
    console.error('LombokPDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}

// Placeholder — replace with your actual data source
async function getOrder(id: string) {
  // e.g. return await prisma.order.findUnique({ where: { id } })
  return {
    company:       'Acme Corp',
    invoiceNumber: `INV-${id}`,
    total:         1500,
    items: [
      { name: 'Web Development', qty: 1, unitPrice: 1500, total: 1500 },
    ],
  }
}

/**
 * Client-side usage — trigger download from a React component:
 *
 * ```tsx
 * 'use client'
 * function DownloadButton({ orderId }: { orderId: string }) {
 *   return (
 *     <a href={`/api/invoice/${orderId}`} target="_blank" rel="noopener">
 *       Download Invoice
 *     </a>
 *   )
 * }
 * ```
 */
