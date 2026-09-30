"""LombokPDF — Shared type definitions for the Python port."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Literal, Optional, Union

ExportFormat = Literal['pdf', 'pdf/a-1b', 'pdf/a-2b', 'pdf/ua', 'png', 'svg']

PageSize = Union[
    Literal['A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid'],
    tuple[float, float],
]


@dataclass
class LombokPDFOptions:
    """Configuration options for a LombokPDF client instance."""
    locale:  str = 'en-US'
    theme:   str = 'modern-corporate-flat'
    debug:   bool = False
    timeout: int = 30_000


@dataclass
class PageConfig:
    """Page dimensions, orientation, and margins."""
    size:        PageSize = 'A4'
    orientation: Literal['portrait', 'landscape'] = 'portrait'
    margins:     Optional[dict[str, float]] = None


@dataclass
class PDFMetadata:
    """PDF document metadata fields."""
    title:             Optional[str] = None
    author:            Optional[str] = None
    subject:           Optional[str] = None
    keywords:          list[str] = field(default_factory=list)
    creator:           Optional[str] = None
    producer:          Optional[str] = None
    language:          Optional[str] = None


@dataclass
class EmbedPosition:
    """Where to embed a chart or image on the page."""
    page:   int = 1
    x:      float = 40
    y:      float = 40
    width:  Optional[float] = None
    height: Optional[float] = None
    fit:    Literal['fill', 'contain', 'cover'] = 'contain'


# Source type — a dict describing where the document content comes from.
# One of: {'html': str}, {'markdown': str}, {'template': str, 'data': dict},
#         {'file': str}, {'url': str}, {'docx': bytes}, {'csv': str}
Source = dict[str, Any]


@dataclass
class SupportMatrix:
    """Feature support matrix for the current runtime."""
    css_paged_media: bool
    flexbox:         bool
    grid:            bool
    mathml:          bool = True
    svg:             bool = True
    bidi:            bool = True
    harfbuzz:        bool = True
    wasm:            bool = True
    locales:         list[str] = field(default_factory=list)
