#!/usr/bin/env node
/**
 * LombokPDF — TokenScanner
 * Scans source files for accidentally committed secrets, API keys, passwords.
 * Blocks release if any are found.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'

const RED   = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW= '\x1b[33m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

// ─── Secret Patterns ─────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
  // Generic
  { name: 'Generic Password',    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Generic API Key',     regex: /(?:api[_-]?key|apikey|api_token)\s*[:=]\s*['"][A-Za-z0-9\-_]{16,}['"]/gi },
  { name: 'Generic Secret',      regex: /(?:secret[_-]?key|client_secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Generic Token',       regex: /(?:access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][A-Za-z0-9\-_.]{20,}['"]/gi },

  // Cloud providers
  { name: 'AWS Access Key ID',    regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key',       regex: /(?:aws[_-]?secret|aws_secret_access_key)\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/gi },
  { name: 'GCP API Key',          regex: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'GCP Service Account',  regex: /"type":\s*"service_account"/g },
  { name: 'Azure SAS Token',      regex: /sig=[A-Za-z0-9%]{40,}/g },

  // Tokens
  { name: 'GitHub Token',         regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: 'GitHub Classic Token', regex: /github_pat_[A-Za-z0-9_]{82}/g },
  { name: 'npm Token',            regex: /npm_[A-Za-z0-9]{36}/g },
  { name: 'Slack Token',          regex: /xox[baprs]-[A-Za-z0-9\-]{10,}/g },
  { name: 'Stripe Secret Key',    regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Test Key',      regex: /sk_test_[0-9a-zA-Z]{24,}/g },
  { name: 'SendGrid Key',         regex: /SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}/g },
  { name: 'Twilio Account SID',   regex: /AC[a-z0-9]{32}/g },
  { name: 'JWT (long)',           regex: /eyJ[A-Za-z0-9_\-]{50,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g },
  { name: 'RSA Private Key',      regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
  { name: 'EC Private Key',       regex: /-----BEGIN EC PRIVATE KEY-----/g },
  { name: 'PGP Private Key',      regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g },
  { name: 'SSH Private Key',      regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { name: 'Base64 Long Secret',   regex: /['"][A-Za-z0-9+/]{60,}={0,2}['"]/g },

  // Database
  { name: 'MySQL URL with pass',  regex: /mysql:\/\/[^:]+:[^@]{6,}@/gi },
  { name: 'Postgres URL with pass',regex: /postgres(?:ql)?:\/\/[^:]+:[^@]{6,}@/gi },
  { name: 'MongoDB URL with pass', regex: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]{6,}@/gi },
  { name: 'Redis URL with pass',   regex: /redis:\/\/[^:]+:[^@]{6,}@/gi },
]

// Files whose content is fixed by hash in src/vendor/MANIFEST.json
const HASH_LOCKED = ['src/vendor/MANIFEST.json', 'tests/vendor/vectors/']

// Files/dirs to skip
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', 'coverage', '.nyc_output', 'tmp', '.cache',
])

const SKIP_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.tar', '.gz', '.lock',
  '.map',
])

// ─── Walk source tree ────────────────────────────────────────────────────────

function walk(dir) {
  const files = []
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = resolve(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) files.push(...walk(full))
      else if (!SKIP_EXTS.has('.' + entry.split('.').pop())) files.push(full)
    } catch { /* permission error — skip */ }
  }
  return files
}

// ─── Main scan ───────────────────────────────────────────────────────────────

const ROOT = resolve('.')
const files = walk(ROOT)
const findings = []
let scanned = 0

for (const file of files) {
  let content
  try {
    content = readFileSync(file, 'utf-8')
  } catch {
    continue // binary or unreadable
  }

  // Skip test fixtures that intentionally contain fake secrets
  if (file.includes('fixtures') || file.includes('__mocks__')) continue

  const relPath = relative(ROOT, file)
  // Hash-locked copies from Lombok libraries (SHA-256 digests, base64 test documents);
  // their content is verified by scripts/check-vendor.mjs against the origin repos.
  if (HASH_LOCKED.some(prefix => relPath.split(sep).join('/').startsWith(prefix))) continue
  scanned++

  for (const { name, regex } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0
    const matches = content.match(regex)
    if (!matches) continue

    // Filter out obvious false positives
    const realMatches = matches.filter(m => {
      // Skip env var placeholders
      if (/process\.env\.|import\.meta\.env\.|getenv\(|os\.environ/.test(content.slice(
        Math.max(0, content.indexOf(m) - 50), content.indexOf(m)
      ))) return false
      // Skip the base64 alphabet itself (encoder tables)
      if (m.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')) return false
      // Skip example/placeholder strings
      if (/your[-_]?|example[-_]?|placeholder|<[^>]+>|xxx|test[-_]?secret/i.test(m)) return false
      // Skip URLs in comments
      if (content.slice(Math.max(0, content.indexOf(m) - 5), content.indexOf(m)).includes('//')) return false
      return true
    })

    if (realMatches.length > 0) {
      findings.push({ file: relPath, pattern: name, count: realMatches.length, sample: realMatches[0].slice(0, 40) + '...' })
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`${BOLD}LombokPDF TokenScanner${RESET}`)
console.log(`Scanned ${scanned} files in ${files.length} entries\n`)

if (findings.length === 0) {
  console.log(`${GREEN}${BOLD}✓ No secrets or tokens found${RESET}`)
  process.exit(0)
} else {
  console.error(`${RED}${BOLD}✗ ${findings.length} potential secret(s) found:${RESET}\n`)
  for (const f of findings) {
    console.error(`  ${RED}${f.file}${RESET}`)
    console.error(`    Pattern: ${YELLOW}${f.pattern}${RESET} (${f.count} match(es))`)
    console.error(`    Sample:  ${f.sample}\n`)
  }
  console.error(`${RED}${BOLD}Fix all findings before releasing. Use environment variables.${RESET}\n`)
  process.exit(1)
}
