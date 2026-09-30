#!/usr/bin/env node
/**
 * LombokPDF — License Compatibility Audit
 * Ensures all runtime dependencies use Apache-2.0/MIT/BSD or compatible licenses.
 * Blocks release on any GPL/AGPL/LGPL/SSPL/BUSL runtime dependency.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const RED    = '\x1b[31m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

// ─── License classifications ──────────────────────────────────────────────────

const ALLOWED = new Set([
  'MIT', 'MIT-0',
  'Apache-2.0',
  'BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-3.0', 'CC-BY-4.0',
  'Python-2.0',
  'Artistic-2.0',
  'Zlib',
  'BlueOak-1.0.0',
  'WTFPL',
  'Public Domain',
])

const BLOCKED = new Map([
  ['GPL-2.0',        'Copyleft — incompatible with Apache-2.0 distribution'],
  ['GPL-2.0-only',   'Copyleft — incompatible with Apache-2.0 distribution'],
  ['GPL-2.0-or-later','Copyleft — incompatible with Apache-2.0 distribution'],
  ['GPL-3.0',        'Copyleft — incompatible with Apache-2.0 distribution'],
  ['GPL-3.0-only',   'Copyleft — incompatible with Apache-2.0 distribution'],
  ['GPL-3.0-or-later','Copyleft — incompatible with Apache-2.0 distribution'],
  ['AGPL-3.0',       'Network copyleft — strongly incompatible with commercial use'],
  ['AGPL-3.0-only',  'Network copyleft — strongly incompatible with commercial use'],
  ['LGPL-2.0',       'Weak copyleft — requires linking disclosure'],
  ['LGPL-2.1',       'Weak copyleft — requires linking disclosure'],
  ['LGPL-3.0',       'Weak copyleft — requires linking disclosure'],
  ['SSPL-1.0',       'Service copyleft — incompatible with Apache-2.0'],
  ['BUSL-1.1',       'Business Source License — not open source for commercial use'],
  ['Commons-Clause', 'Commons Clause restriction — not open source'],
  ['Proprietary',    'Proprietary — not compatible with open source distribution'],
  ['UNLICENSED',     'No license — all rights reserved by default'],
])

const NEEDS_REVIEW = new Set([
  'MPL-2.0',        // Mozilla Public License — file-level copyleft, generally OK
  'CDDL-1.0',       // Common Development — weak copyleft
  'EPL-1.0',        // Eclipse — copyleft per file
  'EPL-2.0',        // Eclipse 2.0
])

// ─── Load root package.json ────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}))
const runtimeDeps = new Set(Object.keys(pkg.dependencies ?? {}))

// ─── Scan node_modules ────────────────────────────────────────────────────────

const nmPath = resolve('node_modules')
if (!existsSync(nmPath)) {
  console.log(`${YELLOW}⚠ node_modules not found — run npm install first${RESET}`)
  process.exit(0)
}

function getSubdirs(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(e => {
    try { return statSync(resolve(dir, e)).isDirectory() } catch { return false }
  })
}

// Collect all installed packages (including transitive)
function collectPackages(baseDir, visited = new Set()) {
  const packages = []
  const entries = getSubdirs(baseDir)

  for (const entry of entries) {
    if (entry.startsWith('.')) continue

    // Handle scoped packages (@scope/pkg)
    if (entry.startsWith('@')) {
      const scopedDir = resolve(baseDir, entry)
      const scoped    = getSubdirs(scopedDir)
      for (const pkg of scoped) {
        const pkgPath = resolve(scopedDir, pkg, 'package.json')
        const key     = `${entry}/${pkg}`
        if (!visited.has(key) && existsSync(pkgPath)) {
          visited.add(key)
          packages.push({ name: key, path: pkgPath })
        }
      }
    } else {
      const pkgPath = resolve(baseDir, entry, 'package.json')
      if (!visited.has(entry) && existsSync(pkgPath)) {
        visited.add(entry)
        packages.push({ name: entry, path: pkgPath })
      }
    }
  }

  return packages
}

const allPackages = collectPackages(nmPath)

// ─── Audit each package ───────────────────────────────────────────────────────

const blocked  = []
const review   = []
const unknown  = []
let   checked  = 0

for (const { name, path } of allPackages) {
  let meta
  try { meta = JSON.parse(readFileSync(path, 'utf-8')) } catch { continue }

  const isDevOnly = devDeps.has(name) && !runtimeDeps.has(name)
  const rawLicense = meta.license ?? meta.licenses?.[0]?.type ?? 'UNKNOWN'

  // Normalize license expression
  const licenses = typeof rawLicense === 'string'
    ? [rawLicense.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/).map(s => s.trim())]
        .flat()
    : []

  checked++

  for (const lic of licenses) {
    if (BLOCKED.has(lic)) {
      if (isDevOnly) {
        review.push({ name, license: lic, reason: `Dev-only: ${BLOCKED.get(lic)}`, severity: 'warn' })
      } else {
        blocked.push({ name, license: lic, reason: BLOCKED.get(lic), isDevOnly })
      }
    } else if (NEEDS_REVIEW.has(lic)) {
      review.push({ name, license: lic, reason: 'Needs manual review — file-level copyleft', severity: 'info' })
    } else if (!ALLOWED.has(lic) && lic !== 'UNKNOWN') {
      review.push({ name, license: lic, reason: 'Unknown license — manual review recommended', severity: 'info' })
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(`${BOLD}LombokPDF License Audit${RESET}`)
console.log(`Checked ${checked} packages\n`)

if (review.length > 0) {
  console.log(`${YELLOW}${BOLD}⚠ ${review.length} package(s) need review:${RESET}`)
  for (const r of review) {
    console.log(`  ${YELLOW}${r.name}${RESET} — ${r.license}: ${r.reason}`)
  }
  console.log()
}

if (blocked.length === 0) {
  console.log(`${GREEN}${BOLD}✓ License audit passed — no incompatible licenses in runtime dependencies${RESET}`)
  if (review.length > 0) {
    console.log(`${YELLOW}Review ${review.length} package(s) above before releasing.${RESET}`)
  }
  process.exit(0)
} else {
  console.error(`\n${RED}${BOLD}✗ LICENSE AUDIT FAILED — ${blocked.length} incompatible runtime dependencies:${RESET}\n`)
  for (const b of blocked) {
    console.error(`  ${RED}${b.name}${RESET}`)
    console.error(`    License:  ${BOLD}${b.license}${RESET}`)
    console.error(`    Problem:  ${b.reason}`)
    console.error(`    Action:   Find an Apache-2.0/MIT/BSD alternative or remove this dependency\n`)
  }
  console.error(`${RED}Fix all blocked packages before releasing.${RESET}\n`)
  process.exit(1)
}
