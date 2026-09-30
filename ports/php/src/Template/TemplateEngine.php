<?php

declare(strict_types=1);

namespace LombokPDF\Template;

use LombokPDF\Locale\LocaleConfig;
use Symfony\Component\Yaml\Yaml;

/**
 * Handlebars-compatible template engine for the PHP port.
 * Supports {{ var }}, {{ var|filter }}, {{#if}}, {{#each}}, and YAML front-matter.
 */
final class TemplateEngine
{
    private const BUILTIN_TEMPLATES = [
        'invoice', 'report', 'legal', 'certificate', 'letter', 'resume',
        'ticket', 'label', 'receipt', 'newsletter', 'datasheet', 'booklet',
    ];

    public static function render(string $nameOrPath, array $data, LocaleConfig $locale): string
    {
        $source = self::loadTemplateSource($nameOrPath);
        [$frontMatter, $content] = self::parseFrontMatter($source);

        $mergedData = [...$frontMatter, ...$data];
        $renderedBody = self::renderHandlebars($content, $mergedData, $locale);

        return self::wrapHtml($renderedBody, $mergedData, $locale);
    }

    private static function loadTemplateSource(string $nameOrPath): string
    {
        if (!str_contains($nameOrPath, '/') && !str_contains($nameOrPath, '\\')) {
            if (!in_array($nameOrPath, self::BUILTIN_TEMPLATES, true)) {
                throw new \InvalidArgumentException(
                    "LombokPDF: unknown template '{$nameOrPath}'. Built-ins: " .
                    implode(', ', self::BUILTIN_TEMPLATES)
                );
            }
            $path = __DIR__ . "/../../templates/{$nameOrPath}/template.html";
        } else {
            $path = $nameOrPath;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            throw new \RuntimeException("LombokPDF: could not read template '{$path}'");
        }

        return $content;
    }

    private static function parseFrontMatter(string $source): array
    {
        if (preg_match('/^---\n(.*?)\n---\n(.*)$/s', $source, $matches)) {
            $frontMatter = Yaml::parse($matches[1]) ?? [];
            return [$frontMatter, $matches[2]];
        }

        return [[], $source];
    }

    private static function renderHandlebars(string $template, array $data, LocaleConfig $locale): string
    {
        // Process {{#each}} blocks
        $template = preg_replace_callback(
            '/\{\{#each\s+([\w.]+)\}\}(.*?)\{\{\/each\}\}/s',
            function ($m) use ($data, $locale) {
                $items = self::lookup($data, $m[1]) ?? [];
                $out = '';
                foreach ($items as $item) {
                    $itemData = is_array($item) ? [...$data, ...$item] : [...$data, 'this' => $item];
                    $out .= self::renderHandlebars($m[2], $itemData, $locale);
                }
                return $out;
            },
            $template
        );

        // Process {{#if}} blocks
        $template = preg_replace_callback(
            '/\{\{#if\s+([\w.]+)\}\}(.*?)\{\{\/if\}\}/s',
            fn ($m) => self::lookup($data, $m[1]) ? $m[2] : '',
            $template
        );

        // Process variable interpolation with optional filter
        $template = preg_replace_callback(
            '/\{\{\s*([\w.]+)(?:\s*\|\s*(\w+)(?::(\S+))?)?\s*\}\}/',
            function ($m) use ($data, $locale) {
                $value = self::lookup($data, $m[1]);
                if ($value === null) return '';
                $filter = $m[2] ?? null;
                $arg    = $m[3] ?? null;
                return self::applyFilter($value, $filter, $arg, $locale);
            },
            $template
        );

        return $template;
    }

    private static function lookup(array $data, string $dottedKey): mixed
    {
        $parts   = explode('.', $dottedKey);
        $current = $data;
        foreach ($parts as $part) {
            if (is_array($current) && array_key_exists($part, $current)) {
                $current = $current[$part];
            } else {
                return null;
            }
        }
        return $current;
    }

    private static function applyFilter(mixed $value, ?string $filter, ?string $arg, LocaleConfig $locale): string
    {
        $fmt = new \NumberFormatter($locale->tag, \NumberFormatter::CURRENCY);

        return match ($filter) {
            'currency' => $fmt->formatCurrency((float) $value, $arg ?? 'USD'),
            'percent'  => (new \NumberFormatter($locale->tag, \NumberFormatter::PERCENT))->format((float) $value),
            'date'     => self::formatDate($value, $locale->tag),
            'upper'    => mb_strtoupper((string) $value),
            'lower'    => mb_strtolower((string) $value),
            'truncate' => mb_strlen((string) $value) > (int) ($arg ?? 50)
                ? mb_substr((string) $value, 0, (int) ($arg ?? 50)) . '…'
                : (string) $value,
            default    => (string) $value,
        };
    }

    private static function formatDate(mixed $value, string $locale): string
    {
        try {
            $date = $value instanceof \DateTimeInterface ? $value : new \DateTimeImmutable((string) $value);
            $fmt  = new \IntlDateFormatter($locale, \IntlDateFormatter::LONG, \IntlDateFormatter::NONE);
            return $fmt->format($date);
        } catch (\Exception) {
            return (string) $value;
        }
    }

    private static function wrapHtml(string $body, array $data, LocaleConfig $locale): string
    {
        $dir  = $locale->direction;
        $lang = $locale->tag;

        return <<<HTML
<!DOCTYPE html>
<html lang="{$lang}" dir="{$dir}">
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
{$body}
</body>
</html>
HTML;
    }
}
