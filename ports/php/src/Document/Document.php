<?php

declare(strict_types=1);

namespace LombokPDF\Document;

/**
 * A rendered PDF document. Returned by Builder::export().
 *
 * @example
 * ```php
 * $doc = $pdf->from(['html' => '<h1>Hello</h1>'])->export('pdf');
 * $doc->save('output.pdf');
 * $doc->inline('invoice.pdf');   // stream to browser
 * $bytes = $doc->toBytes();
 * ```
 */
final class Document
{
    public function __construct(
        private readonly string $raw,
        private array $metadata = [],
    ) {
    }

    /** Save the PDF to disk. */
    public function save(string $path): void
    {
        $result = file_put_contents($path, $this->raw);
        if ($result === false) {
            throw new \RuntimeException("LombokPDF: failed to write file '{$path}'");
        }
    }

    /** Get raw PDF bytes. */
    public function toBytes(): string
    {
        return $this->raw;
    }

    /** Get base64-encoded PDF content. */
    public function toBase64(): string
    {
        return base64_encode($this->raw);
    }

    /** Get a data: URI suitable for embedding in HTML. */
    public function toDataUri(): string
    {
        return 'data:application/pdf;base64,' . $this->toBase64();
    }

    /**
     * Stream the PDF inline to the browser and terminate the script.
     * Sets Content-Type and Content-Disposition headers automatically.
     */
    public function inline(string $filename = 'document.pdf'): never
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $filename . '"');
        header('X-LombokPDF-Pages: ' . $this->pages());
        echo $this->raw;
        exit;
    }

    /**
     * Force download of the PDF and terminate the script.
     */
    public function download(string $filename = 'document.pdf'): never
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('X-LombokPDF-Pages: ' . $this->pages());
        echo $this->raw;
        exit;
    }

    /** Number of pages in this PDF (parsed from /Count). */
    public function pages(): int
    {
        if (preg_match('/\/Count\s+(\d+)/', $this->raw, $matches)) {
            return (int) $matches[1];
        }
        return 0;
    }

    /** Get document metadata array. */
    public function metadata(): array
    {
        return $this->metadata;
    }

    /** Return a new Document with merged metadata. */
    public function setMetadata(array $meta): self
    {
        return new self($this->raw, [...$this->metadata, ...$meta]);
    }

    /** Size in bytes. */
    public function size(): int
    {
        return strlen($this->raw);
    }
}
