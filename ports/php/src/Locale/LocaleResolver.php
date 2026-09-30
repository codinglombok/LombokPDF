<?php

declare(strict_types=1);

namespace LombokPDF\Locale;

/**
 * Resolves BCP 47 locale tags into full LocaleConfig objects,
 * including automatic RTL detection.
 */
final class LocaleResolver
{
    /** @var string[] */
    private const RTL_LOCALES = [
        'ar', 'ar-SA', 'ar-EG', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-IQ', 'ar-JO', 'ar-LB', 'ar-LY', 'ar-QA',
        'fa', 'fa-IR',
        'he', 'he-IL',
        'ur', 'ur-PK',
        'ps', 'ps-AF',
        'yi', 'ug',
    ];

    /** @var string[] */
    private const HYPHENATION_LANGS = [
        'en', 'de', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
        'cs', 'sk', 'ro', 'hu', 'ca', 'hr', 'sl', 'et', 'lv', 'lt', 'vi',
        'ru', 'uk', 'bg', 'sr', 'el',
    ];

    /** @var string[] */
    private const STRICT_LINE_BREAK_LANGS = ['ja', 'zh', 'ko', 'th', 'lo', 'km'];

    public static function resolve(string|LocaleConfig $locale): LocaleConfig
    {
        if ($locale instanceof LocaleConfig) {
            return $locale;
        }

        $lang = explode('-', $locale)[0];

        return new LocaleConfig(
            tag:             $locale,
            direction:       (in_array($locale, self::RTL_LOCALES, true) || in_array($lang, self::RTL_LOCALES, true)) ? 'rtl' : 'ltr',
            numberingSystem: $locale === 'ar-SA' ? 'arab' : 'latn',
            calendar:        'gregory',
            hyphenation:     in_array($lang, self::HYPHENATION_LANGS, true),
            lineBreaking:    in_array($lang, self::STRICT_LINE_BREAK_LANGS, true) ? 'strict' : 'normal',
        );
    }

    /** @return string[] */
    public static function availableLocales(): array
    {
        return [
            // Latin Extended
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
            // Arabic script
            'ar-SA', 'ar-EG', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-IQ', 'ar-JO', 'ar-LB', 'ar-LY', 'ar-QA',
            'fa-IR', 'ur-PK', 'ps-AF',
            // Hebrew
            'he-IL',
            // Indic
            'hi-IN', 'mr-IN', 'ne-NP',
            'bn-BD', 'bn-IN',
            'ta-IN', 'ta-LK',
            'te-IN', 'kn-IN', 'ml-IN',
            // Southeast Asian
            'th-TH', 'km-KH', 'my-MM', 'lo-LA',
            'id-ID', 'ms-MY',
            // CJK
            'zh-Hans-CN', 'zh-Hant-TW', 'zh-Hant-HK',
            'ja-JP', 'ko-KR',
            // Cyrillic
            'ru-RU', 'uk-UA', 'bg-BG', 'sr-RS', 'be-BY', 'mk-MK',
            // Greek
            'el-GR',
            // Other
            'am-ET', 'tr-TR', 'az-AZ', 'kk-KZ', 'hy-AM', 'ka-GE',
        ];
    }
}
