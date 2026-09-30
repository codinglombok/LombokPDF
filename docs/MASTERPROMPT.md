# LombokPDF — Master Prompt

> Copy this prompt into any AI assistant to instantly give it full context about the LombokPDF project.

---

## Project Identity

You are working on **LombokPDF** — a next-generation, cross-language PDF generation library.

- **License:** Apache 2.0
- **Repository:** https://github.com/codinglombok/lombokpdf
- **Docs:** https://docs.lombokpdf.dev
- **NPM:** `lombokpdf`
- **PyPI:** `lombokpdf`
- **Packagist:** `lombok/pdf`
- **Organization:** Lombok Digital (codinglombok)

---

## What LombokPDF Is

LombokPDF synthesizes the best architectural ideas from the entire PDF ecosystem into one coherent, principled library:

| Source | Idea borrowed |
|---|---|
| WeasyPrint | CSS Paged Media, no-browser philosophy |
| PrinceXML | Professional typesetting (footnotes, cross-refs, running headers) |
| PDFKit | Streaming pipeline, programmatic DSL |
| @react-pdf/renderer | Tree-shakeable skill model |
| pdfme | Template-first generation |
| mPDF | Deep RTL + multilingual |
| pdf-lib | No-dependency document manipulation |
| LombokCSS | Design token theming |
| LombokCharts | Grammar-of-graphics charting in PDF |

**Core differentiators:**
1. **No Chromium** — custom LombokLayout Engine (LLE) in Rust/WASM — 10–50 MB RAM vs 85–200 MB
2. **WASM portable core** — one engine, 8 language ports: JS/TS, Python, PHP, Java, Go, Ruby, .NET, Rust
3. **50+ language i18n** — BiDi (UAX #9), HarfBuzz shaping, CLDR, font subsetting built in
4. **Skill architecture** — tree-shakeable: import only what you use
5. **Audit-first** — zero critical CVEs required to ship; wkhtmltopdf (CVSS 9.8) explicitly excluded
6. **Apache 2.0** — unconditionally permissive

---

## Architecture

```
lombokpdf/
├── src/
│   ├── index.ts                    # Public API entry
│   ├── types.ts                    # All TypeScript types
│   ├── browser.ts                  # CDN/browser bundle
│   ├── core/
│   │   ├── LombokPDF.ts            # Main class
│   │   ├── Builder.ts              # Fluent builder
│   │   ├── Document.ts             # Output document
│   │   ├── locale.ts               # Locale resolution (RTL detection, CLDR)
│   │   ├── bidi/resolver.ts        # Unicode BiDi algorithm (UAX #9)
│   │   ├── cssom/parser.ts         # CSS Object Model (Paged Media aware)
│   │   └── lle/
│   │       ├── engine.ts           # LLE: WASM first, JS fallback
│   │       ├── pdfkit-renderer.ts  # Stage 1 PDFKit backend
│   │       └── page.ts             # Page config (A4, Letter, custom)
│   ├── skills/                     # Tree-shakeable capabilities
│   │   ├── io/                     # importDocx, importMarkdown, exportPNG, exportSVG...
│   │   ├── ops/                    # merge, split, rotate, compress, watermark
│   │   ├── image/                  # splitimg, rasterize, crop, ocr
│   │   ├── marks/                  # qrcode, barcode, datamatrix, pdf417
│   │   ├── forms/                  # formFill, formExtract, formCreate, formFlatten
│   │   ├── security/               # signPKCS7, encryptAES, redact, verify
│   │   └── structure/              # toc, footnotes, crossRef, bookmarks
│   ├── templates/
│   │   └── engine.ts               # Handlebars-compatible template engine
│   └── integrations/
│       ├── lombokcss/resolver.ts   # LombokCSS design token bridge
│       └── lombokcharts/index.ts   # LombokCharts SVG embed bridge
├── templates/                      # 12 built-in HTML templates
│   ├── invoice/template.html
│   ├── report/, legal/, certificate/,  letter/, resume/
│   ├── ticket/, label/, receipt/, newsletter/, datasheet/, booklet/
├── ports/                          # Language ports (identical API via WASM ABI)
│   ├── python/   (PyPI: lombokpdf)
│   ├── php/      (Packagist: lombok/pdf)
│   ├── go/       (pkg.go.dev: github.com/codinglombok/lombokpdf)
│   ├── ruby/     (RubyGems: lombok_pdf)
│   ├── java/     (Maven: io.lombok:lombokpdf)
│   ├── dotnet/   (NuGet: LombokPDF)
│   └── rust/     (crates.io: lombokpdf)
├── scripts/
│   ├── audit-security.js           # CVE scan + forbidden packages
│   ├── audit-tokens.js             # Secret/token scanner
│   ├── audit-sql.js                # SQL injection scan
│   └── audit-sbom.js               # SPDX 2.3 SBOM generator
├── tests/unit/                     # Vitest unit tests
├── benchmarks/                     # Vitest bench
├── deploy/
│   ├── docker/                     # Multi-arch Dockerfile, docker-compose
│   ├── aws/                        # Lambda handler, CDK stack
│   └── niagahoster/                # PHP shared hosting setup
├── adapters/                       # Framework adapters
│   ├── vue/, react/, laravel/, django/, nuxt/, nextjs/
├── .github/workflows/
│   ├── ci.yml                      # CI: audit → lint → test matrix → build
│   └── release.yml                 # Release: audit:all → publish everywhere
└── docs/
    ├── MASTERPROMPT.md             # (this file)
    ├── MASTERPROMPT_STAGES.md
    ├── README_FULL_SUMMARY.md
    ├── README_MULTISTAGE.md
    └── HOW_TO_USE.md
```

---

## Core API (TypeScript)

```typescript
// Instantiate
const pdf = new LombokPDF({ locale: 'id-ID', theme: 'modern-corporate-flat' })

// Generate from various sources
const doc = await pdf.from({ html: '<h1>Hello</h1>' }).export('pdf')
const doc = await pdf.from({ markdown: '# Hello' }).export('pdf')
const doc = await pdf.from({ template: 'invoice', data: { company: 'Acme' } }).locale('id-ID').export('pdf')
const doc = await pdf.fromFile('./report.md').export('pdf/a-1b')

// Builder is fully chainable
const doc = await pdf
  .from({ template: 'invoice', data })
  .locale('ar-SA')
  .theme('resonant-stark')
  .page({ size: 'A4', orientation: 'portrait' })
  .metadata({ title: 'Invoice', author: 'Acme' })
  .pipe(watermark({ text: 'CONFIDENTIAL', opacity: 0.1 }))
  .pipe(signPKCS7({ cert: './cert.p12', pass: process.env.CERT_PASS }))
  .pipe(encryptAES({ ownerPassword: 'admin', permissions: ['print'] }))
  .export('pdf/a-1b')

await doc.save('./output.pdf')
// or
const bytes  = await doc.toBytes()
const base64 = await doc.toBase64()
doc.pipe(expressResponse)
```

---

## Supported Locales

Latin (24 langs), Arabic script (RTL: ar-SA, fa-IR, ur-PK, ps-AF), Hebrew (RTL: he-IL),
Devanagari (hi-IN, mr-IN, ne-NP), Bengali (bn-BD), CJK (zh-Hans-CN, zh-Hant-TW, ja-JP, ko-KR),
Thai (th-TH), Khmer (km-KH), Myanmar (my-MM), Cyrillic (ru-RU, uk-UA, bg-BG, sr-RS),
Greek (el-GR), Indonesian (id-ID), Malay (ms-MY), Turkish (tr-TR), and 30+ more.

---

## Security Rules (non-negotiable)

1. **Zero critical/high CVEs** — `npm run audit:security` must pass before any commit
2. **wkhtmltopdf banned** — CVSS 9.8, archived, unpatched. Audit blocks it
3. **No eval(), no innerHTML, no new Function()** — enforced by `audit-security.js`
4. **No secrets in source** — `audit-tokens.js` TokenScanner runs on every PR
5. **All deps SHA-pinned** — `package-lock.json` required
6. **SBOM generated** on every release (`audit-sbom.js` → `sbom.spdx.json`)
7. **Apache 2.0 deps only** — no GPL, AGPL, LGPL in runtime dependencies

---

## Design Principles

- **Explicit over magic** — no hidden rendering passes
- **Lightweight first** — 10–50 MB RAM, no browser process
- **Port-native** — WASM ABI; all 8 ports call the same engine
- **Audit-first** — release blocked on failing audits
- **Skill architecture** — tree-shakeable; import only what you use
- **Apache 2.0** — unconditionally permissive commercial use

---

## Key Integrations

### LombokCSS (https://github.com/codinglombok/LombokCSS)
- 5 design styles: `modern-corporate-flat`, `resonant-stark`, `neo-brutalism`, `semantic-minimalist`, `glassmorphism`
- Token-first (9.7KB gzipped); tokens flow into PDF custom properties
- Bridge: `src/integrations/lombokcss/resolver.ts`

### LombokCharts (https://github.com/codinglombok/LombokCharts)
- Zero-dependency, grammar-of-graphics charting
- Renderers: Canvas (performance) and **SVG (use for PDF — crisp, no rasterization)**
- Chart types: Bar, Line, Area, Arc (Pie/Donut/Gauge), Financial (Candlestick)
- LTTB decimation + real-time streaming layer
- Bridge: `src/integrations/lombokcharts/index.ts`

---

## When You Work on This Project

1. **Always maintain TypeScript strict mode** — zero `any`, no `// @ts-ignore`
2. **All new features need tests** in `tests/unit/`
3. **Run `npm run audit:all` before any PR**
4. **Skills are lazy-loaded** — use dynamic `import()` inside skill modules
5. **Templates use Handlebars syntax** — never raw string interpolation for user data
6. **BiDi must be preserved** — all text routes through `BiDiResolver`
7. **Port parity** — any API added to JS must be added to all 8 ports
8. **No new native dependencies** without explicit justification
9. **SBOM must be regenerated** after any dependency change
10. **Document everything** — JSDoc on all public API surface

---

## Commit Convention

```
feat(core): add PDF/A-2b output support
fix(bidi): correct RTL paragraph detection for mixed scripts
feat(skills/security): add PKCS#7 visible signature field
feat(i18n): add Armenian (hy-AM) locale
feat(template): add booklet template with bleed marks
fix(cli): split command handles bookmark names with spaces
perf(lle): LTTB decimation for large table rendering
docs(api): complete JSDoc for Builder.pipe()
test(skills): add formFill edge case for checkbox arrays
chore(deps): update parse5 to 7.1.3
security: remove dependency X (CVE-2026-XXXXX)
```

---

## Release Checklist

```bash
# 1. All audits must pass
npm run audit:all

# 2. All tests must pass on all OS/Node combinations
npm test

# 3. Build must succeed
npm run build

# 4. Verify dist artifacts
ls dist/index.js dist/index.cjs dist/index.d.ts dist/browser.js

# 5. Port tests
cd ports/python && pytest
cd ports/php    && composer test
cd ports/go     && go test ./...

# 6. SBOM generated
test -f sbom.spdx.json

# 7. Tag and push (triggers release workflow)
npm version patch|minor|major
git push --follow-tags
```
