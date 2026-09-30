<?php

declare(strict_types=1);

namespace LombokPDF\Locale;

/**
 * Resolved locale configuration with direction, numbering, and hyphenation info.
 */
final class LocaleConfig
{
    public function __construct(
        public readonly string $tag,
        public readonly string $direction       = 'ltr',
        public readonly string $numberingSystem = 'latn',
        public readonly string $calendar        = 'gregory',
        public readonly bool   $hyphenation     = false,
        public readonly string $lineBreaking    = 'normal',
    ) {
    }
}
