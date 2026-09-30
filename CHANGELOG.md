# Changelog

All notable changes to LombokPDF are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

*(Next version changes go here)*

---

## [1.0.0] — 2026-07-20

### Initial Release

LombokPDF v1.0.0 — the first stable release of the next-generation,
cross-language, audit-hardened PDF generation library.

### Added

#### Core Engine
- `LombokPDF` class with fluent `Builder` → `Document` API
- `LombokLayout Engine (LLE)` v1.0 compiled to WASM
  - Full CSS Paged Media Level 3 (`@page`, `:left/:right`, named pages, running elements)
  - Flexbox and CSS Grid Level 1 layout
  - Unicode BiDi algorithm (UAX #9) — paragraph and character level
  - Unicode line-breaking (UAX #14) — Thai, CJK, Khmer, Arabic
  - OpenType font shaping via HarfBuzz (ligatures, conjuncts, contextual alternates)
  - Font subsetting — only used glyphs embedded
  - PDF/A-1b, PDF/A-2b, PDF/UA streaming writer

#### Internationalization
- 50+ supported locales across 15+ writing systems
- Latin Extended (24 languages)
- Arabic script RTL: Arabic, Persian, Urdu, Pashto
- Hebrew script RTL: Hebrew, Yiddish
- Devanagari: Hindi, Marathi, Nepali
- Bengali, Tamil, Telugu, Kannada, Malayalam
- CJK: Chinese Simplified, Chinese Traditional, Japanese, Korean
- Thai, Khmer, Myanmar, Lao
- Cyrillic: Russian, Ukrainian, Bulgarian, Serbian, Belarusian
- Greek (modern and polytonic)
- Ethiopic (Amharic), Armenian, Georgian, Azerbaijani
- CLDR number/date/currency formatting per locale
- Automatic RTL detection from locale tag
- Automatic font selection (Noto Sans family)

#### Input Sources
- HTML5 (fragment or full document)
- GitHub-Flavored Markdown (GFM with tables, fenced code, task lists)
- DOCX (via `importDocx` skill — preserves tables, headings, formatting)
- CSV (via `importCSV` skill — auto-table with configurable delimiter)
- File path (auto-detect format from extension)
- URL (fetch and render)

#### Output Formats
- PDF 1.7
- PDF/A-1b (ISO 19005-1)
- PDF/A-2b (ISO 19005-2)
- PDF/UA (ISO 14289-1 — tagged PDF accessibility)
- PNG (page rasterization)
- SVG (vector page export)

#### Templates (12 built-in)
- `invoice` — professional invoice with i18n currency/date formatting
- `report` — executive report with running headers and charts
- `legal` — legal contract with clause numbering
- `certificate` — award/completion certificate
- `letter` — formal business letter
- `resume` — resume/CV
- `ticket` — event ticket with integrated barcode
- `label` — shipping label
- `receipt` — point-of-sale receipt
- `newsletter` — multi-column editorial layout
- `datasheet` — technical specification sheet
- `booklet` — brochure/booklet with bleed marks
- Custom template support (Markdown + YAML front-matter, Handlebars syntax)
- Template helpers: `currency`, `percent`, `date`, `upper`, `lower`, `truncate`, `pad`, `nl2br`

#### Skill Modules (24 skills)
- **IO:** `importDocx`, `importMarkdown`, `importHTML`, `importCSV`, `exportPNG`, `exportSVG`, `exportPDFA`, `exportPDFUA`
- **Ops:** `merge`, `split`, `rotate`, `compress`, `watermark`
- **Image:** `splitimg`, `rasterize`, `crop`, `ocr`
- **Marks:** `qrcode` (ISO 18004), `barcode` (Code128/EAN/UPC), `datamatrix`, `pdf417`
- **Forms:** `formFill`, `formExtract`, `formCreate`, `formFlatten`
- **Security:** `signPKCS7`, `encryptAES`, `redact`, `verify`
- **Structure:** `toc`, `footnotes`, `crossRef`, `bookmarks`, `runningHeaders`

#### Language Ports (8 ports)
- JavaScript/TypeScript — npm: `lombokpdf`
- Python — PyPI: `lombokpdf`
- PHP — Packagist: `lombok/pdf`
- Java — Maven Central: `io.lombok:lombokpdf:1.0.0`
- Go — pkg.go.dev: `github.com/codinglombok/lombokpdf`
- Ruby — RubyGems: `lombok_pdf`
- .NET/C# — NuGet: `LombokPDF`
- Rust — crates.io: `lombokpdf`

All ports implement the identical public API via the WASM ABI.

#### Framework Adapters
- Vue.js: `lombokpdf-vue` (`<LombokPDFPreview>` + `useLombokPDF()`)
- React: `lombokpdf-react` (`<LombokPDFViewer>` + `useLombokPDF()`)
- Laravel: `lombok/pdf-laravel` (ServiceProvider + Facade)
- Django: `lombokpdf-django` (`render_pdf()` view helper)
- Nuxt: `lombokpdf-nuxt` (Nuxt module)
- Next.js: example App Router handler
- Express: streaming response example
- Go Fiber: handler wrapper

#### Design Themes (LombokCSS integration)
- `modern-corporate-flat`
- `resonant-stark`
- `neo-brutalism`
- `semantic-minimalist`
- `glassmorphism`
- Custom token override support

#### Charting (LombokCharts integration)
- Embed Bar, Line, Area, Arc, Financial charts as crisp SVG
- Template `{{chart}}` helper
- LTTB decimation for large datasets

#### CLI
- `lombokpdf convert` — HTML/MD/DOCX to PDF
- `lombokpdf render` — template rendering
- `lombokpdf merge` — combine PDFs
- `lombokpdf split` — extract pages
- `lombokpdf splitimg` — image to grid PDF
- `lombokpdf form fill/extract` — AcroForm operations
- `lombokpdf sign` — PKCS#7 signature
- `lombokpdf audit` — document inspection

#### Browser Bundle
- ESM bundle (`dist/browser.js`) for CDN/browser use
- WASM loaded asynchronously via `ready()`
- `< 500KB gzipped` (core only, skills lazy-loaded)
- unpkg, jsDelivr CDN support

#### Security & Auditing
- `audit:security` — CVE scan + forbidden package check + source patterns
- `audit:tokens` — 40+ secret pattern scanner (TokenScanner)
- `audit:sql` — SQL injection pattern scan
- `audit:types` — TypeScript strict mode enforcement
- `audit:licenses` — Apache-2.0/MIT/BSD compatibility check
- `audit:sbom` — SPDX 2.3 Software Bill of Materials generator
- wkhtmltopdf (CVSS 9.8) explicitly banned and blocked by audit

#### Deployment
- Docker: multi-arch (`linux/amd64`, `linux/arm64`) image, ~120MB, non-root user
- AWS Lambda: handler + pre-built Lambda layer
- AWS ECS: CDK stack (Fargate)
- AWS SAM: SAM template
- Niagahoster/shared hosting: PHP setup script
- VPS: nginx config + PM2 supervisor config

#### CI/CD
- GitHub Actions CI: audit → lint → test matrix (3 OS × 3 Node) → build → port tests → security hardening
- GitHub Actions Release: full audit → build → publish to all 8 registries → Docker → GitHub Release
- Dependabot: weekly dep updates for npm, pip, Composer, Go, Cargo, Maven, NuGet
- CodeQL: code scanning on push to main

#### Documentation
- `README.md` — standard GitHub readme
- `docs/HOW_TO_USE.md` — complete user documentation (this doc)
- `docs/README_FULL_SUMMARY.md` — exhaustive project summary
- `docs/README_MULTISTAGE.md` — 5-stage implementation roadmap
- `docs/MASTERPROMPT.md` — AI assistant context document
- `docs/MASTERPROMPT_STAGES.md` — stage-by-stage AI development prompts
- `SECURITY.md` — vulnerability reporting policy
- `CONTRIBUTING.md` — contributor guide
- `CHANGELOG.md` — this file

### Security

- Zero critical CVEs at launch (verified by OSV scanner + npm audit)
- All production dependencies SHA-512 integrity pinned
- SBOM published as release artifact (`sbom.spdx.json`)
- wkhtmltopdf (CVSS 9.8) explicitly blocked by audit tooling

### Performance

| Document | RAM | Time (M3) |
|---|---|---|
| Simple invoice (1 page) | ~12 MB | ~45ms |
| 10-page report with tables | ~22 MB | ~120ms |
| 50-page legal document | ~35 MB | ~480ms |
| 100-page book (CJK) | ~48 MB | ~920ms |

---

[Unreleased]: https://github.com/codinglombok/lombokpdf/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/codinglombok/lombokpdf/releases/tag/v1.0.0
