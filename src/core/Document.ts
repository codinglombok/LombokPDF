import type { PDFMetadata } from '../types.js'
import { createWriteStream } from 'node:fs'
import { Writable } from 'node:stream'

/**
 * A rendered PDF document.
 * Returned by `Builder.export()`.
 */
export class Document {
  private _bytes: Uint8Array
  private _meta: PDFMetadata

  constructor(bytes: Uint8Array, meta: PDFMetadata = {}) {
    this._bytes = bytes
    this._meta = meta
  }

  /** Save to disk */
  async save(path: string): Promise<void> {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, this._bytes)
  }

  /** Get raw bytes */
  async toBytes(): Promise<Uint8Array> {
    return this._bytes
  }

  /** Get base64-encoded string */
  async toBase64(): Promise<string> {
    return Buffer.from(this._bytes).toString('base64')
  }

  /** Get as data URI for browser use */
  async toDataURI(): Promise<string> {
    const b64 = await this.toBase64()
    return `data:application/pdf;base64,${b64}`
  }

  /** Pipe to a Node.js writable stream (e.g. Express response) */
  pipe(stream: Writable): void {
    const writable = createWriteStream('', { fd: (stream as any).fd })
    stream.write(Buffer.from(this._bytes))
    stream.end()
  }

  /** Get as Web ReadableStream (browser/edge runtime compatible) */
  toStream(): ReadableStream<Uint8Array> {
    const bytes = this._bytes
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
  }

  /** Number of pages in this document */
  pages(): number {
    // Parse /Count from PDF dictionary — simplified for Stage 1
    const text = Buffer.from(this._bytes).toString('latin1')
    const match = text.match(/\/Count\s+(\d+)/)
    return match ? parseInt(match[1]!, 10) : 0
  }

  /** Get document metadata */
  metadata(): PDFMetadata {
    return { ...this._meta }
  }

  /** Return a new Document with updated metadata */
  setMetadata(meta: Partial<PDFMetadata>): Document {
    return new Document(this._bytes, { ...this._meta, ...meta })
  }

  /** @internal - used by skill pipeline */
  _getRaw(): Uint8Array {
    return this._bytes
  }

  /** @internal - used by skill pipeline */
  _withRaw(bytes: Uint8Array): Document {
    return new Document(bytes, this._meta)
  }

  /** Size in bytes */
  get size(): number {
    return this._bytes.byteLength
  }
}
