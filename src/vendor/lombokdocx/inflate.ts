// Salinan dari LombokDocx v1.1.0 (16e37bd), src/inflate.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokDocx lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * DEFLATE decoder (RFC 1951). Synchronous, bounded output, no dependencies.
 */
import { DocxError } from './errors.js'

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

interface Huffman {
  counts: Uint16Array
  symbols: Uint16Array
}

function corrupt(msg: string): never {
  throw new DocxError('CORRUPT_DATA', `deflate: ${msg}`)
}

function build(lengths: ArrayLike<number>, n: number): Huffman {
  const counts = new Uint16Array(16)
  for (let i = 0; i < n; i++) counts[lengths[i]]++
  if (counts[0] === n) return { counts, symbols: new Uint16Array(0) }
  let left = 1
  for (let len = 1; len < 16; len++) {
    left = (left << 1) - counts[len]
    if (left < 0) corrupt('over-subscribed code')
  }
  const offs = new Uint16Array(16)
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + counts[len]
  const symbols = new Uint16Array(n)
  for (let i = 0; i < n; i++) if (lengths[i] !== 0) symbols[offs[lengths[i]]++] = i
  return { counts, symbols }
}

let FIXED_LIT: Huffman | undefined
let FIXED_DIST: Huffman | undefined

function fixed(): [Huffman, Huffman] {
  if (!FIXED_LIT || !FIXED_DIST) {
    const l = new Uint8Array(288)
    for (let i = 0; i < 144; i++) l[i] = 8
    for (let i = 144; i < 256; i++) l[i] = 9
    for (let i = 256; i < 280; i++) l[i] = 7
    for (let i = 280; i < 288; i++) l[i] = 8
    FIXED_LIT = build(l, 288)
    FIXED_DIST = build(new Uint8Array(30).fill(5), 30)
  }
  return [FIXED_LIT, FIXED_DIST]
}

/**
 * Decodes raw DEFLATE data. `expectedSize` is the exact output length when known
 * (ZIP stores it); output beyond `maxSize` raises LIMIT_EXCEEDED.
 */
export function inflateRaw(input: Uint8Array, maxSize: number, expectedSize?: number): Uint8Array {
  let out = new Uint8Array(expectedSize !== undefined ? Math.min(expectedSize, maxSize) : Math.min(Math.max(input.length * 4, 1024), maxSize))
  let outLen = 0
  let pos = 0
  let bitBuf = 0
  let bitCnt = 0

  const ensure = (extra: number) => {
    const need = outLen + extra
    if (need > maxSize) throw new DocxError('LIMIT_EXCEEDED', 'decompressed data exceeds limit')
    if (need <= out.length) return
    const size = Math.max(out.length * 2, need, 1024)
    const next = new Uint8Array(Math.min(size, maxSize))
    next.set(out.subarray(0, outLen))
    out = next
  }
  const bits = (need: number): number => {
    while (bitCnt < need) {
      if (pos >= input.length) corrupt('unexpected end of data')
      bitBuf |= input[pos++] << bitCnt
      bitCnt += 8
    }
    const v = bitBuf & ((1 << need) - 1)
    bitBuf >>>= need
    bitCnt -= need
    return v
  }
  const decode = (h: Huffman): number => {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len < 16; len++) {
      code |= bits(1)
      const count = h.counts[len]
      if (code - count < first) return h.symbols[index + (code - first)]
      index += count
      first += count
      first <<= 1
      code <<= 1
    }
    return corrupt('invalid Huffman code')
  }

  let last = 0
  while (!last) {
    last = bits(1)
    const type = bits(2)
    if (type === 0) {
      bitBuf = 0
      bitCnt = 0
      if (pos + 4 > input.length) corrupt('unexpected end of data')
      const len = input[pos] | (input[pos + 1] << 8)
      const nlen = input[pos + 2] | (input[pos + 3] << 8)
      pos += 4
      if (len !== (~nlen & 0xffff)) corrupt('stored block length mismatch')
      if (pos + len > input.length) corrupt('unexpected end of data')
      ensure(len)
      out.set(input.subarray(pos, pos + len), outLen)
      outLen += len
      pos += len
      continue
    }
    let lit: Huffman
    let dist: Huffman
    if (type === 1) {
      ;[lit, dist] = fixed()
    } else if (type === 2) {
      const nlen = bits(5) + 257
      const ndist = bits(5) + 1
      const ncode = bits(4) + 4
      if (nlen > 286 || ndist > 30) corrupt('bad code counts')
      const cl = new Uint8Array(19)
      for (let i = 0; i < ncode; i++) cl[CL_ORDER[i]] = bits(3)
      const clh = build(cl, 19)
      const lengths = new Uint8Array(nlen + ndist)
      let i = 0
      while (i < nlen + ndist) {
        const sym = decode(clh)
        if (sym < 16) {
          lengths[i++] = sym
          continue
        }
        let rep: number
        let val = 0
        if (sym === 16) {
          if (i === 0) corrupt('repeat with no previous length')
          val = lengths[i - 1]
          rep = 3 + bits(2)
        } else if (sym === 17) {
          rep = 3 + bits(3)
        } else {
          rep = 11 + bits(7)
        }
        if (i + rep > nlen + ndist) corrupt('too many lengths')
        while (rep--) lengths[i++] = val
      }
      if (lengths[256] === 0) corrupt('missing end-of-block code')
      lit = build(lengths.subarray(0, nlen), nlen)
      dist = build(lengths.subarray(nlen), ndist)
    } else {
      return corrupt('invalid block type')
    }
    for (;;) {
      const sym = decode(lit)
      if (sym < 256) {
        ensure(1)
        out[outLen++] = sym
      } else if (sym === 256) {
        break
      } else {
        const li = sym - 257
        if (li >= 29) corrupt('invalid length symbol')
        const len = LEN_BASE[li] + bits(LEN_EXTRA[li])
        const ds = decode(dist)
        if (ds >= 30) corrupt('invalid distance symbol')
        const d = DIST_BASE[ds] + bits(DIST_EXTRA[ds])
        if (d > outLen) corrupt('distance too far back')
        ensure(len)
        for (let k = 0; k < len; k++) {
          out[outLen] = out[outLen - d]
          outLen++
        }
      }
    }
  }
  return out.length === outLen ? out : out.slice(0, outLen)
}
