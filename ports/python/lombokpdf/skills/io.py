"""LombokPDF — IO skills (import/export) for the Python port."""

from __future__ import annotations
from typing import Any, Optional, Union


def markdown_to_html(md: str) -> str:
    """Convert GitHub-Flavored Markdown to HTML."""
    try:
        import markdown
    except ImportError as e:
        raise ImportError(
            'lombokpdf/importMarkdown: markdown package is required. '
            'Install: pip install markdown'
        ) from e

    return markdown.markdown(
        md,
        extensions=['tables', 'fenced_code', 'toc', 'sane_lists', 'nl2br'],
    )


def docx_to_html(docx: Union[str, bytes]) -> str:
    """Convert a DOCX file (path or bytes) to HTML, preserving structure."""
    try:
        import mammoth
    except ImportError as e:
        raise ImportError(
            'lombokpdf/importDocx: python-mammoth is required. '
            'Install: pip install python-mammoth'
        ) from e

    style_map = """
p[style-name='Heading 1'] => h1:fresh
p[style-name='Heading 2'] => h2:fresh
p[style-name='Heading 3'] => h3:fresh
p[style-name='Title'] => h1.title:fresh
r[style-name='Strong'] => strong
r[style-name='Emphasis'] => em
""".strip()

    if isinstance(docx, str):
        with open(docx, 'rb') as f:
            result = mammoth.convert_to_html(f, style_map=style_map)
    else:
        import io
        result = mammoth.convert_to_html(io.BytesIO(docx), style_map=style_map)

    return _wrap_docx_html(result.value)


def csv_to_html(
    csv_content: str,
    options: Optional[dict[str, Any]] = None,
) -> str:
    """Convert CSV data to a styled HTML table."""
    import csv
    import io

    options = options or {}
    delimiter  = options.get('delimiter', ',')
    has_header = options.get('hasHeader', True)

    reader = csv.reader(io.StringIO(csv_content), delimiter=delimiter)
    rows = list(reader)

    if not rows:
        return '<table></table>'

    header = rows[0] if has_header else None
    body   = rows[1:] if has_header else rows

    html_parts = ['<table class="lombok-csv-table">']
    if header:
        html_parts.append('<thead><tr>')
        html_parts.extend(f'<th>{_escape(cell)}</th>' for cell in header)
        html_parts.append('</tr></thead>')

    html_parts.append('<tbody>')
    for row in body:
        html_parts.append('<tr>')
        html_parts.extend(f'<td>{_escape(cell)}</td>' for cell in row)
        html_parts.append('</tr>')
    html_parts.append('</tbody></table>')

    return _wrap_table_html(''.join(html_parts))


def _escape(text: str) -> str:
    return (text.replace('&', '&amp;').replace('<', '&lt;')
                .replace('>', '&gt;').replace('"', '&quot;'))


def _wrap_docx_html(body: str) -> str:
    return f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Noto Sans', sans-serif; font-size: 11pt; line-height: 1.6; }}
  h1 {{ font-size: 22pt; margin: 24pt 0 12pt; }}
  h2 {{ font-size: 16pt; margin: 20pt 0 10pt; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12pt 0; }}
  th, td {{ border: 1px solid #ddd; padding: 6pt 10pt; }}
  @page {{ size: A4; margin: 20mm; }}
</style></head>
<body>{body}</body></html>'''


def _wrap_table_html(table_html: str) -> str:
    return f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Noto Sans', sans-serif; font-size: 10pt; }}
  .lombok-csv-table {{ width: 100%; border-collapse: collapse; }}
  .lombok-csv-table th {{ background: #1a73e8; color: #fff; padding: 6pt 10pt; }}
  .lombok-csv-table td {{ padding: 5pt 10pt; border-bottom: 1px solid #e5e7eb; }}
  @page {{ size: A4 landscape; margin: 15mm; }}
</style></head>
<body>{table_html}</body></html>'''
