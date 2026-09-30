"""LombokPDF — Fluent builder chain for the Python port."""

from __future__ import annotations
from pathlib import Path
from typing import Any, Callable, Optional, Union

from lombokpdf._document import Document
from lombokpdf._engine import LLEEngine
from lombokpdf._locale import LocaleConfig, resolve_locale
from lombokpdf._types import ExportFormat, LombokPDFOptions, PageConfig, PDFMetadata, EmbedPosition


class Builder:
    """
    Fluent builder returned by `LombokPDF.from_()` and its shorthand methods.
    All methods return `self` for chaining; call `.export()` to produce a Document.

    Example::

        doc = (pdf
            .from_html('<h1>مرحباً</h1>')
            .locale('ar-SA')
            .theme('resonant-stark')
            .metadata(title='Arabic Report')
            .export('pdf'))
    """

    def __init__(
        self,
        source: dict[str, Any],
        engine: LLEEngine,
        default_options: LombokPDFOptions,
    ) -> None:
        self._source = source
        self._engine = engine
        self._locale_cfg: LocaleConfig = resolve_locale(default_options.locale)
        self._theme = default_options.theme
        self._page = PageConfig()
        self._metadata: dict[str, Any] = {}
        self._embeds: list[tuple[Any, EmbedPosition]] = []
        self._skills: list[Any] = []

    def template(self, name: str, data: Optional[dict[str, Any]] = None) -> "Builder":
        """Override the template and optionally provide data."""
        self._source = {'template': name, 'data': data or {}}
        return self

    def locale(self, loc: Union[str, LocaleConfig]) -> "Builder":
        """Set locale (BCP 47 tag or full LocaleConfig)."""
        self._locale_cfg = resolve_locale(loc)
        return self

    def theme(self, name: str) -> "Builder":
        """Set LombokCSS design theme."""
        self._theme = name
        return self

    def page(self, **kwargs: Any) -> "Builder":
        """Override page size, orientation, or margins."""
        for k, v in kwargs.items():
            setattr(self._page, k, v)
        return self

    def metadata(self, **kwargs: Any) -> "Builder":
        """Set PDF metadata (title, author, etc.)."""
        self._metadata.update(kwargs)
        return self

    def embed(self, chart: Any, **position_kwargs: Any) -> "Builder":
        """Embed a LombokCharts chart into the PDF (requires @lombok/charts equivalent)."""
        self._embeds.append((chart, EmbedPosition(**position_kwargs)))
        return self

    def pipe(self, skill: Any) -> "Builder":
        """Attach a skill (post-processor) to the pipeline."""
        self._skills.append(skill)
        return self

    async def export_async(self, export_format: ExportFormat = 'pdf') -> Document:
        """Async variant of export() — use in async contexts."""
        html = await self._resolve_source()

        raw = await self._engine.render(html, {
            'locale':   self._locale_cfg.__dict__,
            'theme':    self._theme,
            'page':     self._page.__dict__,
            'format':   export_format,
            'metadata': self._metadata,
        })

        for chart, position in self._embeds:
            raw = await self._embed_chart(raw, chart, position)

        doc = Document(raw, PDFMetadata(**self._metadata) if self._metadata else None)

        for skill in self._skills:
            doc = await skill.apply(doc)

        return doc

    def export(self, export_format: ExportFormat = 'pdf') -> Document:
        """
        Render the document and run all piped skills.
        Synchronous wrapper around `export_async()` for convenience.
        """
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self.export_async(export_format))

    # ─── Private ──────────────────────────────────────────────────────────

    async def _resolve_source(self) -> str:
        src = self._source

        if 'html' in src:
            return src['html']
        if 'markdown' in src:
            from lombokpdf.skills.io import markdown_to_html
            return markdown_to_html(src['markdown'])
        if 'template' in src:
            from lombokpdf._templates import render_template
            return render_template(src['template'], src.get('data', {}), self._locale_cfg)
        if 'file' in src:
            return await self._load_file(src['file'])
        if 'docx' in src:
            from lombokpdf.skills.io import docx_to_html
            return docx_to_html(src['docx'])
        if 'csv' in src:
            from lombokpdf.skills.io import csv_to_html
            return csv_to_html(src['csv'], src.get('options', {}))
        if 'url' in src:
            return await self._fetch_url(src['url'])

        raise ValueError('lombokpdf: unknown source type — expected one of '
                          'html, markdown, template, file, docx, csv, url')

    async def _load_file(self, path: str) -> str:
        content = Path(path).read_text(encoding='utf-8')
        if path.endswith('.md'):
            from lombokpdf.skills.io import markdown_to_html
            return markdown_to_html(content)
        if path.endswith('.docx'):
            from lombokpdf.skills.io import docx_to_html
            return docx_to_html(Path(path).read_bytes())
        if path.endswith('.csv'):
            from lombokpdf.skills.io import csv_to_html
            return csv_to_html(content)
        return content

    async def _fetch_url(self, url: str) -> str:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text

    async def _embed_chart(self, raw: bytes, chart: Any, position: EmbedPosition) -> bytes:
        from lombokpdf._charts import embed_chart_in_pdf
        return await embed_chart_in_pdf(raw, chart, position)
