<?php

declare(strict_types=1);

namespace LombokPDF;

use LombokPDF\Builder\Builder;
use LombokPDF\Engine\LLEEngine;
use LombokPDF\Locale\LocaleResolver;
use LombokPDF\Types\Source;
use LombokPDF\Types\LombokPDFOptions;

/**
 * LombokPDF — Main entry point for PHP.
 *
 * @example
 * ```php
 * use LombokPDF\LombokPDF;
 *
 * $pdf = new LombokPDF();
 *
 * // From HTML
 * $doc = $pdf->from(['html' => '<h1>Hello</h1>'])
 *            ->locale('id-ID')
 *            ->export('pdf');
 * $doc->save('output.pdf');
 *
 * // From template
 * $doc = $pdf->from(['template' => 'invoice', 'data' => $data])
 *            ->locale('id-ID')
 *            ->export('pdf');
 *
 * // Stream to browser
 * $doc->inline('invoice.pdf');
 *
 * // Arabic RTL
 * $doc = $pdf->from(['html' => '<h1>مرحباً</h1>'])
 *            ->locale('ar-SA')
 *            ->export('pdf');
 * ```
 */
class LombokPDF
{
    private LLEEngine $engine;
    private LombokPDFOptions $options;

    public function __construct(
        string $locale  = 'en-US',
        string $theme   = 'modern-corporate-flat',
        bool   $debug   = false,
        int    $timeout = 30_000,
    ) {
        $this->options = new LombokPDFOptions(
            locale:  $locale,
            theme:   $theme,
            debug:   $debug,
            timeout: $timeout,
        );
        $this->engine = new LLEEngine($this->options);
    }

    /**
     * Begin a fluent builder chain from a source.
     *
     * @param array{html?: string, markdown?: string, template?: string,
     *              data?: array, file?: string, url?: string} $source
     */
    public function from(array $source): Builder
    {
        return new Builder(Source::fromArray($source), $this->engine, $this->options);
    }

    /** Shorthand: from HTML string */
    public function fromHTML(string $html, ?string $baseUrl = null): Builder
    {
        return $this->from(['html' => $html, 'base_url' => $baseUrl]);
    }

    /** Shorthand: from Markdown string */
    public function fromMarkdown(string $md): Builder
    {
        return $this->from(['markdown' => $md]);
    }

    /** Shorthand: from named template */
    public function fromTemplate(string $name, array $data = []): Builder
    {
        return $this->from(['template' => $name, 'data' => $data]);
    }

    /** Shorthand: from file path (HTML, MD, or DOCX) */
    public function fromFile(string $path): Builder
    {
        return $this->from(['file' => $path]);
    }

    /** Library version */
    public static function version(): string
    {
        return '1.0.0';
    }

    /** Feature support matrix */
    public static function supported(): array
    {
        return [
            'css_paged_media' => true,
            'flexbox'         => true,
            'grid'            => true,
            'bidi'            => true,
            'harfbuzz'        => extension_loaded('ffi'),
            'wasm'            => extension_loaded('ffi'),
            'locales'         => LocaleResolver::availableLocales(),
        ];
    }
}
