<?php

declare(strict_types=1);

namespace LombokPDF\Builder;

use LombokPDF\Document\Document;
use LombokPDF\Engine\LLEEngine;
use LombokPDF\Locale\LocaleConfig;
use LombokPDF\Locale\LocaleResolver;
use LombokPDF\Types\LombokPDFOptions;
use LombokPDF\Types\Source;

/**
 * Fluent builder returned by LombokPDF::from() and its shorthand methods.
 * All methods return $this for chaining; call export() to produce a Document.
 *
 * @example
 * ```php
 * $doc = $pdf->from(['html' => '<h1>مرحباً</h1>'])
 *            ->locale('ar-SA')
 *            ->theme('resonant-stark')
 *            ->metadata(['title' => 'Arabic Report'])
 *            ->export('pdf');
 * ```
 */
final class Builder
{
    private LocaleConfig $localeCfg;
    private string $theme;
    private array $page = ['size' => 'A4', 'orientation' => 'portrait'];
    private array $metadata = [];
    private array $embeds = [];
    private array $skills = [];

    public function __construct(
        private Source $source,
        private readonly LLEEngine $engine,
        private readonly LombokPDFOptions $defaults,
    ) {
        $this->localeCfg = LocaleResolver::resolve($defaults->locale);
        $this->theme     = $defaults->theme;
    }

    public function template(string $name, array $data = []): self
    {
        $this->source = Source::template($name, $data);
        return $this;
    }

    public function locale(string|LocaleConfig $locale): self
    {
        $this->localeCfg = LocaleResolver::resolve($locale);
        return $this;
    }

    public function theme(string $name): self
    {
        $this->theme = $name;
        return $this;
    }

    public function page(array $config): self
    {
        $this->page = array_merge($this->page, $config);
        return $this;
    }

    public function metadata(array $meta): self
    {
        $this->metadata = array_merge($this->metadata, $meta);
        return $this;
    }

    public function embed(mixed $chart, array $position = []): self
    {
        $this->embeds[] = ['chart' => $chart, 'position' => $position];
        return $this;
    }

    public function pipe(callable $skill): self
    {
        $this->skills[] = $skill;
        return $this;
    }

    public function export(string $format = 'pdf'): Document
    {
        $html = $this->resolveSource();

        $raw = $this->engine->render($html, [
            'locale'   => (array) $this->localeCfg,
            'theme'    => $this->theme,
            'page'     => $this->page,
            'format'   => $format,
            'metadata' => $this->metadata,
        ]);

        foreach ($this->embeds as ['chart' => $chart, 'position' => $position]) {
            $raw = $this->embedChart($raw, $chart, $position);
        }

        $doc = new Document($raw, $this->metadata);

        foreach ($this->skills as $skill) {
            $doc = $skill($doc);
        }

        return $doc;
    }

    private function resolveSource(): string
    {
        if ($this->source->html !== null) {
            return $this->source->html;
        }
        if ($this->source->markdown !== null) {
            return \LombokPDF\Skills\Io\MarkdownImporter::toHtml($this->source->markdown);
        }
        if ($this->source->template !== null) {
            return \LombokPDF\Template\TemplateEngine::render(
                $this->source->template,
                $this->source->data,
                $this->localeCfg,
            );
        }
        if ($this->source->file !== null) {
            return $this->loadFile($this->source->file);
        }
        if ($this->source->docx !== null) {
            return \LombokPDF\Skills\Io\DocxImporter::toHtml($this->source->docx);
        }
        if ($this->source->csv !== null) {
            return \LombokPDF\Skills\Io\CsvImporter::toHtml($this->source->csv);
        }
        if ($this->source->url !== null) {
            return $this->fetchUrl($this->source->url);
        }

        throw new \InvalidArgumentException(
            'LombokPDF: unknown source type — expected one of html, markdown, template, file, docx, csv, url'
        );
    }

    private function loadFile(string $path): string
    {
        $content = file_get_contents($path);
        if ($content === false) {
            throw new \RuntimeException("LombokPDF: could not read file '{$path}'");
        }

        return match (true) {
            str_ends_with($path, '.md')   => \LombokPDF\Skills\Io\MarkdownImporter::toHtml($content),
            str_ends_with($path, '.docx') => \LombokPDF\Skills\Io\DocxImporter::toHtml($content),
            str_ends_with($path, '.csv')  => \LombokPDF\Skills\Io\CsvImporter::toHtml($content),
            default => $content,
        };
    }

    private function fetchUrl(string $url): string
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $result = curl_exec($ch);
        $error  = curl_error($ch);
        curl_close($ch);

        if ($result === false) {
            throw new \RuntimeException("LombokPDF: failed to fetch URL '{$url}': {$error}");
        }

        return (string) $result;
    }

    private function embedChart(string $raw, mixed $chart, array $position): string
    {
        return \LombokPDF\Integrations\LombokCharts\ChartEmbedder::embed($raw, $chart, $position);
    }
}
