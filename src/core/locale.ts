import type { LocaleConfig } from '../types.js'

// RTL scripts
const RTL_LOCALES = new Set([
  'ar', 'ar-SA', 'ar-EG', 'ar-AE', 'ar-MA', 'ar-DZ', 'ar-IQ', 'ar-JO', 'ar-LB', 'ar-LY', 'ar-QA',
  'fa', 'fa-IR',
  'he', 'he-IL',
  'ur', 'ur-PK',
  'ps', 'ps-AF',
  'yi',
  'ug',
])

// Scripts requiring complex shaping (HarfBuzz)
const COMPLEX_SCRIPT_LOCALES = new Set([
  'ar', 'fa', 'he', 'ur', 'ps',       // Arabic script
  'hi', 'mr', 'ne', 'sa',              // Devanagari
  'bn', 'as',                          // Bengali
  'ta', 'te', 'kn', 'ml',             // South Indian
  'th', 'lo',                          // Thai / Lao
  'km',                                // Khmer
  'my',                                // Myanmar/Burmese
  'zh', 'ja', 'ko',                   // CJK
  'bo',                                // Tibetan
])

// Hyphenation language codes (Hunspell dictionaries)
const HYPHENATION_LOCALES = new Set([
  'en', 'de', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
  'cs', 'sk', 'ro', 'hu', 'ca', 'hr', 'sl', 'et', 'lv', 'lt', 'vi',
  'ru', 'uk', 'bg', 'sr', 'el',
])

export function locale(tag: string | LocaleConfig): LocaleConfig {
  return resolveLocale(tag)
}

export function resolveLocale(input: string | LocaleConfig): LocaleConfig {
  if (typeof input !== 'string') return input

  const tag = input
  const lang = tag.split('-')[0]!

  return {
    tag,
    direction:       RTL_LOCALES.has(tag) || RTL_LOCALES.has(lang) ? 'rtl' : 'ltr',
    numberingSystem: 'arab-sa' === tag ? 'arab' : 'latn',
    calendar:        tag.startsWith('ar') ? 'gregory' : 'gregory',  // default; override if needed
    hyphenation:     HYPHENATION_LOCALES.has(lang),
    lineBreaking:    ['ja', 'zh', 'ko', 'th', 'lo', 'km'].includes(lang) ? 'strict' : 'normal',
  }
}

resolveLocale.availableLocales = (): string[] => {
  // Returns supported BCP 47 locale tags
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
    'fa-IR',
    'ur-PK',
    'ps-AF',
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
    'ja-JP',
    'ko-KR',
    // Cyrillic
    'ru-RU', 'uk-UA', 'bg-BG', 'sr-RS', 'be-BY', 'mk-MK',
    // Greek
    'el-GR',
    // Other
    'am-ET',  // Amharic / Ethiopic
    'tr-TR',  // Turkish (Latin)
    'az-AZ',  // Azerbaijani
    'kk-KZ',  // Kazakh
    'hy-AM',  // Armenian
    'ka-GE',  // Georgian
  ]
}
