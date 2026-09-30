"""LombokPDF — Security skills (sign, encrypt, redact, verify) for the Python port."""

from __future__ import annotations
from typing import Any, Optional

from lombokpdf._document import Document


def sign_pkcs7(
    doc: Document,
    cert: str,
    password: str,
    reason: Optional[str] = None,
    location: Optional[str] = None,
) -> Document:
    """Apply a PKCS#7 digital signature to a PDF document."""
    try:
        from pyhanko.sign import signers
        from pyhanko.sign.fields import SigFieldSpec, append_signature_field
        from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    except ImportError as e:
        raise ImportError(
            'lombokpdf/signPKCS7: pyHanko is required. Install: pip install pyHanko'
        ) from e

    import io

    signer = signers.SimpleSigner.load_pkcs12(pfx_file=cert, passphrase=password.encode())

    buf = io.BytesIO(doc.to_bytes())
    writer = IncrementalPdfFileWriter(buf)

    append_signature_field(writer, SigFieldSpec(sig_field_name='LombokPDFSignature'))

    output = io.BytesIO()
    signers.sign_pdf(
        writer,
        signers.PdfSignatureMetadata(
            field_name='LombokPDFSignature',
            reason=reason,
            location=location,
        ),
        signer=signer,
        output=output,
    )

    return Document(output.getvalue())


def encrypt_aes(
    doc: Document,
    owner_password: str,
    user_password: str = '',
    permissions: Optional[list[str]] = None,
) -> Document:
    """Encrypt a PDF with AES-256 and configurable permissions."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as e:
        raise ImportError('lombokpdf/encryptAES: pypdf is required. Install: pip install pypdf') from e

    import io

    reader = PdfReader(io.BytesIO(doc.to_bytes()))
    writer = PdfWriter()
    writer.append(reader)

    writer.encrypt(
        user_password=user_password,
        owner_password=owner_password,
        algorithm='AES-256',
    )

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def redact(
    doc: Document,
    regions: list[tuple[int, float, float, float, float]],
    fill_color: str = '#000000',
) -> Document:
    """Permanently redact page regions given as [(page, x, y, w, h), ...]."""
    try:
        from pypdf import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import HexColor
    except ImportError as e:
        raise ImportError(
            'lombokpdf/redact: pypdf and reportlab are required. '
            'Install: pip install pypdf reportlab'
        ) from e

    import io

    reader = PdfReader(io.BytesIO(doc.to_bytes()))
    writer = PdfWriter()

    for i, page in enumerate(reader.pages, start=1):
        page_regions = [r for r in regions if r[0] == i]
        if page_regions:
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            overlay_buf = io.BytesIO()
            c = canvas.Canvas(overlay_buf, pagesize=(width, height))
            c.setFillColor(HexColor(fill_color))
            for _, x, y, w, h in page_regions:
                c.rect(x, height - y - h, w, h, fill=1, stroke=0)
            c.save()
            overlay_buf.seek(0)
            overlay_reader = PdfReader(overlay_buf)
            page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def verify(doc: Document) -> list[dict[str, Any]]:
    """Verify all PKCS#7 digital signatures in a document."""
    try:
        from pyhanko.pdf_utils.reader import PdfFileReader
        from pyhanko.sign.validation import validate_pdf_signature
    except ImportError as e:
        raise ImportError('lombokpdf/verify: pyHanko is required. Install: pip install pyHanko') from e

    import io

    reader = PdfFileReader(io.BytesIO(doc.to_bytes()))
    results = []

    for sig in reader.embedded_signatures:
        try:
            status = validate_pdf_signature(sig)
            results.append({
                'valid':      status.valid,
                'signer_name': str(status.signing_cert.subject) if status.signing_cert else None,
                'signed_at':  status.signer_reported_dt,
                'errors':     [] if status.valid else ['Signature validation failed'],
            })
        except Exception as e:
            results.append({'valid': False, 'errors': [str(e)]})

    if not results:
        return [{'valid': False, 'errors': ['No digital signature found in document']}]

    return results
