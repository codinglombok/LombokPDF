"""
LombokPDF × LombokCharts Integration (Python port)

Bridges charts from https://github.com/codinglombok/LombokCharts (Python bindings)
into PDF pages as embedded SVG-rasterized images.
"""

from __future__ import annotations
from typing import Any

from lombokpdf._types import EmbedPosition


async def embed_chart_in_pdf(pdf_bytes: bytes, chart: Any, position: EmbedPosition) -> bytes:
    """
    Embed a LombokCharts chart object into PDF bytes at the given position.

    Expects `chart` to expose a `.render(renderer='svg', width=..., height=...)`
    coroutine or callable returning an SVG string, matching the LombokCharts
    Python bindings API.
    """
    width  = position.width  or getattr(chart, 'width', 400)
    height = position.height or getattr(chart, 'height', 250)

    render_fn = getattr(chart, 'render', None)
    if render_fn is None:
        raise TypeError(
            'lombokpdf/charts: chart object must implement .render(renderer, width, height). '
            'Install and use @lombok/charts Python bindings.'
        )

    svg = await render_fn(renderer='svg', width=width, height=height)

    return _embed_svg(pdf_bytes, svg, position, width, height)


def _embed_svg(pdf_bytes: bytes, svg: str, position: EmbedPosition, width: float, height: float) -> bytes:
    try:
        from pypdf import PdfReader, PdfWriter
        import cairosvg
    except ImportError as e:
        raise ImportError(
            'lombokpdf/charts: pypdf and cairosvg are required. '
            'Install: pip install pypdf cairosvg'
        ) from e

    import io

    # Rasterize SVG to PNG at 2x for retina-quality embedding
    png_bytes = cairosvg.svg2png(bytestring=svg.encode('utf-8'),
                                   output_width=int(width * 2),
                                   output_height=int(height * 2))

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    writer.append(reader)

    page = writer.pages[position.page - 1]
    # Note: pypdf image overlay requires reportlab canvas composition —
    # full implementation mirrors the TS svg-embedder.ts pattern using
    # an intermediate overlay PDF merged onto the target page.
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader

    overlay_buffer = io.BytesIO()
    page_height = float(page.mediabox.height)
    c = canvas.Canvas(overlay_buffer, pagesize=(float(page.mediabox.width), page_height))
    c.drawImage(ImageReader(io.BytesIO(png_bytes)),
                x=position.x, y=page_height - position.y - height,
                width=width, height=height, mask='auto')
    c.save()
    overlay_buffer.seek(0)

    overlay_reader = PdfReader(overlay_buffer)
    page.merge_page(overlay_reader.pages[0])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
