// Salinan dari LombokDocx v1.1.0 (16e37bd), src/zip.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * Minimal ZIP reader (stored + deflate) and deterministic stored-only writer.
 * Normative behaviour: SPEC §2.
 */
import { DocxError } from './errors.js'
import { inflateRaw } from './inflate.js'

export interface ZipLimits {
  /** Maximum number of central directory entries (default 10 000). */
  maxEntries?: number
  /** Maximum uncompressed size of a single entry in bytes (default 100 MiB). */
  maxEntrySize?: number
  /** Maximum total uncompressed bytes read from one archive (default 256 MiB). */
  maxTotalSize?: number
}

export const DEFAULT_LIMITS: Required<ZipLimits> = {
  maxEntries: 10_000,
  maxEntrySize: 100 * 1024 * 1024,
  maxTotalSize: 256 * 1024 * 1024,
}

export interface ZipEntry {
  name: string
  method: number
  crc32: number
  compressedSize: number
  size: number
  localOffset: number
}

let CRC_TABLE: Uint32Array | undefined

export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const utf8 = new TextDecoder('utf-8')
const utf8Encoder = new TextEncoder()

function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8)
}

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

function invalid(msg: string): never {
  throw new DocxError('INVALID_ZIP', msg)
}

export class ZipReader {
  readonly entries: ZipEntry[] = []
  private byName = new Map<string, ZipEntry>()
  private limits: Required<ZipLimits>
  private totalRead = 0

  constructor(private data: Uint8Array, limits: ZipLimits = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits }
    const b = data
    if (b.length < 22) invalid('file too small to be a ZIP archive')
    let eocd = -1
    const stop = Math.max(0, b.length - 22 - 0xffff)
    for (let i = b.length - 22; i >= stop; i--) {
      if (u32(b, i) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) invalid('end of central directory not found')
    const count = u16(b, eocd + 10)
    const cdSize = u32(b, eocd + 12)
    const cdOffset = u32(b, eocd + 16)
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      throw new DocxError('UNSUPPORTED_ZIP', 'ZIP64 archives are not supported')
    }
    if (u16(b, eocd + 4) !== 0 || u16(b, eocd + 6) !== 0) {
      throw new DocxError('UNSUPPORTED_ZIP', 'multi-disk archives are not supported')
    }
    if (count > this.limits.maxEntries) throw new DocxError('LIMIT_EXCEEDED', 'too many ZIP entries')
    if (cdOffset + cdSize > eocd) invalid('central directory out of range')
    let p = cdOffset
    for (let i = 0; i < count; i++) {
      if (p + 46 > b.length || u32(b, p) !== 0x02014b50) invalid('bad central directory header')
      const flags = u16(b, p + 8)
      const method = u16(b, p + 10)
      const crc = u32(b, p + 16)
      const csize = u32(b, p + 20)
      const size = u32(b, p + 24)
      const nameLen = u16(b, p + 28)
      const extraLen = u16(b, p + 30)
      const commentLen = u16(b, p + 32)
      const localOffset = u32(b, p + 42)
      if (p + 46 + nameLen > b.length) invalid('bad central directory header')
      const name = utf8.decode(b.subarray(p + 46, p + 46 + nameLen))
      p += 46 + nameLen + extraLen + commentLen
      if (csize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
        throw new DocxError('UNSUPPORTED_ZIP', 'ZIP64 entries are not supported')
      }
      const entry: ZipEntry = { name, method, crc32: crc, compressedSize: csize, size, localOffset }
      if (flags & 1) entry.method = -1
      this.entries.push(entry)
      if (!this.byName.has(name)) this.byName.set(name, entry)
    }
  }

  has(name: string): boolean {
    return this.byName.has(name)
  }

  /** Returns the entry bytes, or `undefined` when the archive has no such entry. */
  read(name: string): Uint8Array | undefined {
    const e = this.byName.get(name)
    if (!e) return undefined
    const b = this.data
    if (e.method === -1) throw new DocxError('UNSUPPORTED_ZIP', `encrypted entry: ${name}`)
    if (e.method !== 0 && e.method !== 8) throw new DocxError('UNSUPPORTED_ZIP', `compression method ${e.method}: ${name}`)
    if (e.size > this.limits.maxEntrySize) throw new DocxError('LIMIT_EXCEEDED', `entry too large: ${name}`)
    if (this.totalRead + e.size > this.limits.maxTotalSize) throw new DocxError('LIMIT_EXCEEDED', 'archive total size exceeds limit')
    const o = e.localOffset
    if (o + 30 > b.length || u32(b, o) !== 0x04034b50) invalid(`bad local header: ${name}`)
    const start = o + 30 + u16(b, o + 26) + u16(b, o + 28)
    const end = start + e.compressedSize
    if (end > b.length) invalid(`entry data out of range: ${name}`)
    const raw = b.subarray(start, end)
    let out: Uint8Array
    if (e.method === 0) {
      if (e.compressedSize !== e.size) throw new DocxError('CORRUPT_DATA', `stored size mismatch: ${name}`)
      out = raw.slice()
    } else {
      try {
        out = inflateRaw(raw, e.size, e.size)
      } catch (err) {
        if (err instanceof DocxError && err.code === 'LIMIT_EXCEEDED') {
          throw new DocxError('CORRUPT_DATA', `size mismatch: ${name}`)
        }
        throw err
      }
    }
    if (out.length !== e.size) throw new DocxError('CORRUPT_DATA', `size mismatch: ${name}`)
    if (crc32(out) !== e.crc32) throw new DocxError('CORRUPT_DATA', `CRC-32 mismatch: ${name}`)
    this.totalRead += e.size
    return out
  }
}

/**
 * Writes a ZIP archive with stored (uncompressed) entries, a fixed timestamp
 * (1980-01-01 00:00) and UTF-8 names, so equal input gives equal bytes.
 */
export function writeZip(files: { name: string; data: Uint8Array | string }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = utf8Encoder.encode(f.name)
    const data = typeof f.data === 'string' ? utf8Encoder.encode(f.data) : f.data
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint16(12, 0x21, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cd.set(name, 46)
    chunks.push(local, data)
    central.push(cd)
    offset += local.length + data.length
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...chunks, ...central, eocd]
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0))
  let p = 0
  for (const c of all) {
    out.set(c, p)
    p += c.length
  }
  return out
}
