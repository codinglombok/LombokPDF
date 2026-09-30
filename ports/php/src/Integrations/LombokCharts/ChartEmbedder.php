<?php

declare(strict_types=1);

namespace LombokPDF\Integrations\LombokCharts;

/**
 * LombokPDF × LombokCharts Integration (PHP)
 *
 * Bridges charts from https://github.com/codinglombok/LombokCharts (PHP bindings)
 * into PDF pages as embedded, rasterized SVG images.
 */
final class ChartEmbedder
{
    /**
     * Embed a LombokCharts chart object into raw PDF bytes at the given position.
     *
     * Expects $chart to implement a render(string $renderer, int $width, int $height): string
     * method returning an SVG string, matching the LombokCharts PHP bindings API.
     */
    public static function embed(string $pdfBytes, mixed $chart, array $position): string
    {
        if (!method_exists($chart, 'render')) {
            throw new \InvalidArgumentException(
                'LombokPDF/charts: chart object must implement render($renderer, $width, $height). ' .
                'Install and use the LombokCharts PHP bindings.'
            );
        }

        $width  = $position['width']  ?? 400;
        $height = $position['height'] ?? 250;

        $svg = $chart->render('svg', $width, $height);

        return self::embedSvg($pdfBytes, $svg, $position, $width, $height);
    }

    private static function embedSvg(string $pdfBytes, string $svg, array $position, int $width, int $height): string
    {
        if (!class_exists(\setasign\Fpdi\Fpdi::class)) {
            throw new \RuntimeException(
                'LombokPDF/charts: setasign/fpdi and setasign/fpdf are required for chart embedding. ' .
                'Install: composer require setasign/fpdi setasign/fpdf'
            );
        }

        if (!extension_loaded('imagick')) {
            throw new \RuntimeException(
                'LombokPDF/charts: the imagick extension is required to rasterize SVG charts.'
            );
        }

        // Rasterize SVG to PNG via Imagick at 2x scale for crisp embedding
        $imagick = new \Imagick();
        $imagick->setResolution(144, 144); // 2x standard 72 DPI
        $imagick->readImageBlob($svg);
        $imagick->setImageFormat('png32');
        $pngBlob = $imagick->getImageBlob();
        $imagick->destroy();

        $tmpPdf = tempnam(sys_get_temp_dir(), 'lombokpdf_src_') . '.pdf';
        $tmpPng = tempnam(sys_get_temp_dir(), 'lombokpdf_chart_') . '.png';
        file_put_contents($tmpPdf, $pdfBytes);
        file_put_contents($tmpPng, $pngBlob);

        try {
            $pdf = new \setasign\Fpdi\Fpdi();
            $pageCount = $pdf->setSourceFile($tmpPdf);
            $targetPage = $position['page'] ?? 1;

            for ($i = 1; $i <= $pageCount; $i++) {
                $tplId = $pdf->importPage($i);
                $size  = $pdf->getTemplateSize($tplId);
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($tplId);

                if ($i === $targetPage) {
                    $x = $position['x'] ?? 40;
                    $y = $position['y'] ?? 40;
                    $pdf->Image($tmpPng, $x / 2.83, $y / 2.83, $width / 2.83, $height / 2.83);
                }
            }

            return $pdf->Output('S');
        } finally {
            @unlink($tmpPdf);
            @unlink($tmpPng);
        }
    }
}
