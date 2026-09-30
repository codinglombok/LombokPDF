/**
 * LombokPDF — AWS Lambda Handler
 *
 * Deploy as:
 *  - Lambda Function with API Gateway (REST or HTTP API)
 *  - Lambda Layer for shared use across functions
 *
 * Environment variables:
 *  OUTPUT_BUCKET  — S3 bucket for saving generated PDFs
 *  CERT_PASS      — Certificate password (store in AWS Secrets Manager)
 *  LOG_LEVEL      — debug | info | warn | error (default: info)
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { LombokPDF } from 'lombokpdf'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3  = new S3Client({ region: process.env['AWS_REGION'] ?? 'ap-southeast-1' })
const pdf = new LombokPDF()

interface GenerateRequest {
  template?: string
  html?:     string
  data?:     Record<string, unknown>
  locale?:   string
  theme?:    string
  format?:   'pdf' | 'pdf/a-1b' | 'pdf/a-2b'
  filename?: string
  /** If true, return presigned S3 URL instead of base64 */
  s3?:       boolean
  s3Key?:    string
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const start = Date.now()

  try {
    // Parse request body
    const body = JSON.parse(event.body ?? '{}') as GenerateRequest

    // Validate input
    if (!body.template && !body.html) {
      return response(400, { error: 'Either template or html is required' })
    }

    // Build source
    const source = body.template
      ? { template: body.template, data: body.data ?? {} }
      : { html: body.html! }

    // Generate PDF
    const doc = await pdf
      .from(source)
      .locale(body.locale ?? 'en-US')
      .theme(body.theme ?? 'modern-corporate-flat')
      .export(body.format ?? 'pdf')

    const bytes    = await doc.toBytes()
    const filename = body.filename ?? `document-${Date.now()}.pdf`

    // Option A: Return as S3 presigned URL
    if (body.s3 && process.env['OUTPUT_BUCKET']) {
      const key = body.s3Key ?? `generated/${filename}`

      await s3.send(new PutObjectCommand({
        Bucket:      process.env['OUTPUT_BUCKET'],
        Key:         key,
        Body:        bytes,
        ContentType: 'application/pdf',
        Metadata: {
          'generated-by': 'lombokpdf',
          'locale':       body.locale ?? 'en-US',
          'pages':        String(doc.pages()),
        },
      }))

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env['OUTPUT_BUCKET'], Key: key }),
        { expiresIn: 3600 }
      )

      return response(200, {
        url,
        key,
        pages:         doc.pages(),
        sizeBytes:     bytes.byteLength,
        processingMs:  Date.now() - start,
      })
    }

    // Option B: Return as base64 in response body
    const base64 = await doc.toBase64()

    return {
      statusCode: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-LombokPDF-Pages':   String(doc.pages()),
        'X-LombokPDF-Ms':      String(Date.now() - start),
      },
      body:            base64,
      isBase64Encoded: true,
    }

  } catch (err: any) {
    console.error('LombokPDF Lambda error:', err)
    return response(500, { error: err.message ?? 'Internal error' })
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
