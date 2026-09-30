#!/usr/bin/env node
/**
 * LombokPDF — SQL Injection Audit
 * Scans for unsanitized SQL query construction in template stores and DB adapters.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const RED   = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW= '\x1b[33m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

const SQL_PATTERNS = [
  {
    name: 'String concatenation in SQL',
    regex: /(?:query|sql|execute|db\.run|db\.all|knex\.raw)\s*\(\s*['"`][^'"`]*\$\{/gi,
    severity: 'CRITICAL',
  },
  {
    name: 'String concatenation in SQL (+ operator)',
    regex: /(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|INTO)\s+[^;'"]*\+\s*(?:req\.|params\.|body\.|query\.|\w+Id|user)/gi,
    severity: 'HIGH',
  },
  {
    name: 'Raw query with user input',
    regex: /(?:\.raw|\.query|\.execute)\s*\(\s*[`'"][^`'"]*[`'"],?\s*(?:req\.|body\.|params\.)/gi,
    severity: 'HIGH',
  },
  {
    name: 'Unparameterized knex query',
    regex: /\.whereRaw\s*\(\s*['"`][^?$][^'"`]*\$\{/gi,
    severity: 'HIGH',
  },
  {
    name: 'Template store injection',
    regex: /templateName\s*=\s*req\.|\.findOne\s*\(\s*\{.*req\./gi,
    severity: 'MEDIUM',
  },
]

const SKIP_DIRS  = new Set(['node_modules', 'dist', '.git', 'coverage'])
const SCAN_EXTS  = new Set(['.ts', '.js', '.mjs', '.cjs'])

function walk(dir) {
  const files = []
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = resolve(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) files.push(...walk(full))
      else if (SCAN_EXTS.has('.' + entry.split('.').pop())) files.push(full)
    } catch {}
  }
  return files
}

const files    = walk(resolve('.'))
const findings = []

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const relPath = relative(resolve('.'), file)

  const lines   = content.split('\n')

  for (const { name, regex, severity } of SQL_PATTERNS) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length
      const lineStr = lines[lineNum - 1]?.trim() ?? ''
      findings.push({ file: relPath, line: lineNum, pattern: name, severity, lineStr })
    }
  }
}

console.log(`${BOLD}LombokPDF SQL Injection Audit${RESET}\n`)

if (findings.length === 0) {
  console.log(`${GREEN}${BOLD}✓ No SQL injection patterns found${RESET}`)
  process.exit(0)
}

const criticals = findings.filter(f => f.severity === 'CRITICAL')
const highs     = findings.filter(f => f.severity === 'HIGH')
const mediums   = findings.filter(f => f.severity === 'MEDIUM')

for (const f of findings) {
  const color = f.severity === 'CRITICAL' ? RED : f.severity === 'HIGH' ? YELLOW : ''
  console.error(`${color}[${f.severity}] ${f.file}:${f.line}${RESET}`)
  console.error(`  Pattern: ${f.pattern}`)
  console.error(`  Code:    ${f.lineStr.slice(0, 100)}\n`)
}

if (criticals.length > 0 || highs.length > 0) {
  console.error(`${RED}${BOLD}✗ SQL audit FAILED — ${criticals.length} critical, ${highs.length} high${RESET}`)
  process.exit(1)
} else {
  console.warn(`${YELLOW}${BOLD}⚠ SQL audit: ${mediums.length} medium issue(s) — review before release${RESET}`)
  process.exit(0)
}
