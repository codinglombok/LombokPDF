#!/usr/bin/env node
/**
 * LombokPDF — Security Audit Script
 * Blocks release on any critical/high CVE or forbidden dependency.
 *
 * Checks:
 *  1. npm audit — 0 critical, 0 high
 *  2. Forbidden packages (wkhtmltopdf, archived/CVE packages)
 *  3. Dependency license compatibility
 *  4. SHA integrity presence in lockfile
 *  5. OSV database cross-check (optional, requires osv-scanner)
 */

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const RED   = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW= '\x1b[33m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

let failed = false
const errors = []
const warnings = []

function fail(msg) {
  errors.push(msg)
  failed = true
  console.error(`${RED}✗ ${msg}${RESET}`)
}

function warn(msg) {
  warnings.push(msg)
  console.warn(`${YELLOW}⚠ ${msg}${RESET}`)
}

function pass(msg) {
  console.log(`${GREEN}✓ ${msg}${RESET}`)
}

function section(title) {
  console.log(`\n${BOLD}── ${title} ──${RESET}`)
}

// ─── 1. npm audit ─────────────────────────────────────────────────────────────

section('npm audit')

try {
  const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf-8' })
  const audit  = JSON.parse(result.stdout || '{}')
  const vuln   = audit.metadata?.vulnerabilities ?? {}

  const critical = vuln.critical ?? 0
  const high     = vuln.high     ?? 0
  const moderate = vuln.moderate ?? 0
  const low      = vuln.low      ?? 0

  if (critical > 0) fail(`${critical} CRITICAL vulnerability(ies) found`)
  else              pass(`0 critical vulnerabilities`)

  if (high > 0)     fail(`${high} HIGH vulnerability(ies) found`)
  else              pass(`0 high vulnerabilities`)

  if (moderate > 0) warn(`${moderate} moderate vulnerability(ies) (non-blocking)`)
  if (low > 0)      warn(`${low} low vulnerability(ies) (non-blocking)`)

} catch (e) {
  fail(`npm audit failed to run: ${e.message}`)
}

// ─── 2. Forbidden packages ────────────────────────────────────────────────────

section('Forbidden package check')

const FORBIDDEN = [
  { name: 'wkhtmltopdf',   reason: 'CVSS 9.8 — CVE-2023-23104. Archived and unpatched.' },
  { name: 'node-gyp-build',reason: 'Avoid native build deps unless strictly necessary' },
  { name: 'puppeteer',     reason: 'Chromium-based — use LLE WASM instead' },
  { name: 'playwright',    reason: 'Chromium-based — use LLE WASM instead' },
  { name: 'electron',      reason: 'Not appropriate for server-side PDF generation' },
]

const lockfilePath = resolve('package-lock.json')
if (!existsSync(lockfilePath)) {
  warn('package-lock.json not found — skipping lockfile checks')
} else {
  const lockfile = readFileSync(lockfilePath, 'utf-8')

  for (const { name, reason } of FORBIDDEN) {
    if (lockfile.includes(`"node_modules/${name}"`) || lockfile.includes(`"${name}":`)) {
      fail(`Forbidden package found: ${name} — ${reason}`)
    } else {
      pass(`Not present: ${name}`)
    }
  }

  // Check SHA integrity is present for all packages
  const parsed     = JSON.parse(lockfile)
  const packages   = Object.entries(parsed.packages ?? {})
  const noIntegrity = packages.filter(([k, v]) =>
    k !== '' && // skip root
    !v.integrity &&
    !v.bundled
  )

  if (noIntegrity.length > 0) {
    warn(`${noIntegrity.length} package(s) missing integrity hash. Run: npm install`)
  } else {
    pass('All packages have SHA integrity hashes')
  }
}

// ─── 3. Source code checks ────────────────────────────────────────────────────

section('Source code security checks')

const SRC_FORBIDDEN = [
  { pattern: /eval\s*\(/g,                         msg: 'eval() usage found — XSS risk' },
  { pattern: /new Function\s*\(/g,                 msg: 'new Function() found — code injection risk' },
  { pattern: /innerHTML\s*=/g,                     msg: 'innerHTML assignment found — XSS risk' },
  { pattern: /document\.write\s*\(/g,              msg: 'document.write() found — XSS risk' },
  { pattern: /child_process\.exec\s*\(/g,          msg: 'exec() with shell — prefer execFile()' },
  { pattern: /sql\s*`[^`]*\$\{/gi,                msg: 'Possible SQL injection via template literal' },
  { pattern: /md5\s*\(/gi,                         msg: 'MD5 is cryptographically broken — use SHA-256+' },
  { pattern: /sha1\s*\(/gi,                        msg: 'SHA-1 is cryptographically weak — use SHA-256+' },
  { pattern: /Math\.random\s*\(\)/g,               msg: 'Math.random() is not cryptographically secure — use crypto.randomBytes()' },
]

import { readdirSync, statSync } from 'node:fs'

function walkSrc(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) results.push(...walkSrc(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) results.push(full)
  }
  return results
}

const srcFiles = walkSrc('src')
let srcIssues  = 0

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf-8')
  const relPath = file.replace(resolve('.') + '/', '')

  for (const { pattern, msg } of SRC_FORBIDDEN) {
    const matches = content.match(pattern)
    if (matches) {
      fail(`${relPath}: ${msg} (${matches.length} occurrence(s))`)
      srcIssues++
    }
  }
}

if (srcIssues === 0) pass(`No dangerous patterns in ${srcFiles.length} source files`)

// ─── 4. License check ────────────────────────────────────────────────────────

section('License compatibility check')

const ALLOWED_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC',
  '0BSD', 'Unlicense', 'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0',
  'Python-2.0',
])

const BLOCKED_LICENSES = new Set([
  'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
  'SSPL-1.0', 'BUSL-1.1', 'Commons-Clause',
])

try {
  const pkgJson    = JSON.parse(readFileSync('package.json', 'utf-8'))
  const allDeps    = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  }

  let licenseOK    = true
  let checkedCount = 0

  for (const dep of Object.keys(allDeps)) {
    const depPkgPath = resolve('node_modules', dep, 'package.json')
    if (!existsSync(depPkgPath)) continue

    const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf-8'))
    const license = depPkg.license ?? 'UNKNOWN'
    checkedCount++

    if (BLOCKED_LICENSES.has(license)) {
      fail(`Incompatible license: ${dep} uses ${license}`)
      licenseOK = false
    } else if (!ALLOWED_LICENSES.has(license) && license !== 'UNKNOWN') {
      warn(`Unknown license: ${dep} — ${license} (manual review needed)`)
    }
  }

  if (licenseOK) pass(`All ${checkedCount} checked packages have compatible licenses`)

} catch (e) {
  warn(`License check skipped: ${e.message}`)
}

// ─── 5. OSV scanner (optional) ───────────────────────────────────────────────

section('OSV vulnerability database check')

try {
  const osv = spawnSync('osv-scanner', ['--lockfile', 'package-lock.json', '--format', 'json'], {
    encoding: 'utf-8', timeout: 30_000,
  })

  if (osv.status === 0) {
    pass('OSV scanner: no known vulnerabilities')
  } else if (osv.status === 1) {
    try {
      const result = JSON.parse(osv.stdout)
      const count  = result.results?.reduce((n, r) => n + (r.packages?.length ?? 0), 0) ?? 0
      fail(`OSV scanner found ${count} vulnerability(ies) — run: osv-scanner --lockfile package-lock.json`)
    } catch {
      warn('OSV scanner found issues (JSON parse failed)')
    }
  } else {
    warn('osv-scanner not installed (optional). Install: https://github.com/google/osv-scanner')
  }
} catch {
  warn('osv-scanner not available (optional — skipping)')
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50))

if (failed) {
  console.error(`\n${RED}${BOLD}✗ AUDIT FAILED — ${errors.length} error(s)${RESET}`)
  for (const e of errors) console.error(`  ${RED}• ${e}${RESET}`)
  if (warnings.length) {
    console.warn(`\n${YELLOW}${warnings.length} warning(s):${RESET}`)
    for (const w of warnings) console.warn(`  ${YELLOW}• ${w}${RESET}`)
  }
  console.error(`\n${RED}Release blocked. Fix all errors before publishing.${RESET}\n`)
  process.exit(1)
} else {
  console.log(`\n${GREEN}${BOLD}✓ SECURITY AUDIT PASSED${RESET}`)
  if (warnings.length) {
    console.warn(`${YELLOW}${warnings.length} non-blocking warning(s) — review before release${RESET}`)
  }
  console.log()
  process.exit(0)
}
