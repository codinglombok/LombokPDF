"""
LombokPDF — Template Engine for the Python port.
Handlebars-compatible via Jinja2 (with a compatibility shim for {{#each}}/{{#if}} syntax),
YAML front-matter parsing, and locale-aware currency/date/percent filters.
"""

from __future__ import annotations
import re
from pathlib import Path
from typing import Any

import yaml
from babel.numbers import format_currency, format_percent
from babel.dates import format_date

from lombokpdf._locale import LocaleConfig

_TEMPLATES_DIR = Path(__file__).parent / 'templates'

_BUILTIN_TEMPLATES = [
    'invoice', 'report', 'legal', 'certificate', 'letter', 'resume',
    'ticket', 'label', 'receipt', 'newsletter', 'datasheet', 'booklet',
]


def render_template(name_or_path: str, data: dict[str, Any], locale: LocaleConfig) -> str:
    """
    Render a named built-in template (or custom file path) with the given data.
    Templates use Handlebars-style syntax: {{ var }}, {{#if}}, {{#each}}.
    """
    source = _load_template_source(name_or_path)
    front_matter, content = _parse_front_matter(source)

    merged_data = {**front_matter, **data}

    rendered_body = _render_handlebars(content, merged_data, locale)

    return _wrap_html(rendered_body, merged_data, locale)


def render_string(template_str: str, data: dict[str, Any], locale: LocaleConfig) -> str:
    """Render an arbitrary Handlebars-style template string."""
    return _render_handlebars(template_str, data, locale)


def _load_template_source(name_or_path: str) -> str:
    if '/' not in name_or_path and '\\' not in name_or_path:
        if name_or_path not in _BUILTIN_TEMPLATES:
            raise ValueError(
                f"lombokpdf: unknown template '{name_or_path}'. "
                f"Built-ins: {', '.join(_BUILTIN_TEMPLATES)}"
            )
        path = _TEMPLATES_DIR / name_or_path / 'template.html'
        return path.read_text(encoding='utf-8')

    return Path(name_or_path).read_text(encoding='utf-8')


def _parse_front_matter(source: str) -> tuple[dict[str, Any], str]:
    match = re.match(r'^---\n(.*?)\n---\n(.*)$', source, re.DOTALL)
    if not match:
        return {}, source
    front_matter = yaml.safe_load(match.group(1)) or {}
    return front_matter, match.group(2)


# ─── Minimal Handlebars-compatible renderer ───────────────────────────────────
# Supports: {{ var }}, {{ var | filter }}, {{#if x}}...{{/if}}, {{#each items}}...{{/each}}

_VAR_PATTERN   = re.compile(r'\{\{\s*([\w.]+)(?:\s*\|\s*(\w+)(?::(\S+))?)?\s*\}\}')
_IF_PATTERN    = re.compile(r'\{\{#if\s+([\w.]+)\}\}(.*?)\{\{/if\}\}', re.DOTALL)
_EACH_PATTERN  = re.compile(r'\{\{#each\s+([\w.]+)\}\}(.*?)\{\{/each\}\}', re.DOTALL)


def _render_handlebars(template: str, data: dict[str, Any], locale: LocaleConfig) -> str:
    # Process #each blocks first (may be nested inside #if, kept simple for Stage 1)
    def each_repl(m: re.Match) -> str:
        key, block = m.group(1), m.group(2)
        items = _lookup(data, key) or []
        return ''.join(_render_handlebars(block, {**data, **(item if isinstance(item, dict) else {'this': item})}, locale)
                        for item in items)

    template = _EACH_PATTERN.sub(each_repl, template)

    def if_repl(m: re.Match) -> str:
        key, block = m.group(1), m.group(2)
        return block if _lookup(data, key) else ''

    template = _IF_PATTERN.sub(if_repl, template)

    def var_repl(m: re.Match) -> str:
        key, filt, arg = m.group(1), m.group(2), m.group(3)
        value = _lookup(data, key)
        if value is None:
            return ''
        return _apply_filter(value, filt, arg, locale)

    return _VAR_PATTERN.sub(var_repl, template)


def _lookup(data: dict[str, Any], dotted_key: str) -> Any:
    parts = dotted_key.split('.')
    current: Any = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _apply_filter(value: Any, filt: str | None, arg: str | None, locale: LocaleConfig) -> str:
    lang = locale.tag.replace('-', '_')

    if filt == 'currency':
        currency_code = arg or 'USD'
        return format_currency(value, currency_code, locale=lang)
    if filt == 'percent':
        return format_percent(float(value), locale=lang)
    if filt == 'date':
        return format_date(value, locale=lang) if hasattr(value, 'year') else str(value)
    if filt == 'upper':
        return str(value).upper()
    if filt == 'lower':
        return str(value).lower()
    if filt == 'truncate':
        n = int(arg) if arg else 50
        s = str(value)
        return s if len(s) <= n else s[:n] + '…'

    return str(value)


def _wrap_html(body: str, data: dict[str, Any], locale: LocaleConfig) -> str:
    direction = locale.direction
    lang = locale.tag

    return f'''<!DOCTYPE html>
<html lang="{lang}" dir="{direction}">
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: 'Noto Sans', system-ui, sans-serif; font-size: 11pt; line-height: 1.5; }}
    @page {{ size: A4; margin: 20mm; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #ddd; padding: 6px 10px; text-align: start; }}
  </style>
</head>
<body>
{body}
</body>
</html>'''
