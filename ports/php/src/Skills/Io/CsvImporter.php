<?php

declare(strict_types=1);

namespace LombokPDF\Skills\Io;

/**
 * LombokPDF — CSV Import Skill (PHP)
 * Converts CSV data to a styled HTML table.
 */
final class CsvImporter
{
    public static function toHtml(string $csv, array $options = []): string
    {
        $delimiter = $options['delimiter']  ?? ',';
        $hasHeader = $options['hasHeader']  ?? true;

        $rows = array_map(
            fn (string $line) => str_getcsv($line, $delimiter),
            array_filter(explode("\n", trim($csv)), fn ($line) => trim($line) !== '')
        );

        if (empty($rows)) {
            return '<table></table>';
        }

        $header = $hasHeader ? array_shift($rows) : null;

        $html = '<table class="lombok-csv-table">';

        if ($header !== null) {
            $html .= '<thead><tr>';
            foreach ($header as $cell) {
                $html .= '<th>' . htmlspecialchars((string) $cell) . '</th>';
            }
            $html .= '</tr></thead>';
        }

        $html .= '<tbody>';
        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach ($row as $cell) {
                $html .= '<td>' . htmlspecialchars((string) $cell) . '</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody></table>';

        return self::wrapHtml($html);
    }

    private static function wrapHtml(string $tableHtml): string
    {
        return <<<HTML
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Noto Sans', sans-serif; font-size: 10pt; }
  .lombok-csv-table { width: 100%; border-collapse: collapse; }
  .lombok-csv-table th { background: #1a73e8; color: #fff; padding: 6pt 10pt; }
  .lombok-csv-table td { padding: 5pt 10pt; border-bottom: 1px solid #e5e7eb; }
  @page { size: A4 landscape; margin: 15mm; }
</style></head>
<body>{$tableHtml}</body></html>
HTML;
    }
}
