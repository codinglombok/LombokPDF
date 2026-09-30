# LombokPDF — Multi-Stage Roadmap & Implementation Guide

> From zero to production-grade PDF library in 5 stages.

[![Stage](https://img.shields.io/badge/current%20stage-1%20Foundation-blue.svg)](#stage-1--foundation)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../LICENSE)

---

## Overview

| Stage | Name | Focus | Target |
|---|---|---|---|
| [Stage 1](#stage-1--foundation) | **Foundation** | WASM core, JS port, 3 templates, basic i18n | Week 1–4 |
| [Stage 2](#stage-2--polyglot) | **Polyglot** | All 8 language ports, full i18n, 12 templates | Week 5–10 |
| [Stage 3](#stage-3--skills--integrations) | **Skills & Integrations** | All skill modules, LombokCSS, LombokCharts | Week 11–16 |
| [Stage 4](#stage-4--deploy--ecosystem) | **Deploy & Ecosystem** | CI/CD, Docker, AWS, CDN, framework adapters | Week 17–22 |
| [Stage 5](#stage-5--production-hardening) | **Production Hardening** | Audit suite, benchmarks, docs, community | Week 23–28 |

---

## Stage 1 — Foundation

**Goal:** Ship a working PDF library for JavaScript/TypeScript with a clean WASM core, 3 starter templates, and Latin/Arabic i18n.

### Deliverables

- [ ] LombokLayout Engine (LLE) v0.1 compiled to WASM
  - [ ] HTML5 parser (html5ever via WASM or @parse5 in JS interim)
  - [ ] CSS Paged Media basic support (`@page`, page breaks, page numbers)
  - [ ] Box model + basic Flexbox
  - [ ] Streaming PDF/1.7 writer
- [ ] TypeScript package `lombokpdf@0.1.0`
  - [ ] `LombokPDF` class with `.from()`, `.export()`, `.save()`
  - [ ] `.locale()` support for `en-US`, `id-ID`, `ar-SA`, `fr-FR`, `de-DE`
  - [ ] BiDi (UAX #9) for Arabic/Hebrew
- [ ] Templates: `invoice`, `report`, `letter`
- [ ] CLI `lombokpdf convert`, `lombokpdf render`
- [ ] npm publish `lombokpdf@0.1.0`
- [ ] Basic audit: `audit:security`, `audit:types`

### Directory Structure (Stage 1)

```
lombokpdf/
├── src/
│   ├── core/lle/          # Rust WASM core (or JS interim)
│   ├── index.ts           # Public API
│   ├── builder.ts         # Fluent builder
│   └── document.ts        # Output document
├── templates/
│   ├── invoice/
│   ├── report/
│   └── letter/
├── cli/index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Key Technical Decisions (Stage 1)

**HTML parsing strategy:**
- Stage 1: Use `parse5` (pure JS) for fast iteration
- Stage 3+: Replace with `html5ever` compiled to WASM for correctness + speed

**CSS engine strategy:**
- Stage 1: Subset of CSS Paged Media via custom TypeScript engine
- Stage 2+: Full LLE WASM with Flexbox/Grid

**i18n strategy:**
- Stage 1: BiDi via `bidi-js`, hyphenation via `hyphen`
- Stage 2+: Full CLDR, HarfBuzz shaping, font subsetting

### Sample package.json (Stage 1)

```json
{
  "name": "lombokpdf",
  "version": "0.1.0",
  "description": "Lightweight, elegant PDF generation — Apache 2.0",
  "license": "Apache-2.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.esm.js", "require": "./dist/index.js" },
    "./skills": { "import": "./dist/skills/index.esm.js" },
    "./skills/*": { "import": "./dist/skills/*.esm.js" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest run",
    "audit:security": "npm audit --audit-level=high",
    "audit:types": "tsc --noEmit --strict"
  },
  "dependencies": {
    "parse5": "^7.0.0",
    "bidi-js": "^1.0.3",
    "hyphen": "^2.1.0",
    "pdfkit": "^0.15.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "tsup": "^8.0.0"
  }
}
```

### GitHub Actions (Stage 1)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run audit:types
      - run: npm run audit:security
      - run: npm test
      - run: npm run build
```

### Stage 1 Exit Criteria

```
✅ npm install lombokpdf works
✅ LombokPDF().from({ html: '<h1>Test</h1>' }).export('pdf').save() produces valid PDF
✅ Arabic text renders RTL correctly
✅ invoice template renders with locale id-ID
✅ npm audit: 0 critical, 0 high
✅ TypeScript strict: 0 errors
✅ All tests pass
```

---

## Stage 2 — Polyglot

**Goal:** Full LLE WASM core, all 8 language ports, complete i18n (50+ languages), all 12 templates, Markdown import, DOCX import.

### Deliverables

- [ ] LLE WASM v1.0
  - [ ] Full CSS Paged Media Level 3
  - [ ] Flexbox + Grid Level 1
  - [ ] HarfBuzz shaping (Arabic, Indic, CJK)
  - [ ] Font subsetting (woff2 → PDF embed)
  - [ ] PDF/A-1b, PDF/A-2b output
  - [ ] PDF/UA (accessibility) output
- [ ] Language ports
  - [ ] Python `lombokpdf` — PyPI
  - [ ] PHP `lombok/pdf` — Packagist
  - [ ] Java `io.lombok:lombokpdf` — Maven Central
  - [ ] Go `github.com/codinglombok/lombokpdf` — pkg.go.dev
  - [ ] Ruby `lombok_pdf` — RubyGems
  - [ ] .NET `LombokPDF` — NuGet
  - [ ] Rust `lombokpdf` — crates.io
- [ ] All 12 templates completed
- [ ] i18n: 50+ languages, all scripts (CJK, Devanagari, Thai, Cyrillic, Greek)
- [ ] `importMarkdown` skill
- [ ] `importDocx` skill
- [ ] `exportPDF/A` skill
- [ ] `exportPNG` skill

### WASM ABI (C-compatible, consumed by all ports)

```c
// lombokpdf.h — the ABI every port calls via FFI
typedef struct LombokCtx LombokCtx;
typedef struct LombokDoc LombokDoc;

LombokCtx* lombok_ctx_new(const char* options_json);
void        lombok_ctx_free(LombokCtx* ctx);

LombokDoc* lombok_render_html(LombokCtx* ctx, const char* html, size_t html_len, const char* opts_json);
LombokDoc* lombok_render_template(LombokCtx* ctx, const char* tmpl_id, const char* data_json, const char* opts_json);

uint8_t*   lombok_doc_to_bytes(LombokDoc* doc, size_t* out_len);
int        lombok_doc_page_count(LombokDoc* doc);
void       lombok_doc_free(LombokDoc* doc);

// Skills
LombokDoc* lombok_merge(LombokDoc** docs, size_t count, const char* opts_json);
LombokDoc* lombok_split(LombokDoc* doc, const char* range_json);
LombokDoc* lombok_sign_pkcs7(LombokDoc* doc, const uint8_t* cert_der, size_t cert_len, const char* pass);
LombokDoc* lombok_encrypt_aes(LombokDoc* doc, const char* opts_json);
```

### Python Port (FFI pattern)

```python
# lombokpdf/_core.py — FFI bridge to WASM via wasmtime-py
import json
import wasmtime

class _LombokCore:
    def __init__(self):
        engine = wasmtime.Engine()
        module = wasmtime.Module.from_file(engine, _wasm_path())
        self._store = wasmtime.Store(engine)
        self._instance = wasmtime.Instance(self._store, module, [])

    def render_html(self, html: str, opts: dict) -> bytes:
        ctx = self._instance.exports(self._store)['lombok_ctx_new'](
            self._store, json.dumps(opts).encode()
        )
        doc = self._instance.exports(self._store)['lombok_render_html'](
            self._store, ctx, html.encode(), len(html.encode()),
            json.dumps({}).encode()
        )
        # ... get bytes, free doc
```

### Stage 2 GitHub Actions

```yaml
# .github/workflows/ports.yml
name: Port Tests
on: [push]
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -e ports/python[test]
      - run: pytest ports/python/tests/

  php:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3' }
      - run: cd ports/php && composer install && composer test

  java:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21', distribution: 'temurin' }
      - run: cd ports/java && mvn test

  go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.23' }
      - run: cd ports/go && go test ./...
```

### Stage 2 Exit Criteria

```
✅ LLE WASM passes CSS Paged Media test suite
✅ All 8 language ports produce identical output for reference fixtures
✅ Arabic invoice renders correctly (RTL, currency, date format)
✅ CJK document font subsetting — PDF size < 2MB for 50 pages
✅ PDF/A-1b output passes veraPDF validation
✅ PDF/UA output passes PAC 2024 checker
✅ All 12 templates render without error in all 8 ports
✅ importDocx preserves table structure
✅ importMarkdown renders GFM tables
```

---

## Stage 3 — Skills & Integrations

**Goal:** All skill modules complete, LombokCSS theme bridge, LombokCharts embed, full CLI, browser bundle.

### Deliverables

- [ ] All skill modules (see [Skill Modules](#8-skill-modules) in full summary)
- [ ] `lombokpdf/skills/io` — importCSV, exportSVG, exportPDFUA
- [ ] `lombokpdf/skills/ops` — merge, split, rotate, compress, watermark
- [ ] `lombokpdf/skills/image` — splitimg, rasterize, crop, OCR
- [ ] `lombokpdf/skills/marks` — QR, barcode, datamatrix, PDF417
- [ ] `lombokpdf/skills/forms` — formFill, formExtract, formCreate, formFlatten
- [ ] `lombokpdf/skills/security` — signPKCS7, encryptAES, redact, verify
- [ ] `lombokpdf/skills/structure` — toc, footnotes, crossRef, bookmarks, runningHeaders
- [ ] LombokCSS integration `@lombok/css` theme bridge
- [ ] LombokCharts integration `@lombok/charts/pdf` SVG embed
- [ ] Browser bundle (`lombokpdf.browser.min.js`) via WASM
- [ ] Full CLI (all commands)
- [ ] Vue adapter `lombokpdf-vue`
- [ ] React adapter `lombokpdf-react`

### splitimg Implementation

```typescript
// skills/image/splitimg.ts
export interface SplitimgOptions {
  cols: number           // number of columns
  rows: number           // number of rows
  gutter?: number        // spacing between cells (pt)
  pageSize?: 'A4' | 'Letter' | [number, number]
  fit?: 'fill' | 'contain' | 'cover'
}

export async function splitimg(
  imagePath: string,
  options: SplitimgOptions
): Promise<Document> {
  const { cols, rows, gutter = 0, pageSize = 'A4', fit = 'contain' } = options
  // Load image → slice into cols×rows grid → embed each in PDF cells
  // Total cells = cols × rows, laid out on pages
}

// CLI usage: lombokpdf splitimg photo.jpg --cols 3 --rows 4 -o grid.pdf
```

### LombokCharts Bridge

```typescript
// integrations/lombokcharts/index.ts
import type { Chart } from '@lombok/charts'
import type { EmbedPosition } from '../types'

export function embedChart(chart: Chart, position: EmbedPosition): Skill {
  return {
    async apply(doc: Document): Promise<Document> {
      // Force SVG renderer on the chart
      const svg = await chart.render({ renderer: 'svg', width: position.width, height: position.height })
      // Inject SVG into the PDF page at the given coordinates
      return doc.injectSVG(svg, position)
    }
  }
}
```

### Browser Bundle

```typescript
// src/browser.ts — WASM loaded via fetch in browser environment
import { initWASM } from './core/wasm-loader'

let wasmReady: Promise<void>

export async function ready(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWASM('https://unpkg.com/lombokpdf@latest/dist/lombokpdf.wasm')
  }
  return wasmReady
}

export { LombokPDF } from './index'
```

### Stage 3 Exit Criteria

```
✅ merge([a, b, c]) produces valid merged PDF with bookmark tree
✅ split(doc, { pages: '1-5' }) produces 5-page PDF
✅ splitimg(photo, { cols: 3, rows: 4 }) produces 12-cell grid PDF
✅ formFill fills all AcroForm fields correctly
✅ signPKCS7 produces verifiable PKCS#7 signature
✅ encryptAES produces AES-256 encrypted PDF
✅ LombokCSS theme 'resonant-stark' renders correct colors in PDF
✅ LombokCharts bar chart embeds as crisp SVG, no rasterization
✅ browser bundle < 1.5MB gzipped
✅ Vue/React adapters render preview without SSR errors
```

---

## Stage 4 — Deploy & Ecosystem

**Goal:** CI/CD pipelines, Docker image, AWS Lambda layer, Niagahoster guide, all registries published, framework adapters stable.

### Deliverables

- [ ] GitHub Actions: full CI/CD matrix
- [ ] Docker: multi-arch image (`linux/amd64`, `linux/arm64`)
- [ ] AWS Lambda layer published
- [ ] AWS CDK stack for ECS Fargate microservice
- [ ] Niagahoster / shared hosting guide + PHP quick-start
- [ ] npm `lombokpdf` published
- [ ] PyPI `lombokpdf` published
- [ ] Packagist `lombok/pdf` published
- [ ] Maven Central `io.lombok:lombokpdf` published
- [ ] crates.io `lombokpdf` published
- [ ] NuGet `LombokPDF` published
- [ ] RubyGems `lombok_pdf` published
- [ ] unpkg / jsDelivr CDN (auto via npm publish)
- [ ] Laravel adapter `lombok/pdf-laravel`
- [ ] Django adapter `lombokpdf-django`
- [ ] Go Fiber adapter `lombokpdf-fiber`
- [ ] Nuxt module `lombokpdf-nuxt`
- [ ] Next.js example

### Full CI/CD Pipeline

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run audit:security    # blocks release on any critical/high
      - run: npm run audit:types
      - run: npm run audit:tokens
      - run: npm run audit:licenses
      - run: npm run audit:sbom

  test-matrix:
    needs: audit
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: ['20', '22']
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: npm ci && npm test

  publish-npm:
    needs: test-matrix
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-pypi:
    needs: test-matrix
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: cd ports/python && pip install build && python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: ports/python/dist/
          password: ${{ secrets.PYPI_TOKEN }}

  publish-packagist:
    needs: test-matrix
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trigger Packagist update
        run: |
          curl -XPOST -H'content-type:application/json' \
            "https://packagist.org/api/update-package?username=${{ secrets.PACKAGIST_USER }}&apiToken=${{ secrets.PACKAGIST_TOKEN }}" \
            -d'{"repository":{"url":"https://github.com/codinglombok/lombokpdf-php"}}'

  publish-docker:
    needs: test-matrix
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            lombokdigital/lombokpdf:latest
            lombokdigital/lombokpdf:${{ github.ref_name }}

  publish-github-release:
    needs: [publish-npm, publish-docker]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/lombokpdf.browser.min.js
            dist/lombokpdf.wasm
            sbom.spdx.json
          generate_release_notes: true
```

### Docker Image

```dockerfile
# deploy/docker/Dockerfile
FROM node:22-alpine AS base

# LombokPDF needs no native deps — no Chromium, no Cairo, no Pango
# This is what makes it shine in containers
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS api
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
USER node
CMD ["node", "server.js"]

# Final image: ~120MB vs ~700MB for Puppeteer-based images
```

```yaml
# deploy/docker/docker-compose.yml
version: '3.9'

services:
  lombokpdf-api:
    image: lombokdigital/lombokpdf:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CERT_PASS=${CERT_PASS}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 256M    # vs 1-2GB for Chromium-based services

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - lombokpdf-api
```

### AWS Lambda Layer

```bash
# deploy/aws/publish-layer.sh
#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")

# Create layer package
mkdir -p layer/nodejs
cp -r node_modules layer/nodejs/
zip -r lombokpdf-layer-${VERSION}.zip layer/

# Publish to Lambda
aws lambda publish-layer-version \
  --layer-name lombokpdf \
  --description "LombokPDF v${VERSION} — Apache 2.0" \
  --license-info "Apache-2.0" \
  --zip-file fileb://lombokpdf-layer-${VERSION}.zip \
  --compatible-runtimes nodejs20.x nodejs22.x \
  --compatible-architectures x86_64 arm64
```

### Niagahoster / Shared Hosting Quick-Start (PHP)

```bash
# On Niagahoster cPanel with SSH access
# 1. Enable SSH from cPanel → SSH Access
ssh user@yourdomain.com

# 2. Install Composer if not present
curl -sS https://getcomposer.org/installer | php

# 3. Install LombokPDF
composer require lombok/pdf

# 4. Test
php -r "
  require 'vendor/autoload.php';
  use LombokPDF\LombokPDF;
  \$doc = (new LombokPDF())->from(['template' => 'invoice', 'data' => ['company' => 'Test']])->export('pdf');
  \$doc->save('/public_html/test.pdf');
  echo 'Success!';
"
```

```php
<?php
// public_html/generate-invoice.php — complete working example for shared hosting
require 'vendor/autoload.php';

use LombokPDF\LombokPDF;

$data = [
    'company'   => 'PT Lombok Digital',
    'invoice_no'=> 'INV-2026-001',
    'date'      => date('d F Y'),
    'items'     => [
        ['name' => 'Web Development', 'qty' => 1, 'price' => 5000000],
        ['name' => 'Hosting Setup',   'qty' => 1, 'price' => 500000],
    ],
    'tax_rate'  => 0.11,
];

$pdf = new LombokPDF();
$doc = $pdf
    ->from(['template' => 'invoice', 'data' => $data])
    ->locale('id-ID')
    ->export('pdf');

// Stream to browser
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="invoice.pdf"');
echo $doc->toBytes();
```

### Stage 4 Exit Criteria

```
✅ npm install lombokpdf@1.0.0 works from registry
✅ pip install lombokpdf==1.0.0 works from PyPI
✅ composer require lombok/pdf:^1.0 works from Packagist
✅ go get github.com/codinglombok/lombokpdf@v1.0.0 works
✅ Docker image published, multi-arch, < 150MB
✅ Lambda layer tested in us-east-1
✅ Niagahoster PHP shared hosting guide tested end-to-end
✅ CDN URLs (unpkg, jsDelivr) resolve to correct bundle
✅ All 8 framework adapters have working example apps
```

---

## Stage 5 — Production Hardening

**Goal:** Complete audit suite, benchmark suite, full documentation site, SBOM, security policy, community setup.

### Deliverables

- [ ] Full audit suite
  - [ ] `audit:security` — npm audit + OSV-scanner
  - [ ] `audit:tokens` — custom TokenScanner (secrets, keys)
  - [ ] `audit:sql` — injection pattern scan
  - [ ] `audit:types` — TypeScript strict + PIP 8.3
  - [ ] `audit:licenses` — Apache-2.0/MIT/BSD-only
  - [ ] `audit:sbom` — SPDX 2.3 JSON output
- [ ] Benchmark suite (Vitest bench)
- [ ] Documentation site (Astro Starlight)
  - [ ] Getting started guide
  - [ ] API reference (auto-generated from TypeDoc)
  - [ ] Template gallery (live preview)
  - [ ] i18n guide (per-language examples)
  - [ ] Security guide
  - [ ] Deploy guides (Docker, AWS, Niagahoster, VPS)
  - [ ] Framework cookbook (Vue, React, Laravel, Django, Go, Rails)
- [ ] SECURITY.md + responsible disclosure process
- [ ] CONTRIBUTING.md + PR template
- [ ] Code of conduct
- [ ] Issue templates
- [ ] Dependabot config
- [ ] GitHub Discussions enabled
- [ ] VS Code extension for template IntelliSense

### Audit Scripts

```typescript
// scripts/audit-security.ts
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// 1. npm audit
const audit = JSON.parse(execSync('npm audit --json').toString())
const criticals = audit.metadata.vulnerabilities.critical
const highs = audit.metadata.vulnerabilities.high

if (criticals > 0 || highs > 0) {
  console.error(`❌ AUDIT FAILED: ${criticals} critical, ${highs} high vulnerabilities`)
  process.exit(1)
}

// 2. OSV scanner
execSync('osv-scanner --lockfile package-lock.json', { stdio: 'inherit' })

// 3. Check wkhtmltopdf is not in dep tree (CVE-2023-23104)
const lockfile = readFileSync('package-lock.json', 'utf-8')
if (lockfile.includes('wkhtmltopdf')) {
  console.error('❌ SECURITY: wkhtmltopdf found in dep tree — CVSS 9.8 vulnerability')
  process.exit(1)
}

console.log('✅ Security audit passed')
```

```typescript
// scripts/audit-tokens.ts — TokenScanner
const FORBIDDEN_PATTERNS = [
  /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/gi,
  /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9]{16,}/gi,
  /(?:secret[_-]?key)\s*[:=]\s*['"][^'"]{8,}/gi,
  /AKIA[0-9A-Z]{16}/g,                         // AWS Access Key
  /sk-[a-zA-Z0-9]{48}/g,                        // OpenAI API key pattern
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,       // Private key
]

// Scans all source files, fails on any match
```

### Benchmark Suite

```typescript
// benchmarks/conversion.bench.ts
import { bench, describe } from 'vitest'
import { LombokPDF } from '../src'

const simpleHTML = '<h1>Hello World</h1><p>Simple document.</p>'
const invoiceData = { company: 'Acme', total: 1500, items: Array(10).fill({ name: 'Item', qty: 1, price: 150 }) }

describe('LombokPDF Benchmarks', () => {
  bench('simple HTML → PDF', async () => {
    const doc = await new LombokPDF().from({ html: simpleHTML }).export('pdf')
    await doc.toBytes()
  })

  bench('invoice template id-ID', async () => {
    const doc = await new LombokPDF()
      .from({ template: 'invoice', data: invoiceData })
      .locale('id-ID')
      .export('pdf')
    await doc.toBytes()
  })

  bench('Arabic invoice (RTL)', async () => {
    const doc = await new LombokPDF()
      .from({ template: 'invoice', data: invoiceData })
      .locale('ar-SA')
      .export('pdf')
    await doc.toBytes()
  })
})
```

### SECURITY.md

```markdown
# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a Vulnerability

Please report security vulnerabilities via GitHub Security Advisories:
https://github.com/codinglombok/lombokpdf/security/advisories/new

Do NOT open a public issue for security vulnerabilities.

**Response SLA:** We acknowledge within 48 hours and aim to patch critical issues within 7 days.

## Known Excluded Libraries

- **wkhtmltopdf** — CVSS 9.8 (CVE-2023-23104). This library is archived and contains
  an unpatched critical vulnerability. LombokPDF explicitly excludes it from all
  dependency trees and the audit suite blocks any accidental inclusion.
```

### Documentation Site (Astro Starlight)

```bash
# deploy/docs/
npx create-astro@latest lombokpdf-docs --template starlight

# Structure:
lombokpdf-docs/src/content/docs/
├── index.mdx                    # Landing page
├── getting-started/
│   ├── installation.md
│   ├── quickstart.md
│   └── first-pdf.md
├── guides/
│   ├── templates.md
│   ├── i18n.md
│   ├── skills.md
│   ├── security.md
│   └── performance.md
├── framework/
│   ├── vue.md
│   ├── react.md
│   ├── laravel.md
│   ├── django.md
│   ├── go.md
│   └── rails.md
├── deploy/
│   ├── docker.md
│   ├── aws.md
│   ├── niagahoster.md
│   └── vps.md
├── api/                         # Auto-generated via TypeDoc
└── reference/
    ├── cli.md
    ├── templates.md
    └── locales.md
```

### Stage 5 Exit Criteria

```
✅ audit:security — 0 critical, 0 high
✅ audit:tokens — 0 secrets found
✅ audit:licenses — all Apache-2.0/MIT/BSD
✅ audit:sbom — SPDX 2.3 JSON valid
✅ All benchmarks documented in BENCHMARKS.md
✅ Docs site live at docs.lombokpdf.dev
✅ SECURITY.md published with responsible disclosure process
✅ Dependabot configured for weekly dep updates
✅ GitHub Discussions enabled for community Q&A
✅ 100% TypeDoc coverage on public API
✅ 1.0.0 tagged and released on all 8 registries
```

---

## Summary Timeline

```
Week 1–4:    Stage 1 — Foundation
             ├── LLE WASM v0.1 (JS interim)
             ├── TypeScript package
             ├── 3 templates (invoice, report, letter)
             ├── Basic i18n (5 locales)
             └── npm publish v0.1.0

Week 5–10:   Stage 2 — Polyglot
             ├── Full LLE WASM v1.0
             ├── All 8 language ports
             ├── 12 templates
             ├── 50+ language i18n
             └── PDF/A, PDF/UA output

Week 11–16:  Stage 3 — Skills & Integrations
             ├── All 24 skill modules
             ├── LombokCSS bridge
             ├── LombokCharts bridge
             ├── Browser bundle
             └── Vue + React adapters

Week 17–22:  Stage 4 — Deploy & Ecosystem
             ├── CI/CD full matrix
             ├── Docker multi-arch
             ├── AWS Lambda layer
             ├── All 8 registries
             └── All framework adapters

Week 23–28:  Stage 5 — Production Hardening
             ├── Full audit suite
             ├── Benchmark suite
             ├── Documentation site
             ├── Security policy
             └── v1.0.0 GA release
```

---

*LombokPDF — crafted in Lombok, built for the world.*
