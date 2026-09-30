<?php

declare(strict_types=1);

namespace LombokPDF\Types;

/**
 * Input source for rendering — wraps one of: html, markdown, template, file, docx, csv, url.
 */
final class Source
{
    private function __construct(
        public readonly ?string $html     = null,
        public readonly ?string $markdown = null,
        public readonly ?string $template = null,
        public readonly array   $data     = [],
        public readonly ?string $file     = null,
        public readonly ?string $docx     = null,
        public readonly ?string $csv      = null,
        public readonly ?string $url      = null,
        public readonly ?string $baseUrl  = null,
    ) {
    }

    /**
     * Build a Source from an associative array, e.g.
     * ['html' => '<h1>Hi</h1>'] or ['template' => 'invoice', 'data' => [...]].
     */
    public static function fromArray(array $source): self
    {
        return new self(
            html:     $source['html']     ?? null,
            markdown: $source['markdown'] ?? null,
            template: $source['template'] ?? null,
            data:     $source['data']     ?? [],
            file:     $source['file']     ?? null,
            docx:     $source['docx']     ?? null,
            csv:      $source['csv']      ?? null,
            url:      $source['url']      ?? null,
            baseUrl:  $source['base_url'] ?? null,
        );
    }

    public static function html(string $html, ?string $baseUrl = null): self
    {
        return new self(html: $html, baseUrl: $baseUrl);
    }

    public static function markdown(string $markdown): self
    {
        return new self(markdown: $markdown);
    }

    public static function template(string $name, array $data = []): self
    {
        return new self(template: $name, data: $data);
    }

    public static function file(string $path): self
    {
        return new self(file: $path);
    }

    public static function url(string $url): self
    {
        return new self(url: $url);
    }
}
