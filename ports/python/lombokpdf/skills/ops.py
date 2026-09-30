"""LombokPDF — Document operation skills (merge, split, watermark, compress) for the Python port."""

from __future__ import annotations
from typing import Any, Optional

from lombokpdf._document import Document


def merge(docs: list[Document]) -> Document:
    """Merge multiple Document instances into one."""
    if not docs:
        raise ValueError('lombokpdf/merge: no documents provided')
    if len(docs) == 1:
        return docs[0]

    try:
        from pypdf import PdfWriter, PdfReader
    except ImportError as e:
        raise ImportError('lombokpdf/merge: pypdf is required. Install: pip install pypdf') from e

    import io

    writer = PdfWriter()
    for doc in docs:
        reader = PdfReader(io.BytesIO(doc.to_bytes()))
        for page in reader.pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def split(doc: Document, pages: str) -> Document:
    """Split a document by page range string, e.g. '1-5', '2,4,6', '3-'."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as e:
        raise ImportError('lombokpdf/split: pypdf is required. Install: pip install pypdf') from e

    import io

    reader = PdfReader(io.BytesIO(doc.to_bytes()))
    total  = len(reader.pages)
    indices = _parse_page_range(pages, total)

    writer = PdfWriter()
    for idx in indices:
        writer.add_page(reader.pages[idx])

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def watermark(
    doc: Document,
    text: str = 'WATERMARK',
    opacity: float = 0.15,
    rotation: int = 45,
    font_size: int = 60,
    color: str = '#888888',
) -> Document:
    """Add a diagonal text watermark to all pages."""
    try:
        from pypdf import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import HexColor
    except ImportError as e:
        raise ImportError(
            'lombokpdf/watermark: pypdf and reportlab are required. '
            'Install: pip install pypdf reportlab'
        ) from e

    import io

    reader = PdfReader(io.BytesIO(doc.to_bytes()))
    writer = PdfWriter()

    for page in reader.pages:
        width, height = float(page.mediabox.width), float(page.mediabox.height)

        overlay_buf = io.BytesIO()
        c = canvas.Canvas(overlay_buf, pagesize=(width, height))
        c.saveState()
        c.setFillColor(HexColor(color), alpha=opacity)
        c.setFont('Helvetica-Bold', font_size)
        c.translate(width / 2, height / 2)
        c.rotate(rotation)
        text_width = c.stringWidth(text, 'Helvetica-Bold', font_size)
        c.drawString(-text_width / 2, 0, text)
        c.restoreState()
        c.save()
        overlay_buf.seek(0)

        overlay_reader = PdfReader(overlay_buf)
        page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def compress(doc: Document, image_quality: int = 80) -> Document:
    """Compress a PDF by downsampling embedded images."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as e:
        raise ImportError('lombokpdf/compress: pypdf is required. Install: pip install pypdf') from e

    import io

    reader = PdfReader(io.BytesIO(doc.to_bytes()))
    writer = PdfWriter()
    writer.append(reader)

    for page in writer.pages:
        for img in page.images:
            img.replace(img.image, quality=image_quality)

    output = io.BytesIO()
    writer.write(output)
    return Document(output.getvalue())


def _parse_page_range(pages: str, total: int) -> list[int]:
    trimmed = pages.strip().lower()
    if trimmed in ('all', ''):
        return list(range(total))

    indices: set[int] = set()
    for part in trimmed.split(','):
        p = part.strip()
        if '-' in p:
            start_str, end_str = p.split('-')
            start = 1 if start_str.strip() == '' else int(start_str)
            end   = total if end_str.strip() == '' else int(end_str)
            for i in range(max(1, start) - 1, min(total, end)):
                indices.add(i)
        else:
            n = int(p)
            if 1 <= n <= total:
                indices.add(n - 1)

    return sorted(indices)
