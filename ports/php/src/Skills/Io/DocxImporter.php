<?php

declare(strict_types=1);

namespace LombokPDF\Skills\Io;

use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Element\AbstractContainer;
use PhpOffice\PhpWord\Element\Text;
use PhpOffice\PhpWord\Element\TextRun;
use PhpOffice\PhpWord\Element\Table;
use PhpOffice\PhpWord\Element\Title;

/**
 * LombokPDF — DOCX Import Skill (PHP)
 * Converts .docx files to HTML using phpoffice/phpword.
 */
final class DocxImporter
{
    public static function toHtml(string $pathOrContent): string
    {
        if (!class_exists(IOFactory::class)) {
            throw new \RuntimeException(
                'LombokPDF/importDocx: phpoffice/phpword is required. ' .
                'Install: composer require phpoffice/phpword'
            );
        }

        $tmpPath = null;
        if (!is_file($pathOrContent)) {
            // Raw content passed — write to temp file since PhpWord reads from paths
            $tmpPath = tempnam(sys_get_temp_dir(), 'lombokpdf_docx_');
            file_put_contents($tmpPath, $pathOrContent);
            $path = $tmpPath;
        } else {
            $path = $pathOrContent;
        }

        try {
            $phpWord = IOFactory::load($path, 'Word2007');
            $body    = self::renderSections($phpWord);
            return self::wrapHtml($body);
        } finally {
            if ($tmpPath !== null) {
                @unlink($tmpPath);
            }
        }
    }

    private static function renderSections(\PhpOffice\PhpWord\PhpWord $phpWord): string
    {
        $html = '';
        foreach ($phpWord->getSections() as $section) {
            $html .= self::renderContainer($section);
        }
        return $html;
    }

    private static function renderContainer(AbstractContainer $container): string
    {
        $html = '';
        foreach ($container->getElements() as $element) {
            $html .= match (true) {
                $element instanceof Title    => self::renderTitle($element),
                $element instanceof TextRun  => '<p>' . self::renderTextRun($element) . '</p>',
                $element instanceof Text     => '<p>' . htmlspecialchars($element->getText()) . '</p>',
                $element instanceof Table    => self::renderTable($element),
                default => '',
            };
        }
        return $html;
    }

    private static function renderTitle(Title $title): string
    {
        $level = min(max($title->getDepth(), 1), 6);
        return "<h{$level}>" . htmlspecialchars($title->getText()) . "</h{$level}>";
    }

    private static function renderTextRun(TextRun $run): string
    {
        $html = '';
        foreach ($run->getElements() as $el) {
            if ($el instanceof Text) {
                $fontStyle = $el->getFontStyle();
                $text = htmlspecialchars($el->getText());
                if (is_object($fontStyle)) {
                    if ($fontStyle->isBold()) $text = "<strong>{$text}</strong>";
                    if ($fontStyle->isItalic()) $text = "<em>{$text}</em>";
                }
                $html .= $text;
            }
        }
        return $html;
    }

    private static function renderTable(Table $table): string
    {
        $html = '<table>';
        foreach ($table->getRows() as $row) {
            $html .= '<tr>';
            foreach ($row->getCells() as $cell) {
                $html .= '<td>' . self::renderContainer($cell) . '</td>';
            }
            $html .= '</tr>';
        }
        return $html . '</table>';
    }

    private static function wrapHtml(string $body): string
    {
        return <<<HTML
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Noto Sans', sans-serif; font-size: 11pt; line-height: 1.6; }
  h1 { font-size: 22pt; margin: 24pt 0 12pt; }
  h2 { font-size: 16pt; margin: 20pt 0 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
  th, td { border: 1px solid #ddd; padding: 6pt 10pt; }
  @page { size: A4; margin: 20mm; }
</style></head>
<body>{$body}</body></html>
HTML;
    }
}
