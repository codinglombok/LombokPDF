<?php

declare(strict_types=1);

namespace LombokPDF\Skills\Ops;

use LombokPDF\Document\Document;
use setasign\Fpdi\Fpdi;

/**
 * LombokPDF — Document Operations (merge, split, watermark, compress) for PHP.
 * Backed by setasign/fpdi + setasign/fpdf.
 */
final class PdfOps
{
    /**
     * Merge multiple Document instances into one.
     *
     * @param Document[] $docs
     */
    public static function merge(array $docs): Document
    {
        if (empty($docs)) {
            throw new \InvalidArgumentException('LombokPDF/merge: no documents provided');
        }
        if (count($docs) === 1) {
            return $docs[0];
        }

        self::assertFpdiAvailable();

        $pdf = new Fpdi();
        $tmpFiles = [];

        try {
            foreach ($docs as $doc) {
                $tmp = tempnam(sys_get_temp_dir(), 'lombokpdf_merge_') . '.pdf';
                file_put_contents($tmp, $doc->toBytes());
                $tmpFiles[] = $tmp;

                $pageCount = $pdf->setSourceFile($tmp);
                for ($i = 1; $i <= $pageCount; $i++) {
                    $tplId = $pdf->importPage($i);
                    $size  = $pdf->getTemplateSize($tplId);
                    $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                    $pdf->useTemplate($tplId);
                }
            }

            return new Document($pdf->Output('S'));
        } finally {
            foreach ($tmpFiles as $f) {
                @unlink($f);
            }
        }
    }

    /**
     * Split a document by page range string, e.g. '1-5', '2,4,6', '3-'.
     */
    public static function split(Document $doc, string $pages): Document
    {
        self::assertFpdiAvailable();

        $tmp = tempnam(sys_get_temp_dir(), 'lombokpdf_split_') . '.pdf';
        file_put_contents($tmp, $doc->toBytes());

        try {
            $pdf   = new Fpdi();
            $total = $pdf->setSourceFile($tmp);
            $indices = self::parsePageRange($pages, $total);

            foreach ($indices as $pageNum) {
                $tplId = $pdf->importPage($pageNum);
                $size  = $pdf->getTemplateSize($tplId);
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($tplId);
            }

            return new Document($pdf->Output('S'));
        } finally {
            @unlink($tmp);
        }
    }

    /**
     * Add a diagonal text watermark to all pages.
     */
    public static function watermark(
        Document $doc,
        string $text = 'WATERMARK',
        float $opacity = 0.15,
        int $rotation = 45,
        int $fontSize = 60,
    ): Document {
        self::assertFpdiAvailable();

        $tmp = tempnam(sys_get_temp_dir(), 'lombokpdf_wm_') . '.pdf';
        file_put_contents($tmp, $doc->toBytes());

        try {
            $pdf   = new Fpdi();
            $total = $pdf->setSourceFile($tmp);

            for ($i = 1; $i <= $total; $i++) {
                $tplId = $pdf->importPage($i);
                $size  = $pdf->getTemplateSize($tplId);
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($tplId);

                $pdf->SetAlpha($opacity);
                $pdf->SetFont('Helvetica', 'B', $fontSize);
                $pdf->SetTextColor(136, 136, 136);

                $pageWidth  = $size['width'];
                $pageHeight = $size['height'];
                $textWidth  = $pdf->GetStringWidth($text);

                $pdf->Rotate($rotation, $pageWidth / 2, $pageHeight / 2);
                $pdf->Text(($pageWidth - $textWidth) / 2, $pageHeight / 2, $text);
                $pdf->Rotate(0);
                $pdf->SetAlpha(1);
            }

            return new Document($pdf->Output('S'));
        } finally {
            @unlink($tmp);
        }
    }

    private static function assertFpdiAvailable(): void
    {
        if (!class_exists(Fpdi::class)) {
            throw new \RuntimeException(
                'LombokPDF: setasign/fpdi and setasign/fpdf are required. ' .
                'Install: composer require setasign/fpdi setasign/fpdf'
            );
        }
    }

    /** @return int[] 1-based page numbers */
    private static function parsePageRange(string $pages, int $total): array
    {
        $trimmed = strtolower(trim($pages));
        if ($trimmed === 'all' || $trimmed === '') {
            return range(1, $total);
        }

        $indices = [];
        foreach (explode(',', $trimmed) as $part) {
            $part = trim($part);
            if (str_contains($part, '-')) {
                [$start, $end] = explode('-', $part, 2);
                $start = trim($start) === '' ? 1 : (int) $start;
                $end   = trim($end)   === '' ? $total : (int) $end;
                foreach (range(max(1, $start), min($total, $end)) as $n) {
                    $indices[$n] = true;
                }
            } else {
                $n = (int) $part;
                if ($n >= 1 && $n <= $total) {
                    $indices[$n] = true;
                }
            }
        }

        $result = array_keys($indices);
        sort($result);
        return $result;
    }
}
