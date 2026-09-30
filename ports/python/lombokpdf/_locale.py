"""LombokPDF — Locale resolution and RTL detection for the Python port."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Union

RTL_LOCALES = {
    'ar', 'ar-SA', 'ar-EG', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-IQ', 'ar-JO', 'ar-LB', 'ar-LY', 'ar-QA',
    'fa', 'fa-IR',
    'he', 'he-IL',
    'ur', 'ur-PK',
    'ps', 'ps-AF',
    'yi', 'ug',
}

HYPHENATION_LANGS = {
    'en', 'de', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
    'cs', 'sk', 'ro', 'hu', 'ca', 'hr', 'sl', 'et', 'lv', 'lt', 'vi',
    'ru', 'uk', 'bg', 'sr', 'el',
}

STRICT_LINE_BREAK_LANGS = {'ja', 'zh', 'ko', 'th', 'lo', 'km'}


@dataclass
class LocaleConfig:
    """Resolved locale configuration with direction, numbering, and hyphenation info."""
    tag:              str
    direction:        str = 'ltr'
    numbering_system: str = 'latn'
    calendar:         str = 'gregory'
    hyphenation:      bool = False
    line_breaking:    str = 'normal'


def locale(tag: Union[str, LocaleConfig]) -> LocaleConfig:
    """Public helper — resolves a BCP 47 tag or passes through an existing LocaleConfig."""
    return resolve_locale(tag)


def resolve_locale(tag: Union[str, LocaleConfig]) -> LocaleConfig:
    """Resolve a BCP 47 locale tag into a full LocaleConfig with RTL/i18n metadata."""
    if isinstance(tag, LocaleConfig):
        return tag

    lang = tag.split('-')[0]

    return LocaleConfig(
        tag=tag,
        direction='rtl' if (tag in RTL_LOCALES or lang in RTL_LOCALES) else 'ltr',
        numbering_system='arab' if tag == 'ar-SA' else 'latn',
        calendar='gregory',
        hyphenation=lang in HYPHENATION_LANGS,
        line_breaking='strict' if lang in STRICT_LINE_BREAK_LANGS else 'normal',
    )


def available_locales() -> list[str]:
    """Return all BCP 47 locale tags supported by LombokPDF (50+)."""
    return [
        # Latin Extended
        'en-US', 'en-GB', 'en-AU', 'en-CA',
        'fr-FR', 'fr-BE', 'fr-CA',
        'de-DE', 'de-AT', 'de-CH',
        'es-ES', 'es-MX', 'es-AR',
        'pt-BR', 'pt-PT',
        'it-IT',
        'nl-NL', 'nl-BE',
        'pl-PL', 'sv-SE', 'nb-NO', 'da-DK', 'fi-FI',
        'cs-CZ', 'sk-SK', 'ro-RO', 'hu-HU',
        'ca-ES', 'hr-HR', 'sl-SI',
        'et-EE', 'lv-LV', 'lt-LT',
        'vi-VN',
        # Arabic script
        'ar-SA', 'ar-EG', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-IQ', 'ar-JO', 'ar-LB', 'ar-LY', 'ar-QA',
        'fa-IR', 'ur-PK', 'ps-AF',
        # Hebrew
        'he-IL',
        # Indic
        'hi-IN', 'mr-IN', 'ne-NP',
        'bn-BD', 'bn-IN',
        'ta-IN', 'ta-LK',
        'te-IN', 'kn-IN', 'ml-IN',
        # Southeast Asian
        'th-TH', 'km-KH', 'my-MM', 'lo-LA',
        'id-ID', 'ms-MY',
        # CJK
        'zh-Hans-CN', 'zh-Hant-TW', 'zh-Hant-HK',
        'ja-JP', 'ko-KR',
        # Cyrillic
        'ru-RU', 'uk-UA', 'bg-BG', 'sr-RS', 'be-BY', 'mk-MK',
        # Greek
        'el-GR',
        # Other
        'am-ET', 'tr-TR', 'az-AZ', 'kk-KZ', 'hy-AM', 'ka-GE',
    ]


# Attach as a static-like method for API parity with the TS `resolveLocale.availableLocales()`
resolve_locale.available_locales = available_locales  # type: ignore[attr-defined]
