"""LombokPDF — Rendered document wrapper for the Python port."""

from __future__ import annotations
import base64
from pathlib import Path
from typing import Union

from lombokpdf._types import PDFMetadata


class Document:
    """
    A rendered PDF document. Returned by `Builder.export()`.

    Example::

        doc = pdf.from_html('<h1>Hello</h1>').export('pdf')
        doc.save('output.pdf')
        pdf_bytes = doc.to_bytes()
    """

    def __init__(self, raw: bytes, metadata: PDFMetadata | None = None) -> None:
        self._raw = raw
        self._metadata = metadata or PDFMetadata()

    def save(self, path: Union[str, Path]) -> None:
        """Write the PDF to disk."""
        Path(path).write_bytes(self._raw)

    def to_bytes(self) -> bytes:
        """Return the raw PDF bytes."""
        return self._raw

    def to_base64(self) -> str:
        """Return base64-encoded PDF content."""
        return base64.b64encode(self._raw).decode('ascii')

    def to_data_uri(self) -> str:
        """Return a data: URI suitable for embedding in HTML/browsers."""
        return f'data:application/pdf;base64,{self.to_base64()}'

    def pages(self) -> int:
        """Return the number of pages in this PDF (parsed from /Count)."""
        text = self._raw.decode('latin1', errors='ignore')
        import re
        match = re.search(r'/Count\s+(\d+)', text)
        return int(match.group(1)) if match else 0

    def metadata(self) -> PDFMetadata:
        """Return the document's metadata."""
        return self._metadata

    def set_metadata(self, **kwargs: object) -> "Document":
        """Return a new Document with updated metadata fields."""
        new_meta = PDFMetadata(**{**self._metadata.__dict__, **kwargs})
        return Document(self._raw, new_meta)

    @property
    def size(self) -> int:
        """Size of the PDF in bytes."""
        return len(self._raw)

    def __repr__(self) -> str:
        return f'<lombokpdf.Document pages={self.pages()} size={self.size}B>'
