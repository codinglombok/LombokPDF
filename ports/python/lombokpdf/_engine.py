"""
LombokPDF — LombokLayout Engine (LLE) Bridge for Python

Calls the shared WASM core via wasmtime-py. Stage 1 falls back to a
pure-Python renderer (reportlab-backed) when the WASM asset is unavailable;
Stage 2 uses the full WASM LLE for CSS Paged Media, HarfBuzz shaping, and
Unicode BiDi/line-breaking.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Optional

from lombokpdf._types import LombokPDFOptions


class LLEEngine:
    """
    Rendering engine — WASM-first with a Python fallback backend.

    This mirrors the architecture of the TypeScript canonical port's
    `LLEEngine` class: callers never interact with the backend directly,
    only `Builder` does, via `render()`.
    """

    def __init__(self, options: LombokPDFOptions) -> None:
        self._options = options
        self._wasm_instance: Optional[Any] = None

    async def render(self, html: str, render_opts: dict[str, Any]) -> bytes:
        """Render HTML to output-format bytes (PDF/PNG/SVG)."""
        backend = self._get_backend()
        return await backend.render(html, render_opts)

    def _get_backend(self) -> "_Backend":
        try:
            return self._get_wasm_backend()
        except Exception:
            # WASM asset unavailable — use Python fallback (Stage 1)
            return _PythonBackend(self._options)

    def _get_wasm_backend(self) -> "_Backend":
        try:
            import wasmtime  # noqa: F401
        except ImportError as e:
            raise RuntimeError(
                'wasmtime is required for the WASM backend. Install: pip install wasmtime'
            ) from e

        if self._wasm_instance is None:
            wasm_path = Path(__file__).parent / 'assets' / 'lombokpdf.wasm'
            if not wasm_path.exists():
                raise FileNotFoundError(f'LLE WASM asset not found at {wasm_path}')
            self._wasm_instance = _load_wasm(wasm_path)

        return _WASMBackend(self._wasm_instance)


class _Backend:
    async def render(self, html: str, opts: dict[str, Any]) -> bytes:
        raise NotImplementedError


class _WASMBackend(_Backend):
    def __init__(self, instance: Any) -> None:
        self._instance = instance

    async def render(self, html: str, opts: dict[str, Any]) -> bytes:
        # Marshal strings into WASM linear memory, call lombok_render_html,
        # copy the resulting PDF bytes back out, then free WASM allocations.
        # See docs/MASTERPROMPT_STAGES.md — Stage 2 WASM ABI reference.
        raise NotImplementedError(
            'WASM backend rendering ships in Stage 2. Use the Python fallback backend for now.'
        )


class _PythonBackend(_Backend):
    """
    Stage 1 fallback renderer using reportlab for basic HTML → PDF.
    Provides working output while the WASM core matures.
    """

    def __init__(self, options: LombokPDFOptions) -> None:
        self._options = options

    async def render(self, html: str, opts: dict[str, Any]) -> bytes:
        try:
            from reportlab.lib.pagesizes import A4, LETTER
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib.units import mm
        except ImportError as e:
            raise RuntimeError(
                'reportlab is required for the Python fallback renderer. '
                'Install: pip install reportlab'
            ) from e

        import io
        from bs4 import BeautifulSoup

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                 topMargin=20 * mm, bottomMargin=20 * mm,
                                 leftMargin=20 * mm, rightMargin=20 * mm)
        styles = getSampleStyleSheet()
        story: list[Any] = []

        soup = BeautifulSoup(html, 'html.parser')
        body = soup.body or soup

        for el in body.find_all(['h1', 'h2', 'h3', 'p', 'li'], recursive=True):
            text = el.get_text(strip=True)
            if not text:
                continue
            style_name = {
                'h1': 'Title', 'h2': 'Heading2', 'h3': 'Heading3',
                'p': 'BodyText', 'li': 'BodyText',
            }.get(el.name, 'BodyText')
            story.append(Paragraph(text, styles[style_name]))
            story.append(Spacer(1, 6))

        doc.build(story)
        return buffer.getvalue()


def _load_wasm(path: Path) -> Any:
    import wasmtime
    engine = wasmtime.Engine()
    module = wasmtime.Module.from_file(engine, str(path))
    store = wasmtime.Store(engine)
    return wasmtime.Instance(store, module, [])
