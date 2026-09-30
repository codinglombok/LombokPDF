import type { Skill } from '../../types.js'
import type { Document } from '../../core/Document.js'

// ─── PKCS#7 Digital Signature ─────────────────────────────────────────────────

export interface SignOptions {
  /** Path to PKCS#12 (.p12) certificate file, or raw DER bytes */
  cert: string | Uint8Array
  /** Certificate password */
  pass: string
  /** Visible signature field name (if omitted, invisible signature) */
  fieldName?: string
  /** Reason for signing */
  reason?: string
  /** Contact info */
  contactInfo?: string
  /** Location string */
  location?: string
}

/**
 * Apply a PKCS#7 digital signature to a PDF document.
 *
 * @example
 * ```typescript
 * import { signPKCS7 } from 'lombokpdf/skills/security'
 *
 * // As a standalone function
 * const signed = await signPKCS7(doc, { cert: './cert.p12', pass: process.env.CERT_PASS })
 *
 * // As a pipeable skill
 * const doc = await pdf.from({ html }).pipe(signPKCS7({ cert: './cert.p12', pass: '...' })).export()
 * ```
 */
export function signPKCS7(options: SignOptions): Skill
export function signPKCS7(doc: Document, options: SignOptions): Promise<Document>
export function signPKCS7(
  docOrOptions: Document | SignOptions,
  options?: SignOptions,
): Skill | Promise<Document> {
  // Overload: called as pipe(signPKCS7({ cert, pass }))
  if (!options) {
    const opts = docOrOptions as SignOptions
    return {
      name: 'signPKCS7',
      async apply(doc: Document): Promise<Document> {
        return _doSign(doc, opts)
      },
    }
  }
  // Overload: called as signPKCS7(doc, { cert, pass })
  return _doSign(docOrOptions as Document, options)
}

async function _doSign(doc: Document, opts: SignOptions): Promise<Document> {
  const { PKCS7Signer } = await import('./pkcs7.js')
  return PKCS7Signer.sign(doc, opts)
}

// ─── AES-256 Encryption ────────────────────────────────────────────────────────

export interface EncryptOptions {
  /** Password for opening the document (user password) */
  userPassword?: string
  /** Owner/admin password */
  ownerPassword: string
  /** Allowed permissions (default: all denied except view) */
  permissions?: Array<'print' | 'print-high' | 'copy' | 'modify' | 'annotate' | 'form-fill'>
  /** Encryption algorithm (default: 'aes-256') */
  algorithm?: 'aes-256' | 'aes-128' | 'rc4-128'
}

/**
 * Encrypt a PDF with AES-256 and configurable permissions.
 */
export function encryptAES(options: EncryptOptions): Skill
export function encryptAES(doc: Document, options: EncryptOptions): Promise<Document>
export function encryptAES(
  docOrOptions: Document | EncryptOptions,
  options?: EncryptOptions,
): Skill | Promise<Document> {
  if (!options) {
    const opts = docOrOptions as EncryptOptions
    return {
      name: 'encryptAES',
      async apply(doc: Document): Promise<Document> {
        return _doEncrypt(doc, opts)
      },
    }
  }
  return _doEncrypt(docOrOptions as Document, options)
}

async function _doEncrypt(doc: Document, opts: EncryptOptions): Promise<Document> {
  const { AESEncryptor } = await import('./aes-encryptor.js')
  return AESEncryptor.encrypt(doc, opts)
}

// ─── Redaction ────────────────────────────────────────────────────────────────

export interface RedactOptions {
  /** Text patterns to redact (strings or regex) */
  patterns?: Array<string | RegExp>
  /** Page regions to redact: [page, x, y, width, height] */
  regions?: Array<[page: number, x: number, y: number, w: number, h: number]>
  /** Fill color for redacted areas (default: '#000000') */
  fillColor?: string
}

/**
 * Permanently redact text patterns or page regions (GDPR-compliant).
 * Redaction is irreversible — the content is removed from the PDF.
 */
export async function redact(doc: Document, options: RedactOptions): Promise<Document> {
  const { PDFRedactor } = await import('./redactor.js')
  return PDFRedactor.redact(doc, options)
}

// ─── Signature Verification ───────────────────────────────────────────────────

export interface VerifyResult {
  valid:         boolean
  signerName?:   string
  signedAt?:     Date
  reason?:       string
  errors:        string[]
}

/**
 * Verify all PKCS#7 digital signatures in a document.
 */
export async function verify(doc: Document): Promise<VerifyResult[]> {
  const { SignatureVerifier } = await import('./verifier.js')
  return SignatureVerifier.verify(doc)
}
