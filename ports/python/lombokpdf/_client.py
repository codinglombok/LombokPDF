"""LombokPDF Python client — wraps the WASM core via wasmtime."""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Union, Optional

from lombokpdf._builder import Builder
from lombokpdf._engine import LLEEngine
from lombokpdf._locale import resolve_locale
from lombokpdf._types import LombokPDFOptions, Source, SupportMatrix
from lombokpdf._version import __version__


class LombokPDF:
    """
    Main entry point for LombokPDF Python port.

    Example::

        from lombokpdf import LombokPDF

        pdf = LombokPDF()

        # From HTML
        doc = pdf.from_html('<h1>Hello</h1>').locale('en-US').export('pdf')
        doc.save('output.pdf')

        # From template
        doc = (pdf
            .from_template('invoice', data={'company': 'Acme', 'total': 1500})
            .locale('id-ID')
            .export('pdf'))
        doc.save('invoice.pdf')

        # Arabic RTL
        doc = pdf.from_html('<h1>مرحباً</h1>').locale('ar-SA').export('pdf')
        doc.save('arabic.pdf')
    """

    def __init__(
        self,
        locale: str = 'en-US',
        theme:  str = 'modern-corporate-flat',
        debug:  bool = False,
        timeout: int = 30_000,
    ) -> None:
        self._options = LombokPDFOptions(
            locale=locale,
            theme=theme,
            debug=debug,
            timeout=timeout,
        )
        self._engine = LLEEngine(self._options)

    def from_(self, source: Source) -> Builder:
        """Begin a fluent builder chain from a source."""
        return Builder(source, self._engine, self._options)

    def from_html(self, html: str, base_url: Optional[str] = None) -> Builder:
        """Shorthand: generate PDF from HTML string."""
        return self.from_({'html': html, 'base_url': base_url})

    def from_markdown(self, md: str) -> Builder:
        """Shorthand: generate PDF from Markdown string."""
        return self.from_({'markdown': md})

    def from_template(self, name: str, data: Optional[dict] = None) -> Builder:
        """Shorthand: generate PDF from a named template."""
        return self.from_({'template': name, 'data': data or {}})

    def from_file(self, path: Union[str, Path]) -> Builder:
        """Shorthand: generate PDF from a file (HTML, MD, or DOCX)."""
        return self.from_({'file': str(path)})

    def from_url(self, url: str) -> Builder:
        """Shorthand: fetch URL and generate PDF."""
        return self.from_({'url': url})

    @staticmethod
    def version() -> str:
        """Return the LombokPDF version string."""
        return __version__

    @staticmethod
    def supported() -> SupportMatrix:
        """Return the feature support matrix for this runtime."""
        from lombokpdf._locale import resolve_locale
        locs = resolve_locale.available_locales()
        return SupportMatrix(
            css_paged_media=True,
            flexbox=True,
            grid=True,
            mathml=True,
            svg=True,
            bidi=True,
            harfbuzz=True,
            wasm=True,
            locales=locs,
        )
