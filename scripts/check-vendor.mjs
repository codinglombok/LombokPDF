#!/usr/bin/env node
/**
 * Memeriksa salinan library Lombok di src/vendor/ (docs/map_LombokPDF_v1.0.0.md bagian 3).
 *
 * Setiap berkas salinan = 3 baris kepala + isi berkas asal tanpa perubahan. Skrip ini
 * membuang kepala, menghitung SHA-256 isinya, dan membandingkannya dengan
 * src/vendor/MANIFEST.json. Berkas vector asal di tests/vendor/vectors/ juga diperiksa.
 *
 * Pemakaian:
 *   node scripts/check-vendor.mjs            periksa (keluar 1 bila ada selisih)
 *   node scripts/check-vendor.mjs --update   tulis ulang MANIFEST.json dari berkas saat ini
 *                                            (hanya setelah menyalin ulang dari repo asal)
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(ROOT, 'src/vendor')
const VECTORS = join(ROOT, 'tests/vendor/vectors')
const MANIFEST = join(VENDOR, 'MANIFEST.json')
const HEADER_LINES = 3

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

function body(path) {
  const lines = readFileSync(path, 'utf8').split('\n')
  if (!lines[0]?.startsWith('// Salinan dari ')) throw new Error(`${path}: kepala salinan hilang`)
  return lines.slice(HEADER_LINES).join('\n')
}

function header(path) {
  const m = /^\/\/ Salinan dari (\S+) v(\S+) \((\w+)\), (\S+);/.exec(readFileSync(path, 'utf8'))
  if (!m) throw new Error(`${path}: kepala salinan tidak sesuai format`)
  return { library: m[1], version: m[2], commit: m[3], source: m[4] }
}

function scan() {
  const libs = {}
  for (const dir of readdirSync(VENDOR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const name of readdirSync(join(VENDOR, dir.name)).sort()) {
      if (!name.endsWith('.ts')) continue
      const path = join(VENDOR, dir.name, name)
      const h = header(path)
      const lib = (libs[dir.name] ??= { library: h.library, version: h.version, commit: h.commit, files: {}, vectors: null })
      if (h.library !== lib.library || h.version !== lib.version || h.commit !== lib.commit) {
        throw new Error(`${path}: versi/commit berbeda dari berkas lain di ${dir.name}`)
      }
      lib.files[name] = { source: h.source, sha256: sha256(body(path)) }
    }
  }
  for (const name of readdirSync(VECTORS).sort()) {
    const dir = name.replace(/-vectors-v\d+\.json$/, '')
    if (libs[dir]) libs[dir].vectors = { file: name, sha256: sha256(readFileSync(join(VECTORS, name))) }
  }
  return libs
}

const current = scan()
if (process.argv.includes('--update')) {
  writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + '\n')
  console.log(`MANIFEST.json ditulis (${Object.keys(current).length} library)`)
  process.exit(0)
}

const expected = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const problems = []
for (const [dir, lib] of Object.entries(expected)) {
  const got = current[dir]
  if (!got) { problems.push(`${dir}: direktori salinan hilang`); continue }
  for (const [name, f] of Object.entries(lib.files)) {
    if (!got.files[name]) problems.push(`${dir}/${name}: berkas hilang`)
    else if (got.files[name].sha256 !== f.sha256) problems.push(`${dir}/${name}: isi berbeda dari ${lib.library} ${lib.commit}; ubah di repo asal lalu salin ulang`)
  }
  for (const name of Object.keys(got.files)) if (!lib.files[name]) problems.push(`${dir}/${name}: berkas tidak tercatat di MANIFEST`)
  if (lib.vectors && got.vectors?.sha256 !== lib.vectors.sha256) problems.push(`${dir}: vector ${lib.vectors.file} berbeda dari asal`)
}
for (const dir of Object.keys(current)) if (!expected[dir]) problems.push(`${dir}: tidak tercatat di MANIFEST`)

if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`)
  process.exit(1)
}
console.log(`ok: ${Object.keys(expected).length} library salinan cocok dengan MANIFEST`)
