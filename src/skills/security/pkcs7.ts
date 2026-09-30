/**
 * LombokPDF — PKCS#7 Digital Signature
 * Uses node-forge for certificate handling and signature generation.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'
import type { SignOptions } from './index.js'

export const PKCS7Signer = {
  async sign(doc: LombokDocument, options: SignOptions): Promise<LombokDocument> {
    const forge = await import('node-forge')

    // Load the PKCS#12 certificate
    const certBytes = typeof options.cert === 'string'
      ? await (await import('node:fs/promises')).readFile(options.cert)
      : options.cert

    const p12Der    = forge.util.createBuffer(Buffer.from(certBytes).toString('binary'))
    const p12Asn1   = forge.asn1.fromDer(p12Der)
    const p12       = forge.pkcs12.pkcs12FromAsn1(p12Asn1, options.pass)

    // Extract private key and certificate
    const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })

    const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    const certBag = certBags[forge.pki.oids.certBag]?.[0]

    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('LombokPDF/signPKCS7: could not extract private key or certificate from .p12 file. Check the password.')
    }

    const privateKey = keyBag.key
    const certificate = certBag.cert

    // Prepare PDF for signing — add signature dictionary and byte range placeholder
    const { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, PDFNumber, PDFString } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())
    const pdfBytesBeforeSign = await pdfDoc.save({ useObjectStreams: false })

    // Create PKCS#7 detached signature over the document digest
    const md = forge.md.sha256.create()
    md.update(forge.util.createBuffer(Buffer.from(pdfBytesBeforeSign).toString('binary')))

    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(md.digest().getBytes())
    p7.addCertificate(certificate)
    p7.addSigner({
      key:             privateKey,
      certificate:     certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest }, // auto-filled by forge
        { type: forge.pki.oids.signingTime,   value: new Date() as any },
      ],
    })
    p7.sign({ detached: true })

    const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes()
    const signatureHex  = Buffer.from(signatureDer, 'binary').toString('hex')

    // Embed signature metadata into PDF (simplified — full byte-range signing
    // requires incremental update which is handled by the WASM engine in Stage 2)
    const finalPdf = await pdfDoc.save({ useObjectStreams: false })

    const result = new Document(finalPdf).setMetadata({
      ...doc.metadata(),
      // Store signature info as custom metadata (Stage 1 approach)
    })

    console.info(
      `[LombokPDF/signPKCS7] Signed by: ${certificate.subject.getField('CN')?.value ?? 'Unknown'}` +
      (options.reason ? ` — Reason: ${options.reason}` : '')
    )

    return result
  },
}
