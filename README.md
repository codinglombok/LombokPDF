# LombokPDF

**Lightweight · Elegant · Polyglot · Apache 2.0**

> The PDF generation library built by distilling the best of every open-source engine into one coherent, audited, production-ready core.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/lombokpdf.svg)](https://npmjs.com/package/lombokpdf)
[![PyPI](https://img.shields.io/pypi/v/lombokpdf.svg)](https://pypi.org/project/lombokpdf)
[![Packagist](https://img.shields.io/packagist/v/lombok/pdf.svg)](https://packagist.org/packages/lombok/pdf)
[![Security](https://img.shields.io/badge/audit-0%20critical-brightgreen.svg)](SECURITY.md)
[![i18n](https://img.shields.io/badge/i18n-50%2B%20languages-orange.svg)](docs/i18n.md)

---

## Why LombokPDF?

| Problem with existing tools | LombokPDF solution |
|---|---|
| Puppeteer/Playwright need Chromium (85–200 MB RAM) | Custom LombokLayout Engine — 10–50 MB, no browser |
| WeasyPrint is Python-only | 8 language ports, identical API via WASM core |
| jsPDF/PDFKit have no CSS Paged Media | Full CSS Paged Media + Flexbox + Grid |
| mPDF is GPL, iText is AGPL | **Apache 2.0** — no license drama, no revenue caps |
| wkhtmltopdf: CVSS 9.8 archived vulnerability | Zero critical CVEs, audited every release |
| RTL + CJK breaks most libraries | Built-in BiDi, HarfBuzz shaping, 50+ language i18n |
| Template systems are afterthoughts | 12 built-in templates, Handlebars-compatible engine |

---

## Quick Start

### JavaScript / TypeScript

```bash
npm install lombokpdf
# bun add lombokpdf
```

```typescript
import { LombokPDF } from 'lombokpdf';

const pdf = new LombokPDF();

// From HTML
const doc = await pdf
  .from({ html: '<h1>Hello, World</h1>' })
  .locale('en-US')
  .export('pdf');
await doc.save('./output.pdf');

// From template
const invoice = await pdf
  .from({ template: 'invoice', data: { company: 'Acme Corp', total: 1500 } })
  .locale('en-US')
  .export('pdf/a-1b');
await invoice.save('./invoice.pdf');
```

### Python

```bash
pip install lombokpdf
```

```python
from lombokpdf import LombokPDF

doc = LombokPDF().from_html('<h1>مرحباً</h1>').locale('ar-SA').export('pdf')
doc.save('output.pdf')
```

### PHP / Composer

```bash
composer require lombok/pdf
```

```php
use LombokPDF\LombokPDF;

$doc = (new LombokPDF())
  ->from(['template' => 'invoice', 'data' => $data])
  ->locale('id-ID')
  ->export('pdf');
$doc->save('output.pdf');
```

### Other Ports

| Language | Install |
|---|---|
| **Java** | `io.lombok:lombokpdf:1.0.0` via Maven/Gradle |
| **Go** | `go get github.com/codinglombok/lombokpdf` |
| **Ruby** | `gem install lombok_pdf` |
| **.NET / C#** | `dotnet add package LombokPDF` |
| **Rust** | `lombokpdf = "1.0"` in Cargo.toml |

---

## Features

- **No Chromium required** — custom LLE engine, 10–50 MB RAM
- **CSS Paged Media** — page breaks, running headers, page numbers, footnotes
- **50+ language i18n** — Arabic/Hebrew RTL, CJK, Devanagari, Thai, Cyrillic
- **12 built-in templates** — invoice, report, legal, certificate, letter, resume, ticket, label, receipt, newsletter, datasheet, booklet
- **Tree-shakeable skills** — import only merge, split, sign, encrypt, barcode, QR, form-fill, OCR, etc.
- **LombokCSS integration** — design token theming
- **LombokCharts integration** — crisp SVG charts embedded in PDF
- **Apache 2.0** — use freely in commercial projects

---

## Skill Modules

```typescript
import { merge, split, splitimg, watermark }       from 'lombokpdf/skills';
import { importDocx, importMarkdown, exportPng }   from 'lombokpdf/skills/io';
import { formFill, signPKCS7, encryptAES, redact } from 'lombokpdf/skills/security';
import { qrcode, barcode }                         from 'lombokpdf/skills/marks';
import { toc, footnotes, crossRef }                from 'lombokpdf/skills/structure';
```

---

## CLI

```bash
npm install -g lombokpdf

lombokpdf convert index.html -o out.pdf
lombokpdf render invoice.md --template invoice --locale id-ID -o faktur.pdf
lombokpdf merge a.pdf b.pdf -o merged.pdf
lombokpdf split doc.pdf --pages 1-5 -o part1.pdf
lombokpdf splitimg photo.jpg --cols 3 --rows 4 -o grid.pdf
lombokpdf form fill template.pdf --data fields.json -o filled.pdf
lombokpdf sign doc.pdf --cert cert.p12 -o signed.pdf
lombokpdf audit doc.pdf
```

---

## Framework Integrations

```bash
# Vue
npm install lombokpdf lombokpdf-vue

# React
npm install lombokpdf lombokpdf-react

# Laravel
composer require lombok/pdf-laravel

# Django
pip install lombokpdf-django

# Go Fiber
go get github.com/codinglombok/lombokpdf-fiber
```

---

## Security

```bash
npm run audit:security   # 0 critical, 0 high CVEs
npm run audit:tokens     # no secrets in source
npm run audit:types      # TypeScript strict, zero `any`
npm run audit:sql        # injection scan
```

---

## Performance

| Engine | RAM / conversion | Cold start | CSS Paged Media |
|---|---|---|---|
| **LombokPDF** | **10–50 MB** | **~80ms** | Yes |
| Puppeteer | 85–200 MB | ~2,000ms | Yes |
| WeasyPrint | 30–100 MB | ~200ms | Yes |
| jsPDF | 5–20 MB | ~20ms | No |

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

*Crafted in Lombok, built for the world.*
