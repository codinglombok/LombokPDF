"""
LombokPDF — Python Port
Lightweight, elegant PDF generation. Apache 2.0.

Usage:
    from lombokpdf import LombokPDF

    doc = LombokPDF().from_html('<h1>Hello</h1>').locale('id-ID').export('pdf')
    doc.save('output.pdf')

GitHub: https://github.com/codinglombok/lombokpdf
Docs:   https://docs.lombokpdf.dev
"""

from lombokpdf._client import LombokPDF
from lombokpdf._document import Document
from lombokpdf._builder import Builder
from lombokpdf._locale import locale, resolve_locale
from lombokpdf._version import __version__

__all__ = [
    'LombokPDF',
    'Document',
    'Builder',
    'locale',
    'resolve_locale',
    '__version__',
]
