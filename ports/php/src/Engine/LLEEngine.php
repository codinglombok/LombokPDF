<?php

declare(strict_types=1);

namespace LombokPDF\Engine;

use LombokPDF\Types\LombokPDFOptions;

/**
 * LombokLayout Engine (LLE) bridge for PHP.
 *
 * Stage 1: falls back to a Dompdf-backed renderer for working HTML → PDF output.
 * Stage 2: calls the shared WASM core via PHP FFI (ext-ffi) for full CSS Paged
 * Media, HarfBuzz shaping, and Unicode BiDi/line-breaking — matching the
 * canonical TypeScript LLE engine exactly.
 */
final class LLEEngine
{
    private ?object $wasmInstance = null;

    public function __construct(
        private readonly LombokPDFOptions $options,
    ) {
    }

    /**
     * Render HTML to output-format bytes.
     *
     * @param array{locale: array, theme: string, page: array, format: string, metadata: array} $renderOpts
     */
    public function render(string $html, array $renderOpts): string
    {
        if (extension_loaded('ffi') && $this->wasmAssetExists()) {
            return $this->renderWithWasm($html, $renderOpts);
        }

        return $this->renderWithDompdf($html, $renderOpts);
    }

    private function wasmAssetExists(): bool
    {
        return file_exists(__DIR__ . '/../../assets/lombokpdf.wasm');
    }

    private function renderWithWasm(string $html, array $renderOpts): string
    {
        // Stage 2: FFI bridge to the shared WASM core.
        // See docs/MASTERPROMPT_STAGES.md for the WASM ABI reference.
        throw new \RuntimeException(
            'LombokPDF: WASM backend rendering ships in Stage 2. ' .
            'The Dompdf fallback is used automatically when the WASM asset is unavailable.'
        );
    }

    private function renderWithDompdf(string $html, array $renderOpts): string
    {
        if (!class_exists(\Dompdf\Dompdf::class)) {
            throw new \RuntimeException(
                'LombokPDF: dompdf is required for the Stage 1 fallback renderer. ' .
                'Install: composer require dompdf/dompdf'
            );
        }

        $dompdf = new \Dompdf\Dompdf([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled'      => true,
            'defaultFont'          => 'Noto Sans',
        ]);

        $dompdf->loadHtml($html, 'UTF-8');

        $pageSize = $renderOpts['page']['size'] ?? 'A4';
        $orientation = $renderOpts['page']['orientation'] ?? 'portrait';
        $dompdf->setPaper($pageSize, $orientation);

        $dompdf->render();

        return $dompdf->output();
    }
}
