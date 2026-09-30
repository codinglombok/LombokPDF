"""
LombokPDF — Django Adapter
Package: lombokpdf-django

Install:
    pip install lombokpdf lombokpdf-django

Setup (settings.py):
    INSTALLED_APPS = [..., 'lombokpdf_django']
    LOMBOKPDF = {
        'DEFAULT_LOCALE': 'id-ID',
        'DEFAULT_THEME':  'modern-corporate-flat',
        'TIMEOUT_MS':     30_000,
    }

Usage (views.py):
    from lombokpdf_django import render_pdf

    def invoice_view(request, pk):
        order = get_object_or_404(Order, pk=pk)
        return render_pdf(
            request,
            template='invoice',
            data={'company': settings.COMPANY_NAME, 'order': order},
            locale='id-ID',
            filename=f'invoice-{order.pk}.pdf',
        )
"""

from __future__ import annotations
from typing import Any, Optional
from functools import lru_cache

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.core.exceptions import ImproperlyConfigured


@lru_cache(maxsize=1)
def _get_config() -> dict[str, Any]:
    config = getattr(settings, 'LOMBOKPDF', {})
    return {
        'default_locale': config.get('DEFAULT_LOCALE', 'en-US'),
        'default_theme':  config.get('DEFAULT_THEME', 'modern-corporate-flat'),
        'timeout_ms':      config.get('TIMEOUT_MS', 30_000),
    }


@lru_cache(maxsize=1)
def _get_client():
    try:
        from lombokpdf import LombokPDF
    except ImportError as e:
        raise ImproperlyConfigured(
            'lombokpdf is required for lombokpdf_django. Install: pip install lombokpdf'
        ) from e

    config = _get_config()
    return LombokPDF(
        locale=config['default_locale'],
        theme=config['default_theme'],
        timeout=config['timeout_ms'],
    )


def render_pdf(
    request: HttpRequest,
    *,
    template: Optional[str] = None,
    html: Optional[str] = None,
    data: Optional[dict[str, Any]] = None,
    locale: Optional[str] = None,
    theme: Optional[str] = None,
    filename: str = 'document.pdf',
    inline: bool = True,
    export_format: str = 'pdf',
) -> HttpResponse:
    """
    Render a LombokPDF template or HTML string and return an HttpResponse.

    Args:
        request: The Django request (unused directly, kept for view signature consistency)
        template: Named built-in template (e.g. 'invoice') or custom file path
        html: Raw HTML string (alternative to template)
        data: Template data dictionary
        locale: BCP 47 locale tag (defaults to LOMBOKPDF.DEFAULT_LOCALE setting)
        theme: LombokCSS theme name
        filename: Filename for Content-Disposition header
        inline: If True, display inline in browser; if False, force download
        export_format: 'pdf' | 'pdf/a-1b' | 'pdf/a-2b' | 'pdf/ua'

    Returns:
        HttpResponse with application/pdf content type
    """
    config = _get_config()
    client = _get_client()

    if template:
        builder = client.from_template(template, data or {})
    elif html:
        builder = client.from_html(html)
    else:
        raise ValueError('render_pdf requires either template= or html=')

    doc = (
        builder
        .locale(locale or config['default_locale'])
        .export(export_format)
    )

    pdf_bytes = doc.to_bytes()

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    disposition = 'inline' if inline else 'attachment'
    response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
    response['X-LombokPDF-Pages'] = str(doc.pages())

    return response


class LombokPDFResponse(HttpResponse):
    """
    Class-based alternative for use in Django CBVs.

    Example:
        class InvoicePDFView(View):
            def get(self, request, pk):
                order = get_object_or_404(Order, pk=pk)
                return LombokPDFResponse(
                    template='invoice',
                    data={'order': order},
                    locale='id-ID',
                    filename=f'invoice-{pk}.pdf',
                )
    """

    def __init__(
        self,
        template: Optional[str] = None,
        html: Optional[str] = None,
        data: Optional[dict[str, Any]] = None,
        locale: Optional[str] = None,
        filename: str = 'document.pdf',
        inline: bool = True,
        **kwargs: Any,
    ) -> None:
        config = _get_config()
        client = _get_client()

        builder = client.from_template(template, data or {}) if template else client.from_html(html or '')
        doc = builder.locale(locale or config['default_locale']).export('pdf')

        super().__init__(doc.to_bytes(), content_type='application/pdf', **kwargs)
        disposition = 'inline' if inline else 'attachment'
        self['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        self['X-LombokPDF-Pages'] = str(doc.pages())
