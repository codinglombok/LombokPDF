<?php

declare(strict_types=1);

namespace Lombok\PDF\Laravel;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Facade;
use LombokPDF\LombokPDF;

/**
 * LombokPDF Laravel Service Provider
 *
 * Install:
 *   composer require lombok/pdf-laravel
 *   php artisan vendor:publish --provider="Lombok\PDF\Laravel\LombokPDFServiceProvider"
 *
 * Usage:
 * @example
 * ```php
 * use Lombok\PDF\Facades\LombokPDF;
 *
 * public function invoice(Order $order): Response
 * {
 *     $doc = LombokPDF::template('invoice', [
 *         'company' => config('app.name'),
 *         'items'   => $order->items,
 *         'total'   => $order->total,
 *     ])->locale('id-ID')->export('pdf');
 *
 *     return response($doc->toBytes(), 200, [
 *         'Content-Type'        => 'application/pdf',
 *         'Content-Disposition' => 'inline; filename="invoice.pdf"',
 *     ]);
 * }
 * ```
 */
class LombokPDFServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/lombokpdf.php', 'lombokpdf');

        $this->app->singleton('lombokpdf', function ($app) {
            $config = $app['config']['lombokpdf'];
            return new LombokPDF(
                locale:  $config['default_locale'] ?? 'en-US',
                theme:   $config['default_theme']  ?? 'modern-corporate-flat',
                timeout: $config['timeout']         ?? 30_000,
            );
        });
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../config/lombokpdf.php' => config_path('lombokpdf.php'),
            ], 'lombokpdf-config');
        }
    }

    public function provides(): array
    {
        return ['lombokpdf'];
    }
}

// ─── Facade ───────────────────────────────────────────────────────────────────

namespace Lombok\PDF\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static \LombokPDF\Builder\Builder from(array $source)
 * @method static \LombokPDF\Builder\Builder fromHTML(string $html)
 * @method static \LombokPDF\Builder\Builder fromMarkdown(string $md)
 * @method static \LombokPDF\Builder\Builder fromFile(string $path)
 * @method static \LombokPDF\Builder\Builder template(string $name, array $data = [])
 * @method static string version()
 *
 * @see \LombokPDF\LombokPDF
 */
class LombokPDF extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'lombokpdf';
    }

    /**
     * Quick helper: render template and return streamed response.
     */
    public static function renderResponse(
        string   $template,
        array    $data,
        string   $locale   = 'id-ID',
        string   $filename = 'document.pdf',
        bool     $inline   = true,
    ): \Illuminate\Http\Response {
        $pdf = static::getFacadeRoot();
        $doc = $pdf->fromTemplate($template, $data)->locale($locale)->export('pdf');

        return response($doc->toBytes(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . $filename . '"',
            'X-LombokPDF-Pages'   => $doc->pages(),
        ]);
    }
}
