<?php

declare(strict_types=1);

namespace LombokPDF\Skills\Io;

use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Extension\Table\TableExtension;
use League\CommonMark\Extension\Autolink\AutolinkExtension;
use League\CommonMark\Extension\Strikethrough\StrikethroughExtension;
use League\CommonMark\Environment\Environment;

/**
 * LombokPDF — Markdown Import Skill (PHP)
 * Converts GitHub-Flavored Markdown to HTML using league/commonmark.
 */
final class MarkdownImporter
{
    public static function toHtml(string $markdown): string
    {
        if (!class_exists(CommonMarkConverter::class)) {
            throw new \RuntimeException(
                'LombokPDF/importMarkdown: league/commonmark is required. ' .
                'Install: composer require league/commonmark'
            );
        }

        $environment = new Environment(['html_input' => 'strip']);
        $environment->addExtension(new \League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension());
        $environment->addExtension(new TableExtension());
        $environment->addExtension(new AutolinkExtension());
        $environment->addExtension(new StrikethroughExtension());

        $converter = new CommonMarkConverter([], $environment);
        $body      = (string) $converter->convert($markdown);

        return self::wrapHtml($body);
    }

    private static function wrapHtml(string $body): string
    {
        return <<<HTML
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Noto Sans', sans-serif; font-size: 11pt; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
  th, td { border: 1px solid #ddd; padding: 6pt 10pt; }
  th { background: #f5f5f5; font-weight: 600; }
  @page { size: A4; margin: 20mm; }
</style></head>
<body>{$body}</body></html>
HTML;
    }
}
