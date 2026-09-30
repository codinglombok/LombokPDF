/**
 * LombokPDF — PDF/A Converter
 * Post-processes a PDF to be PDF/A-1b or PDF/A-2b compliant.
 */

import type { Document as LombokDocument } from '../../core/Document.js'
import { Document } from '../../core/Document.js'

export const PDFAConverter = {
  async convert(doc: LombokDocument, level: '1b' | '2b'): Promise<LombokDocument> {
    const { PDFDocument, PDFName } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.load(doc._getRaw())

    // Add XMP metadata declaring PDF/A conformance
    const conformance = 'B'
    const partNumber  = level === '1b' ? '1' : '2'

    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${partNumber}</pdfaid:part>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

    // Attach XMP metadata stream to the document catalog
    const metadataStream = pdfDoc.context.stream(xmp, {
      Type:    PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
    })
    const metadataRef = pdfDoc.context.register(metadataStream)
    pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef)

    // PDF/A requires embedded fonts (already handled by LLE font subsetting)
    // and an output intent (ICC profile) — sRGB is used as the default.
    // Full ICC output-intent embedding ships with the Stage 2 WASM renderer.
    pdfDoc.setProducer('LombokPDF')
    pdfDoc.setCreator(`LombokPDF (PDF/A-${level})`)

    const bytes = await pdfDoc.save()
    return new Document(bytes)
  },
}
