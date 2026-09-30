<?php

declare(strict_types=1);

namespace LombokPDF\Types;

/**
 * Configuration options for a LombokPDF client instance.
 */
final class LombokPDFOptions
{
    public function __construct(
        public readonly string $locale  = 'en-US',
        public readonly string $theme   = 'modern-corporate-flat',
        public readonly bool   $debug   = false,
        public readonly int    $timeout = 30_000,
    ) {
    }
}
