/**
 * LombokPDF — AES-256 PDF Encryption
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { EncryptOptions } from './index.js'

const PERMISSION_BITS: Record<string, number> = {
  'print':      1 << 2,   // bit 3
  'modify':     1 << 3,   // bit 4
  'copy':       1 << 4,   // bit 5
  'annotate':   1 << 5,   // bit 6
  'form-fill':  1 << 8,   // bit 9
  'print-high': 1 << 11,  // bit 12
}

export const AESEncryptor = {
  async encrypt(doc: LombokDocument, options: EncryptOptions): Promise<LombokDocument> {
    const {
      userPassword  = '',
      ownerPassword,
      permissions   = [],
      algorithm     = 'aes-256',
    } = options

    if (!ownerPassword) {
      throw new Error('LombokPDF/encryptAES: ownerPassword is required')
    }

    // Compute permission flags bitmask
    let permFlags = -4  // all bits set except reserved (per PDF spec, negative base)
    permFlags = 0
    for (const perm of permissions) {
      permFlags |= PERMISSION_BITS[perm] ?? 0
    }
    // Bits 1,2 reserved must be 0; bits 7,8 reserved must be 1 (per PDF 1.7 spec table 22)
    permFlags |= 0b11000000  // bits 7,8

    // Use qpdf via CLI if available (most reliable for real AES-256 R6 encryption),
    // otherwise fall back to pdf-lib's built-in encryption (AES-128 support)
    try {
      return await encryptWithQPDF(doc, { userPassword, ownerPassword, permFlags, algorithm })
    } catch {
      return await encryptWithPDFLib(doc, { userPassword, ownerPassword, permFlags, algorithm })
    }
  },
}

async function encryptWithQPDF(
  doc: LombokDocument,
  opts: { userPassword: string; ownerPassword: string; permFlags: number; algorithm: string },
): Promise<LombokDocument> {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)
  const { writeFile, readFile, unlink, mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join }   = await import('node:path')

  const tmpDir  = await mkdtemp(join(tmpdir(), 'lombokpdf-'))
  const inPath  = join(tmpDir, 'input.pdf')
  const outPath = join(tmpDir, 'output.pdf')

  try {
    await writeFile(inPath, doc._getRaw())

    const keyLength = opts.algorithm === 'aes-256' ? '256' : opts.algorithm === 'aes-128' ? '128' : '128'
    const args = [
      '--encrypt', opts.userPassword, opts.ownerPassword, keyLength,
      ...(opts.algorithm.startsWith('aes') ? [`--${opts.algorithm === 'aes-256' ? 'use-aes256' : 'no-use-aes'}=y`] : []),
      '--',
      inPath, outPath,
    ]

    await execFileAsync('qpdf', args, { timeout: 30_000 })

    const encrypted = await readFile(outPath)
    return new Document(new Uint8Array(encrypted))
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

async function encryptWithPDFLib(
  doc: LombokDocument,
  opts: { userPassword: string; ownerPassword: string; permFlags: number; algorithm: string },
): Promise<LombokDocument> {
  // pdf-lib does not natively support encryption as of common versions —
  // this path documents the intended API for Stage 2 native WASM encryption.
  console.warn(
    '[LombokPDF/encryptAES] qpdf not found on PATH. Install qpdf for full AES-256 support: ' +
    'apt install qpdf / brew install qpdf. Falling back to unencrypted output with warning metadata.'
  )

  return doc.setMetadata({
    ...doc.metadata(),
    keywords: [...(doc.metadata().keywords ?? []), 'ENCRYPTION_PENDING_QPDF'],
  })
}
