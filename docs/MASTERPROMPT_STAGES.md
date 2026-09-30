# LombokPDF — Master Prompt: Stage-by-Stage Development

> Use this prompt when working with an AI assistant on a specific development stage.
> Paste the **Project Identity** section + the **relevant Stage section** for focused guidance.

---

## Project Identity (always include this)

**LombokPDF** — Lightweight, elegant, polyglot PDF generation. Apache 2.0.
Repo: https://github.com/codinglombok/lombokpdf
Stack: TypeScript (canonical) → Rust/WASM (LLE engine) → 8 language ports

**Core rules that never change:**
- Zero critical/high CVEs — `npm run audit:all` must pass before every commit
- No `eval()`, no `innerHTML`, no `new Function()` anywhere in source
- No secrets in source — TokenScanner blocks them
- TypeScript strict mode — zero `any`, zero `// @ts-ignore`
- All skills are lazy-loaded via dynamic `import()`
- All user-controlled strings route through `BiDiResolver` before rendering
- Apache 2.0 runtime deps only (no GPL/AGPL/LGPL)

---

## Stage 1 — Foundation Prompt

**Objective:** Ship `lombokpdf@0.1.0` to npm. JS/TS only. PDFKit backend. Basic i18n.

**You are implementing:**
- `LombokPDF` class → `Builder` → `Document` fluent chain
- `LLEEngine` (Stage 1: PDFKit-backed JS, no WASM yet)
- `locale()` resolver — detects RTL for `ar-*`, `he-*`, `fa-*`, `ur-*`
- `BiDiResolver` — Unicode UAX #9 heuristic (paragraph-level)
- `TemplateEngine` — Handlebars-compatible, YAML front-matter, 3 templates: `invoice`, `report`, `letter`
- `CSSOMParser` — parses `<style>` blocks, `@page` rules (basic subset)
- CLI: `lombokpdf convert`, `lombokpdf render`
- `audit:security`, `audit:tokens`, `audit:types` scripts
- Unit tests for `LombokPDF`, `Builder`, `Document`, `resolveLocale`, `BiDiResolver`

**File targets (Stage 1):**
```
src/index.ts            ← public API
src/types.ts            ← all TypeScript types
src/core/LombokPDF.ts   ← main class
src/core/Builder.ts     ← fluent builder
src/core/Document.ts    ← output document
src/core/locale.ts      ← locale + RTL detection
src/core/bidi/resolver.ts      ← BiDi
src/core/cssom/parser.ts       ← CSS parser stub
src/core/lle/engine.ts         ← LLE (PDFKit backend)
src/core/lle/pdfkit-renderer.ts← PDFKit render
src/core/lle/page.ts           ← page size/margins
src/templates/engine.ts        ← Handlebars engine
templates/invoice/template.html
templates/report/template.html
templates/letter/template.html
src/cli/index.ts               ← CLI (convert + render)
scripts/audit-security.js
scripts/audit-tokens.js
package.json, tsconfig.json, tsup.config.ts, vitest.config.ts
tests/unit/LombokPDF.test.ts
tests/unit/skills.test.ts
```

**Stage 1 exit criteria (ALL must pass):**
```bash
npm run audit:types    # 0 TypeScript errors (strict)
npm run audit:security # 0 critical, 0 high CVEs
npm run audit:tokens   # 0 secrets found
npm test               # all tests green
npm run build          # dist/ produced
node -e "import('lombokpdf').then(m => console.log(m.LombokPDF.version()))"
# → prints version
```

**Coding conventions for Stage 1:**
- Every public method gets JSDoc with `@example`
- All imports use `.js` extension (ESM)
- `async/await` everywhere — no raw Promise chains
- `LLEEngine` class exposes one method: `render(html, opts): Promise<Uint8Array>`
- `Builder` methods are all `return this` except `export()` which returns `Promise<Document>`
- `Document` is immutable — `setMetadata()` returns a **new** Document
- Skills always return `Promise<Document>` and never mutate input

---

## Stage 2 — Polyglot Prompt

**Objective:** Full WASM LLE core, all 8 language ports, complete i18n, all 12 templates, PDF/A output.

**You are implementing:**
- Rust/WASM `LombokLayout Engine` (LLE) v1.0
  - Full CSS Paged Media Level 3 (`@page`, `:left`/`:right`, running elements, counters)
  - Flexbox + CSS Grid Level 1
  - HarfBuzz font shaping (Arabic ligatures, Indic conjuncts, CJK glyph selection)
  - Unicode UAX #9 full BiDi (paragraph + character level)
  - Unicode UAX #14 line-breaking (Thai, CJK, Khmer)
  - PDF/A-1b, PDF/A-2b, PDF/UA streaming writer
  - Font subsetting (woff2 → PDF embedded subset)
- Language ports (all call WASM ABI via FFI):
  - `ports/python/` — PyPI: `lombokpdf`, uses `wasmtime-py`
  - `ports/php/` — Packagist: `lombok/pdf`, uses PHP FFI + ext-ffi
  - `ports/java/` — Maven: `io.lombok:lombokpdf`, uses GraalVM WASM or Wasmtime-Java
  - `ports/go/` — pkg.go.dev, uses `wazero` (pure Go WASM runtime)
  - `ports/ruby/` — RubyGems: `lombok_pdf`, uses `wasmer-ruby`
  - `ports/dotnet/` — NuGet: `LombokPDF`, uses `Wasmtime.NET`
  - `ports/rust/` — crates.io: `lombokpdf`, calls LLE directly (no FFI overhead)
- All 12 templates (9 new: `legal`, `certificate`, `resume`, `ticket`, `label`, `receipt`, `newsletter`, `datasheet`, `booklet`)
- i18n completion: 50+ locales, all scripts in `locale.ts`
- `importMarkdown`, `importDocx` skills
- `exportPDFA`, `exportPNG` skills
- CI matrix: test all 8 ports in `ports.yml`

**WASM ABI (C header that all ports target):**
```c
LombokCtx* lombok_ctx_new(const char* options_json);
void        lombok_ctx_free(LombokCtx* ctx);
LombokDoc* lombok_render_html(LombokCtx*, const char* html, size_t len, const char* opts_json);
LombokDoc* lombok_render_template(LombokCtx*, const char* tmpl_id, const char* data_json, const char* opts_json);
uint8_t*   lombok_doc_to_bytes(LombokDoc*, size_t* out_len);
int        lombok_doc_page_count(LombokDoc*);
void       lombok_doc_free(LombokDoc*);
uint8_t*   alloc(size_t len);
void       free(uint8_t* ptr);
```

**Stage 2 exit criteria:**
```bash
# WASM
wasm-pack test --node            # Rust WASM tests pass

# Port parity — all must produce identical output for reference fixture
node   tests/integration/port-parity.js
python tests/integration/port-parity.py
php    tests/integration/port-parity.php
go test ./tests/integration/...

# PDF/A validation
java -jar veraPDF.jar dist/test.pdf-a-1b.pdf  # PASS

# PDF/UA accessibility
node -e "import('lombokpdf').then(async m => {
  const doc = await new m.LombokPDF().from({html:'<h1>Test</h1>'}).export('pdf/ua')
  console.log('Pages:', doc.pages())
})"

# All 12 templates render
for tmpl in invoice report legal certificate letter resume ticket label receipt newsletter datasheet booklet; do
  lombokpdf render --template $tmpl --data '{}' -o /tmp/$tmpl.pdf && echo "✓ $tmpl"
done
```

**Port implementation pattern (use for all ports):**
```
1. Load WASM from package assets or CDN
2. Allocate WASM memory for input strings (UTF-8)
3. Call lombok_render_html / lombok_render_template
4. Copy output bytes from WASM memory
5. Free all WASM allocations
6. Wrap bytes in native Document class
7. Implement identical Builder fluent API
8. Implement identical skills via WASM skill exports
```

---

## Stage 3 — Skills & Integrations Prompt

**Objective:** All 24 skill modules, LombokCSS/LombokCharts bridges, browser bundle, Vue/React adapters.

**You are implementing:**

### Skills (all lazy-loaded via dynamic import)

**io skills** (`src/skills/io/`):
- `importDocx.ts` — DOCX→HTML via `mammoth` + style mapping
- `importMarkdown.ts` — GFM via `marked` + `marked-gfm-heading-id`
- `importHTML.ts` — full HTML5 parse + CSS inline with `parse5`
- `importCSV.ts` — CSV→`<table>` with `papaparse`
- `exportPNG.ts` — rasterize via `sharp` or canvas
- `exportSVG.ts` — PDF page → SVG vector via LLE
- `exportPDFA.ts` — post-process to PDF/A-1b or PDF/A-2b compliance
- `exportPDFUA.ts` — add tagged PDF structure for accessibility

**ops skills** (`src/skills/ops/`):
- `pdf-merger.ts` — merge via `pdf-lib`
- `pdf-splitter.ts` — split by range/bookmark via `pdf-lib`
- `pdf-rotator.ts` — page rotation
- `pdf-compressor.ts` — image downsampling via `sharp`, font dedup
- `pdf-watermarker.ts` — text/image watermark overlay

**image skills** (`src/skills/image/`):
- `splitimg-processor.ts` — load image → slice → grid PDF
- `rasterizer.ts` — SVG/HTML→PNG via `sharp`
- `image-cropper.ts` — region extraction via `sharp`
- `ocr-processor.ts` — Tesseract.js text layer

**marks skills** (`src/skills/marks/`):
- `qrcode-generator.ts` — ISO/IEC 18004 via `qrcode` library
- `barcode-generator.ts` — Code128/EAN/UPC via `jsbarcode`
- `datamatrix-generator.ts` — Data Matrix (ISO/IEC 16022)
- `pdf417-generator.ts` — stacked barcode

**forms skills** (`src/skills/forms/`):
- `acroform-filler.ts` — fill fields via `pdf-lib`
- `acroform-extractor.ts` — extract field values
- `acroform-creator.ts` — create interactive fields
- `acroform-flattener.ts` — flatten to static

**security skills** (`src/skills/security/`):
- `pkcs7.ts` — PKCS#7 signature via `node-forge`
- `aes-encryptor.ts` — AES-256 via `pdf-lib` encryption
- `redactor.ts` — permanent content removal
- `verifier.ts` — verify signature chain

**structure skills** (`src/skills/structure/`):
- `toc-generator.ts` — inject TOC after page 1
- `footnote-processor.ts` — layout footnotes/endnotes
- `crossref-processor.ts` — number figures/tables
- `bookmark-generator.ts` — outline tree from headings
- `running-header-processor.ts` — per-page headers/footers

### Integrations

**LombokCSS bridge** (`src/integrations/lombokcss/`):
```typescript
// resolver.ts already done — extend with:
// - Token live-reload in debug mode
// - Custom token override map
// - CSS variable injection into PDF <style>
```

**LombokCharts bridge** (`src/integrations/lombokcharts/index.ts`):
```typescript
import type { Chart } from '@lombok/charts'

export async function embedChartInPDF(
  raw: Uint8Array,
  chart: Chart,
  position: EmbedPosition
): Promise<Uint8Array> {
  // 1. Force SVG renderer: chart.render({ renderer: 'svg', width, height })
  // 2. Parse SVG string
  // 3. Use pdf-lib to embed SVG as XObject at position
  // 4. Return modified PDF bytes
}
```

### Browser bundle
```typescript
// src/browser.ts — already stubbed, complete with:
// - ready() function that pre-compiles WASM
// - Fallback to JS backend if WASM load fails
// - Bundle size target: < 500KB gzipped (core only, skills lazy-loaded)
```

### Framework adapters
- `adapters/vue/` — `<LombokPDFPreview>` component + `useLombokPDF()` composable
- `adapters/react/` — `<LombokPDFViewer>` + `useLombokPDF()` hook
- `adapters/laravel/` — ServiceProvider + Facade + `LombokPDF::template()`
- `adapters/django/` — `render_pdf()` view helper + settings
- `adapters/nuxt/` — Nuxt module + `defineLombokPDFHandler()`
- `adapters/nextjs/` — `lombokpdf-nextjs` example + App Router pattern

**Stage 3 exit criteria:**
```bash
# All 24 skills importable and typed correctly
npx tsc --noEmit

# merge test
node -e "
const { LombokPDF } = await import('./dist/index.js')
const { merge } = await import('./dist/skills/ops/index.js')
const pdf = new LombokPDF()
const [a, b] = await Promise.all([
  pdf.from({html:'<p>Page 1</p>'}).export('pdf'),
  pdf.from({html:'<p>Page 2</p>'}).export('pdf'),
])
const merged = await merge([a, b])
console.log('Pages:', merged.pages()) // → 2
"

# splitimg test
lombokpdf splitimg tests/fixtures/sample.jpg --cols 3 --rows 3 -o /tmp/grid.pdf
file /tmp/grid.pdf  # → PDF document

# Browser bundle
ls -la dist/browser.js  # exists, < 2MB

# Vue adapter builds
cd adapters/vue && npm run build
```

---

## Stage 4 — Deploy & Ecosystem Prompt

**Objective:** All registries published, Docker multi-arch, AWS Lambda, Niagahoster ready, all framework adapters stable.

**You are implementing:**

### CI/CD (`.github/workflows/`)
- `ci.yml` — audit → lint → test matrix (3 OS × 3 Node) → build → port tests → security hardening
- `release.yml` — audit:all → build → npm publish → PyPI → Packagist → crates.io → NuGet → Maven → Docker → GitHub Release
- `dependabot.yml` — weekly dep updates for all ecosystems
- `codeql.yml` — CodeQL security scanning on push to main

### Docker
- `deploy/docker/Dockerfile` — multi-stage, non-root user, read-only FS, no Chromium
- `deploy/docker/docker-compose.yml` — API + Nginx, resource limits (256MB), health checks
- `deploy/docker/nginx/nginx.conf` — rate limiting, CSP headers, proxy to API

### AWS
- `deploy/aws/lambda-handler.ts` — API Gateway handler, S3 output option
- `deploy/aws/lambda-layer.sh` — publish Lambda layer script
- `deploy/aws/cdk-stack.ts` — CDK stack: ECS Fargate + ALB + CloudFront
- `deploy/aws/sam-template.yaml` — SAM template for Lambda deployment

### Niagahoster / VPS
- `deploy/niagahoster/setup.sh` — PHP setup script (already done)
- `deploy/niagahoster/nginx-vps.conf` — VPS nginx config
- `deploy/niagahoster/supervisor.conf` — process manager for Node.js service on VPS

### Registry configs
- `deploy/npm/` — `.npmignore`, publish workflow hooks
- `deploy/packagist/` — GitHub webhook config for auto-update
- `deploy/cdn/` — unpkg/jsDelivr config and browser ESM imports

**nginx config for Docker:**
```nginx
# deploy/docker/nginx/nginx.conf
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'";
    add_header Referrer-Policy no-referrer;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";

    # Rate limiting: 10 req/s per IP for PDF generation
    limit_req_zone $binary_remote_addr zone=pdf_gen:10m rate=10r/s;
    limit_req zone=pdf_gen burst=20 nodelay;

    location / {
        proxy_pass         http://lombokpdf-api:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;

        # PDF responses can be large
        proxy_buffer_size        128k;
        proxy_buffers            8 256k;
        proxy_busy_buffers_size  512k;
    }

    location /health { proxy_pass http://lombokpdf-api:3000/health; }
}
```

**Stage 4 exit criteria:**
```bash
# All registries
npm install lombokpdf@latest && node -e "require('lombokpdf')"
pip install lombokpdf && python -c "from lombokpdf import LombokPDF; print(LombokPDF.version())"
composer require lombok/pdf && php -r "require 'vendor/autoload.php'; echo LombokPDF\LombokPDF::version();"
go get github.com/codinglombok/lombokpdf && go run ./examples/hello.go

# Docker
docker pull lombokdigital/lombokpdf:latest
docker run --rm lombokdigital/lombokpdf:latest node -e "import('lombokpdf').then(m=>console.log(m.LombokPDF.version()))"

# Lambda (test via SAM local)
sam local invoke LombokPDFFunction --event tests/events/generate-invoice.json

# CDN
curl -I https://unpkg.com/lombokpdf/dist/browser.js | grep "200 OK"
```

---

## Stage 5 — Production Hardening Prompt

**Objective:** Complete audit suite, benchmark suite, docs site, security policy, v1.0.0 GA.

**You are implementing:**

### Audit suite (all blocking for release)
```bash
npm run audit:security   # CVE scan + forbidden packages + source patterns
npm run audit:tokens     # TokenScanner — 40+ secret patterns
npm run audit:sql        # SQL injection patterns
npm run audit:types      # TypeScript strict, 0 errors
npm run audit:licenses   # Apache-2.0/MIT/BSD only
npm run audit:sbom       # SPDX 2.3 JSON generation
```

### Benchmark suite (`benchmarks/`)
- `conversion.bench.ts` — simple HTML, table, multi-page, Arabic, invoice template
- `skills.bench.ts` — merge 10 docs, split 100-page, sign, encrypt, compress
- `i18n.bench.ts` — 20 locales × 1-page document
- `memory.bench.ts` — 100 concurrent conversions, peak RSS measurement
- `compare.bench.ts` — LombokPDF vs WeasyPrint vs jsPDF (output to `BENCHMARKS.md`)

### Documentation site (Astro Starlight)
Structure at `docs-site/src/content/docs/`:
```
index.mdx                 # Landing — why LombokPDF
getting-started/
  installation.md          # npm/pip/composer/go/cargo
  quickstart.md            # 5-minute first PDF
  first-pdf.md             # Full walkthrough
guides/
  templates.md             # All 12 templates + custom templates
  i18n.md                  # Locale guide, RTL, CJK, font setup
  skills.md                # All skill modules with examples
  security.md              # Sign, encrypt, redact
  performance.md           # Benchmarks, tips, Lambda sizing
  css-paged-media.md       # @page, running headers, footnotes
framework/
  vue.md / react.md / laravel.md / django.md / go.md / rails.md / nextjs.md / nuxt.md
deploy/
  docker.md / aws.md / niagahoster.md / vps.md
api/                       # Auto-generated from TypeDoc
reference/
  cli.md                   # Full CLI reference
  templates.md             # Template variable reference
  locales.md               # All 50+ locale codes
  skills.md                # All skill options
```

### SECURITY.md
```markdown
## Reporting
GitHub Security Advisories → https://github.com/codinglombok/lombokpdf/security/advisories/new
Response: ACK within 48h, patch within 7 days for critical

## Known excluded libraries
- wkhtmltopdf: CVSS 9.8 (CVE-2023-23104) — archived, unpatched. Explicitly banned.
```

### v1.0.0 release tag actions
```bash
git tag v1.0.0 -m "LombokPDF v1.0.0 GA"
git push origin v1.0.0
# → triggers release.yml:
#   audit:all → build → npm → PyPI → Packagist → Docker → Maven → NuGet → crates.io → GitHub Release
```

**Stage 5 exit criteria (final v1.0.0 checklist):**
```
✅ npm run audit:all — all 6 audits pass
✅ npm test — 100% pass, coverage ≥ 80%
✅ npm run bench — results in benchmarks/results.json
✅ BENCHMARKS.md published with comparison table
✅ docs site live at docs.lombokpdf.dev
✅ SECURITY.md published
✅ CONTRIBUTING.md published
✅ CHANGELOG.md complete through v1.0.0
✅ All 8 ports at v1.0.0 on their respective registries
✅ Docker image at lombokdigital/lombokpdf:1.0.0 + :latest
✅ SBOM published in GitHub release assets
✅ GitHub Discussions enabled
✅ VS Code extension published (lombokpdf-vscode)
✅ TypeDoc API reference live at docs.lombokpdf.dev/api
✅ Zero open P0/P1 issues
```

---

## Quick Reference: Key File Locations

| What | Where |
|---|---|
| Public API | `src/index.ts` |
| All types | `src/types.ts` |
| Main class | `src/core/LombokPDF.ts` |
| Fluent builder | `src/core/Builder.ts` |
| Output document | `src/core/Document.ts` |
| Locale/RTL | `src/core/locale.ts` |
| BiDi algorithm | `src/core/bidi/resolver.ts` |
| CSS parser | `src/core/cssom/parser.ts` |
| LLE engine | `src/core/lle/engine.ts` |
| Template engine | `src/templates/engine.ts` |
| All skills barrel | `src/skills/index.ts` |
| LombokCSS bridge | `src/integrations/lombokcss/resolver.ts` |
| LombokCharts bridge | `src/integrations/lombokcharts/index.ts` |
| CLI | `src/cli/index.ts` |
| Browser bundle | `src/browser.ts` |
| Security audit | `scripts/audit-security.js` |
| Token scanner | `scripts/audit-tokens.js` |
| SQL scan | `scripts/audit-sql.js` |
| SBOM generator | `scripts/audit-sbom.js` |
| CI pipeline | `.github/workflows/ci.yml` |
| Release pipeline | `.github/workflows/release.yml` |
| Dockerfile | `deploy/docker/Dockerfile` |
| Lambda handler | `deploy/aws/lambda-handler.ts` |
| Hosting setup | `deploy/niagahoster/setup.sh` |
| Full docs | `docs/HOW_TO_USE.md` |
| This file | `docs/MASTERPROMPT_STAGES.md` |
