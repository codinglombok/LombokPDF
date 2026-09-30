# LombokPDF — How To Use

> Complete documentation for developers. From installation to production.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Quick Start](#2-quick-start)
3. [Input Sources](#3-input-sources)
4. [Locale & Internationalization](#4-locale--internationalization)
5. [Templates](#5-templates)
6. [Design Themes (LombokCSS)](#6-design-themes-lombokcss)
7. [Skill Modules](#7-skill-modules)
8. [Framework Integrations](#8-framework-integrations)
9. [CLI Reference](#9-cli-reference)
10. [Security Skills](#10-security-skills)
11. [Document Operations](#11-document-operations)
12. [Image & Media Skills](#12-image--media-skills)
13. [Forms](#13-forms)
14. [Charting (LombokCharts)](#14-charting-lombokcharts)
15. [Deployment](#15-deployment)
16. [Performance Guide](#16-performance-guide)
17. [Troubleshooting](#17-troubleshooting)
18. [API Quick Reference](#18-api-quick-reference)

---

## 1. Installation

### JavaScript / TypeScript

```bash
# npm
npm install lombokpdf

# Bun
bun add lombokpdf

# pnpm
pnpm add lombokpdf

# Yarn
yarn add lombokpdf
```

**Requirements:** Node.js ≥ 18.0.0

### Python

```bash
pip install lombokpdf
# or with uv
uv add lombokpdf
```

**Requirements:** Python ≥ 3.10

### PHP / Composer

```bash
composer require lombok/pdf
```

**Requirements:** PHP ≥ 8.1, `ext-ffi`, `ext-mbstring`, `ext-json`

### Go

```bash
go get github.com/codinglombok/lombokpdf@latest
```

**Requirements:** Go ≥ 1.21

### Java / Maven

```xml
<dependency>
  <groupId>io.lombok</groupId>
  <artifactId>lombokpdf</artifactId>
  <version>1.0.0</version>
</dependency>
```

**Requirements:** Java ≥ 17

### Ruby

```bash
gem install lombok_pdf
# or in Gemfile:
gem 'lombok_pdf', '~> 1.0'
```

### .NET / C#

```bash
dotnet add package LombokPDF
```

**Requirements:** .NET ≥ 6.0

### Rust

```toml
# Cargo.toml
[dependencies]
lombokpdf = "1.0"
```

### Browser / CDN

```html
<!-- ESM from unpkg -->
<script type="module">
  import { ready, LombokPDF } from 'https://unpkg.com/lombokpdf/dist/browser.js'
  await ready()
  const pdf = new LombokPDF()
  // ...
</script>

<!-- jsDelivr -->
<script type="module">
  import { ready, LombokPDF } from 'https://cdn.jsdelivr.net/npm/lombokpdf/dist/browser.js'
</script>
```

---

## 2. Quick Start

### JavaScript / TypeScript

```typescript
import { LombokPDF } from 'lombokpdf'

const pdf = new LombokPDF()

// ── From HTML ────────────────────────────────────────────────
const doc = await pdf
  .from({ html: '<h1>Hello, World</h1><p>My first LombokPDF document.</p>' })
  .export('pdf')

await doc.save('./hello.pdf')

// ── From Markdown ────────────────────────────────────────────
const doc2 = await pdf
  .from({ markdown: '# Report\n\nThis is a **report**.' })
  .locale('en-US')
  .export('pdf')

await doc2.save('./report.pdf')

// ── From a template ──────────────────────────────────────────
const doc3 = await pdf
  .from({
    template: 'invoice',
    data: {
      company:       'Acme Corp',
      invoiceNumber: 'INV-2026-001',
      date:          '2026-07-20',
      dueDate:       '2026-08-20',
      items: [
        { name: 'Web Development', qty: 1, unitPrice: 5000, total: 5000 },
        { name: 'SEO Audit',       qty: 1, unitPrice: 1000, total: 1000 },
      ],
      subtotal:   6000,
      tax:         660,
      grandTotal: 6660,
      taxRate:    0.11,
    },
  })
  .locale('en-US')
  .export('pdf')

await doc3.save('./invoice.pdf')
```

### Python

```python
from lombokpdf import LombokPDF

pdf = LombokPDF()

# From HTML
doc = pdf.from_html('<h1>Hello, World</h1>').locale('en-US').export('pdf')
doc.save('hello.pdf')

# From template
doc = (pdf
  .from_template('invoice', data={
      'company': 'PT Lombok Digital',
      'invoice_number': 'INV-2026-001',
      'total': 6105000,
  })
  .locale('id-ID')
  .export('pdf'))
doc.save('invoice.pdf')
```

### PHP

```php
<?php
use LombokPDF\LombokPDF;

$pdf = new LombokPDF();

// From HTML
$doc = $pdf->from(['html' => '<h1>Bonjour le monde</h1>'])
           ->locale('fr-FR')
           ->export('pdf');
$doc->save('hello.pdf');

// Stream to browser
$doc->inline('document.pdf');

// Get bytes (for storage)
$bytes = $doc->toBytes();
```

### Go

```go
package main

import (
    "log"
    "github.com/codinglombok/lombokpdf"
)

func main() {
    pdf := lombokpdf.New()

    doc, err := pdf.FromHTML("<h1>こんにちは</h1>").
        Locale("ja-JP").
        Export(lombokpdf.FormatPDF)
    if err != nil { log.Fatal(err) }

    if err := doc.Save("hello.pdf"); err != nil { log.Fatal(err) }
}
```

---

## 3. Input Sources

LombokPDF accepts six source types:

### HTML String

```typescript
pdf.from({ html: '<h1>Title</h1><p>Body</p>' })
pdf.fromHTML('<h1>Title</h1>')   // shorthand
```

Full HTML5 is supported. You may include a `<!DOCTYPE html>` wrapper with `<head>` for CSS, or pass a fragment (LombokPDF adds a wrapper automatically).

```typescript
// Full HTML with embedded CSS
pdf.from({
  html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body  { font-family: 'Noto Sans Arabic', sans-serif; }
    h1    { color: #1a73e8; }
  </style>
</head>
<body>
  <h1>تقرير سنوي</h1>
  <p>هذا هو تقرير العام 2026.</p>
</body>
</html>`
})
```

### Markdown

```typescript
pdf.from({ markdown: '# Title\n\nBody **text** with `code`.' })
pdf.fromMarkdown('# Title')   // shorthand
```

Supports GitHub-Flavored Markdown (GFM):
- Tables, fenced code blocks, task lists, strikethrough, auto-links
- Heading IDs for TOC linking

### Template

```typescript
pdf.from({ template: 'invoice', data: { company: 'Acme', total: 1500 } })
pdf.from({ template: './my-template.html', data: { ... } })   // custom file path
```

See [Templates](#5-templates) for all 12 built-in templates and custom template guide.

### File

```typescript
pdf.from({ file: './report.html' })
pdf.from({ file: './report.md' })
pdf.from({ file: './contract.docx' })
pdf.fromFile('./report.md')   // shorthand
```

Auto-detects format from extension: `.html`, `.htm`, `.md`, `.markdown`, `.docx`.

### URL

```typescript
pdf.from({ url: 'https://example.com/report' })
pdf.fromURL('https://example.com/report')   // shorthand
```

Fetches the URL and renders the HTML content. Useful for converting web pages.

### DOCX

```typescript
pdf.from({ docx: './contract.docx' })
// or with bytes
const bytes = await fs.readFile('./contract.docx')
pdf.from({ docx: bytes })
```

Requires the `importDocx` skill (auto-loaded). Preserves tables, headings, bold/italic, and lists.

### CSV

```typescript
pdf.from({ csv: './data.csv', options: { hasHeader: true, delimiter: ',' } })
```

Renders CSV as a styled HTML table. Requires the `importCSV` skill.

---

## 4. Locale & Internationalization

### Setting a Locale

```typescript
// Simple BCP 47 locale tag
pdf.from({ html }).locale('id-ID')
pdf.from({ html }).locale('ar-SA')
pdf.from({ html }).locale('zh-Hans-CN')

// Full LocaleConfig
pdf.from({ html }).locale({
  tag:              'ar-SA',
  direction:        'rtl',
  numberingSystem:  'arab',    // ١٢٣ Eastern Arabic digits
  calendar:         'islamic', // Hijri dates
  hyphenation:      false,     // Arabic doesn't use hyphenation
})
```

### RTL Languages

RTL is **automatically detected** from the locale tag — no manual configuration needed:

| Locale | Language | Script | Direction |
|---|---|---|---|
| `ar-SA`, `ar-EG`, `ar-AE`, … | Arabic | Arabic | RTL |
| `fa-IR` | Persian/Farsi | Arabic | RTL |
| `ur-PK` | Urdu | Arabic | RTL |
| `he-IL` | Hebrew | Hebrew | RTL |
| `ps-AF` | Pashto | Arabic | RTL |

For RTL documents, LombokPDF automatically:
- Sets `dir="rtl"` on the HTML root
- Applies Unicode BiDi algorithm (UAX #9)
- Selects an appropriate Noto Sans Arabic / Noto Sans Hebrew font
- Mirrors page margins (left ↔ right for running headers)

### CJK Languages

```typescript
// Chinese Simplified
pdf.from({ html }).locale('zh-Hans-CN')

// Japanese — with vertical text option
pdf.from({ html: '<p style="writing-mode: vertical-rl">縦書き</p>' })
   .locale('ja-JP')

// Korean
pdf.from({ html }).locale('ko-KR')
```

CJK features:
- Font subsetting — only the glyphs you use are embedded (keeps file size small)
- Line-breaking per Unicode UAX #14 (no word-space wrapping)
- Vertical text (`writing-mode: vertical-rl`) supported

### Currency & Number Formatting (in Templates)

```handlebars
{{!-- Formats 5000000 as Rp 5.000.000 in id-ID --}}
{{ total | currency }}

{{!-- Formats 0.11 as 11% --}}
{{ taxRate | percent }}

{{!-- Formats date per locale --}}
{{ invoiceDate | date }}
```

The `currency`, `percent`, and `date` Handlebars helpers use `Intl.NumberFormat` and `Intl.DateTimeFormat` with the active locale.

---

## 5. Templates

### Built-in Templates

| Template ID | Purpose | Key Variables |
|---|---|---|
| `invoice` | Professional invoice | `company`, `items[]`, `total`, `taxRate`, `currency` |
| `report` | Executive report | `title`, `author`, `sections[]`, `charts[]` |
| `legal` | Legal contract | `title`, `parties[]`, `clauses[]`, `signatureDate` |
| `certificate` | Award/completion | `recipientName`, `title`, `issuedBy`, `date` |
| `letter` | Formal letter | `sender`, `recipient`, `subject`, `body` |
| `resume` | Resume / CV | `name`, `contact`, `experience[]`, `education[]`, `skills[]` |
| `ticket` | Event ticket with barcode | `eventName`, `holder`, `seat`, `barcode` |
| `label` | Shipping label | `from`, `to`, `trackingNumber`, `weight` |
| `receipt` | POS receipt | `storeName`, `items[]`, `total`, `paymentMethod` |
| `newsletter` | Multi-column editorial | `title`, `articles[]`, `issueDate` |
| `datasheet` | Technical spec sheet | `productName`, `specs{}`, `features[]`, `images[]` |
| `booklet` | Brochure/booklet | `title`, `sections[]`, `bleed`, `cropMarks` |

### Using a Built-in Template

```typescript
const doc = await pdf
  .from({
    template: 'invoice',
    data: {
      company:       'PT Lombok Digital',
      invoiceNumber: 'INV-2026-001',
      date:          '2026-07-20',
      dueDate:       '2026-08-20',
      currency:      'IDR',
      taxRate:       0.11,
      client: {
        name:    'Budi Santoso',
        company: 'CV Maju Jaya',
        address: 'Jl. Sudirman No. 1, Jakarta',
        email:   'budi@majujaya.co.id',
      },
      items: [
        { name: 'Web Development',  qty: 1, unitPrice: 5_000_000, total: 5_000_000 },
        { name: 'Mobile App (iOS)', qty: 1, unitPrice: 8_000_000, total: 8_000_000 },
        { name: 'Hosting (1 year)', qty: 1, unitPrice: 1_200_000, total: 1_200_000 },
      ],
      subtotal:   14_200_000,
      tax:         1_562_000,
      grandTotal: 15_762_000,
      notes:      'Terima kasih atas kepercayaan Anda!',
      paymentTerms: 'Net 30',
      bankDetails: {
        Bank:    'BCA',
        Account: '1234567890',
        Name:    'PT Lombok Digital',
      },
    },
  })
  .locale('id-ID')
  .export('pdf')
```

### Custom Template (Markdown + YAML front-matter)

Create `my-template.md`:

```markdown
---
title: Monthly Report
theme: modern-corporate-flat
variables:
  author: ""
  month: ""
  year: 2026
---

<style>
  @page { size: A4; margin: 25mm; }
  h1 { color: var(--color-brand-primary); }
  .kpi { display: flex; gap: 16px; }
  .kpi-box { flex: 1; padding: 16px; background: var(--color-bg); border-radius: 8px; }
</style>

# {{ title }}

**Author:** {{ author }} | **Period:** {{ month }} {{ year }}

<div class="kpi">
  <div class="kpi-box">
    <div style="font-size: 8pt; text-transform: uppercase; color: var(--color-text-muted)">Revenue</div>
    <div style="font-size: 24pt; font-weight: 700;">{{ revenue | currency }}</div>
  </div>
  <div class="kpi-box">
    <div style="font-size: 8pt; text-transform: uppercase; color: var(--color-text-muted)">Orders</div>
    <div style="font-size: 24pt; font-weight: 700;">{{ orders }}</div>
  </div>
</div>

## Sales by Region

| Region | Revenue | Growth |
|---|---|---|
{{#each regions}}
| {{ name }} | {{ revenue | currency }} | {{ growth | percent }} |
{{/each}}

{{#if notes}}
> **Note:** {{ notes }}
{{/if}}
```

Use it:

```typescript
const doc = await pdf
  .from({
    template: './my-template.md',
    data: {
      author:  'Andi Pratama',
      month:   'July',
      revenue: 125_000_000,
      orders:  1_842,
      regions: [
        { name: 'Jawa',       revenue: 75_000_000,  growth: 0.12 },
        { name: 'Sumatera',   revenue: 30_000_000,  growth: 0.08 },
        { name: 'Kalimantan', revenue: 20_000_000,  growth: 0.15 },
      ],
    },
  })
  .locale('id-ID')
  .export('pdf')
```

### Template Handlebars Reference

| Helper | Syntax | Example |
|---|---|---|
| Currency | `{{ value \| currency }}` | `5000000` → `Rp 5.000.000` |
| Percent | `{{ value \| percent }}` | `0.11` → `11%` |
| Date | `{{ value \| date }}` | `2026-07-20` → `20 Juli 2026` |
| Uppercase | `{{ str \| upper }}` | `hello` → `HELLO` |
| Lowercase | `{{ str \| lower }}` | `HELLO` → `hello` |
| Truncate | `{{ str \| truncate:50 }}` | Long text… |
| Conditional | `{{#if x}} ... {{/if}}` | |
| Unless | `{{#unless x}} ... {{/unless}}` | |
| Each | `{{#each items}} {{name}} {{/each}}` | |
| Comparison | `{{#if (eq a b)}} ... {{/if}}` | |

---

## 6. Design Themes (LombokCSS)

LombokPDF integrates with [LombokCSS](https://github.com/codinglombok/LombokCSS) for design-token-driven theming.

```typescript
// Built-in themes
pdf.from({ template: 'invoice', data }).theme('modern-corporate-flat')
pdf.from({ template: 'report', data }).theme('resonant-stark')
pdf.from({ template: 'invoice', data }).theme('neo-brutalism')
pdf.from({ template: 'report', data }).theme('semantic-minimalist')
pdf.from({ template: 'certificate', data }).theme('glassmorphism')

// With @lombok/css installed — live token override
import { lombokTheme } from '@lombok/css/themes'
const pdf = new LombokPDF({ theme: lombokTheme('resonant-stark') })
```

### Theme Preview

| Theme | Colors | Typography | Border |
|---|---|---|---|
| `modern-corporate-flat` | Blue `#1a73e8` | Noto Sans | Soft, rounded |
| `resonant-stark` | Black `#000000` | Noto Sans | Sharp, square |
| `neo-brutalism` | Orange `#ff6b00` on yellow | Noto Sans Bold | Heavy black border |
| `semantic-minimalist` | Blue `#2563eb` | Noto Sans | Minimal, thin |
| `glassmorphism` | Purple `#8b5cf6` | Noto Sans | Rounded, translucent |

### CSS Custom Properties Available in Templates

```css
/* Use these in your custom templates */
var(--color-brand-primary)    /* Main brand color */
var(--color-brand-secondary)  /* Secondary brand color */
var(--color-text)             /* Body text */
var(--color-text-muted)       /* Muted/label text */
var(--color-border)           /* Border color */
var(--color-bg)               /* Background (cards, alternating rows) */
var(--font-family-sans)       /* Body font */
var(--font-family-mono)       /* Code/monospace font */
var(--space-4)                /* Standard spacing unit */
var(--radius-md)              /* Standard border radius */
```

---

## 7. Skill Modules

Skills extend LombokPDF's capabilities. Import only what you need — everything is tree-shakeable.

```typescript
// Use as standalone function
const merged = await merge([docA, docB, docC])

// Use in pipe() chain
const doc = await pdf
  .from({ template: 'invoice', data })
  .pipe(watermarkSkill({ text: 'DRAFT' }))
  .pipe(signPKCS7({ cert: './cert.p12', pass: process.env.CERT_PASS }))
  .export('pdf')
```

### All Available Skills

```typescript
// ── IO ──────────────────────────────────────────────────────────────────────
import { importDocx, importMarkdown, importHTML, importCSV } from 'lombokpdf/skills/io'
import { exportPNG, exportSVG, exportPDFA, exportPDFUA }    from 'lombokpdf/skills/io'

// ── Operations ───────────────────────────────────────────────────────────────
import { merge, split, rotate, compress, watermark }        from 'lombokpdf/skills/ops'
import { watermarkSkill, compressSkill }                    from 'lombokpdf/skills/ops'

// ── Image ────────────────────────────────────────────────────────────────────
import { splitimg, rasterize, crop, ocr }                   from 'lombokpdf/skills/image'

// ── Marks ────────────────────────────────────────────────────────────────────
import { qrcode, barcode, datamatrix, pdf417 }              from 'lombokpdf/skills/marks'

// ── Forms ────────────────────────────────────────────────────────────────────
import { formFill, formExtract, formCreate, formFlatten }   from 'lombokpdf/skills/forms'

// ── Security ─────────────────────────────────────────────────────────────────
import { signPKCS7, encryptAES, redact, verify }            from 'lombokpdf/skills/security'

// ── Structure ────────────────────────────────────────────────────────────────
import { toc, footnotes, crossRef, bookmarks }              from 'lombokpdf/skills/structure'
```

---

## 8. Framework Integrations

### Vue.js

```bash
npm install lombokpdf lombokpdf-vue
```

```vue
<template>
  <div>
    <!-- Live preview of PDF in browser -->
    <LombokPDFPreview
      template="invoice"
      :data="invoiceData"
      locale="id-ID"
      style="width: 100%; height: 600px;"
    />
    <button @click="download">Download PDF</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { LombokPDFPreview, useLombokPDF } from 'lombokpdf-vue'

const invoiceData = ref({
  company: 'PT Lombok Digital',
  total:   15_762_000,
  items:   [...],
})

const { generate, download } = useLombokPDF()

async function download() {
  const doc = await generate({
    template: 'invoice',
    data:     invoiceData.value,
    locale:   'id-ID',
  })
  download(doc, 'invoice.pdf')
}
</script>
```

### React

```bash
npm install lombokpdf lombokpdf-react
```

```tsx
import { LombokPDFViewer, useLombokPDF } from 'lombokpdf-react'

export function InvoicePage() {
  const { generate, download, loading } = useLombokPDF()

  const data = {
    company: 'Acme Corp',
    total:   6660,
    items:   [{ name: 'Web Dev', qty: 1, unitPrice: 5000, total: 5000 }],
  }

  return (
    <div>
      <LombokPDFViewer
        template="invoice"
        data={data}
        locale="en-US"
        style={{ width: '100%', height: 600 }}
      />
      <button
        onClick={async () => {
          const doc = await generate({ template: 'invoice', data, locale: 'en-US' })
          download(doc, 'invoice.pdf')
        }}
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Download PDF'}
      </button>
    </div>
  )
}
```

### Laravel

```bash
composer require lombok/pdf-laravel
php artisan vendor:publish --provider="LombokPDF\Laravel\LombokPDFServiceProvider"
```

```php
// config/lombokpdf.php (auto-published)
return [
    'default_locale' => env('LOMBOKPDF_LOCALE', 'id-ID'),
    'default_theme'  => env('LOMBOKPDF_THEME', 'modern-corporate-flat'),
    'timeout'        => env('LOMBOKPDF_TIMEOUT', 30000),
];

// In a controller:
use Lombok\PDF\Facades\LombokPDF;

public function invoice(Order $order): Response
{
    $doc = LombokPDF::template('invoice', [
        'company'  => config('app.name'),
        'items'    => $order->items,
        'total'    => $order->total,
        'taxRate'  => 0.11,
    ])->locale('id-ID')->export('pdf');

    return response($doc->toBytes(), 200, [
        'Content-Type'        => 'application/pdf',
        'Content-Disposition' => 'inline; filename="invoice-'.$order->id.'.pdf"',
    ]);
}
```

### Django

```bash
pip install lombokpdf-django
```

```python
# settings.py
INSTALLED_APPS = [..., 'lombokpdf_django']
LOMBOKPDF = {
    'DEFAULT_LOCALE': 'id-ID',
    'DEFAULT_THEME':  'modern-corporate-flat',
}

# views.py
from lombokpdf_django import render_pdf, LombokPDFResponse

def invoice_view(request, pk):
    order = get_object_or_404(Order, pk=pk)
    return render_pdf(
        request,
        template='invoice',
        data={
            'company': settings.COMPANY_NAME,
            'items':   list(order.items.values()),
            'total':   float(order.total),
            'taxRate': 0.11,
        },
        locale='id-ID',
        filename=f'invoice-{order.pk}.pdf',
    )
```

### Express / Node.js

```typescript
import express from 'express'
import { LombokPDF } from 'lombokpdf'

const app = express()
const pdf = new LombokPDF({ locale: 'en-US' })

app.get('/invoice/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const doc = await pdf
      .from({ template: 'invoice', data: order.toObject() })
      .locale(req.query.locale as string || 'en-US')
      .export('pdf')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="invoice-${order.id}.pdf"`)
    res.setHeader('X-LombokPDF-Pages', doc.pages())
    doc.pipe(res)
  } catch (err) {
    res.status(500).json({ error: 'PDF generation failed' })
  }
})
```

### Next.js (App Router)

```typescript
// app/api/invoice/[id]/route.ts
import { LombokPDF } from 'lombokpdf'

const pdf = new LombokPDF()

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const order = await getOrder(params.id)
  if (!order) return new Response('Not found', { status: 404 })

  const doc = await pdf
    .from({ template: 'invoice', data: order })
    .locale('en-US')
    .export('pdf')

  const bytes = await doc.toBytes()

  return new Response(bytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${params.id}.pdf"`,
      'X-LombokPDF-Pages':   String(doc.pages()),
    },
  })
}
```

---

## 9. CLI Reference

```bash
npm install -g lombokpdf
```

### convert — HTML/MD/DOCX to PDF

```bash
lombokpdf convert input.html -o output.pdf
lombokpdf convert report.md -o report.pdf --locale id-ID
lombokpdf convert contract.docx -o contract.pdf --format pdf/a-1b
lombokpdf convert page.html -o page.pdf --page-size Letter --orientation landscape
```

| Option | Default | Description |
|---|---|---|
| `-o, --output` | `{input}.pdf` | Output path |
| `--locale` | `en-US` | BCP 47 locale |
| `--theme` | `modern-corporate-flat` | LombokCSS theme |
| `--format` | `pdf` | `pdf` \| `pdf/a-1b` \| `pdf/a-2b` \| `pdf/ua` \| `png` \| `svg` |
| `--page-size` | `A4` | `A4` \| `A3` \| `A5` \| `Letter` \| `Legal` |
| `--orientation` | `portrait` | `portrait` \| `landscape` |

### render — Template rendering

```bash
lombokpdf render invoice.md --template invoice --locale id-ID --data '{"company":"Acme"}' -o out.pdf
lombokpdf render --template report --data @report-data.json -o report.pdf
lombokpdf render --template certificate --locale en-US --data '{"name":"Budi"}' -o cert.pdf
```

| Option | Description |
|---|---|
| `--template` | Named built-in template or file path |
| `--data` | JSON string or `@file.json` |
| `--locale` | BCP 47 locale |
| `--theme` | LombokCSS theme |

### merge — Combine PDFs

```bash
lombokpdf merge a.pdf b.pdf c.pdf -o merged.pdf
lombokpdf merge *.pdf -o all.pdf
```

### split — Extract pages

```bash
lombokpdf split document.pdf --pages 1-5 -o part1.pdf
lombokpdf split document.pdf --pages 6- -o rest.pdf
lombokpdf split document.pdf --bookmark "Chapter 2" -o ch2.pdf
```

### splitimg — Image to PDF grid

```bash
lombokpdf splitimg photo.jpg --cols 3 --rows 4 -o grid.pdf
lombokpdf splitimg banner.png --cols 5 --rows 1 --page-size A3 --orientation landscape -o strip.pdf
lombokpdf splitimg image.jpg --cols 2 --rows 2 --gutter 10 --show-borders -o grid.pdf
```

| Option | Default | Description |
|---|---|---|
| `--cols` | required | Number of columns |
| `--rows` | required | Number of rows |
| `--gutter` | `0` | Gap between cells (pt) |
| `--page-size` | `A4` | Page size |
| `--show-borders` | `false` | Show cell borders |

### form — Form operations

```bash
# Fill form fields
lombokpdf form fill template.pdf --data fields.json -o filled.pdf
lombokpdf form fill form.pdf --data '{"name":"John","age":30}' --flatten -o final.pdf

# Extract field values
lombokpdf form extract filled.pdf -o fields.json
lombokpdf form extract filled.pdf          # prints JSON to stdout
```

### sign — Digital signature

```bash
lombokpdf sign document.pdf --cert cert.p12 --pass $CERT_PASS -o signed.pdf
lombokpdf sign document.pdf --cert cert.p12 --reason "Approved" --location "Jakarta" -o signed.pdf
```

> **Security:** Never pass `--pass` as a literal string on production servers. Use `$ENV_VAR` or AWS Secrets Manager.

### audit — Document inspection

```bash
lombokpdf audit document.pdf
# Prints: pages, size, title, author, creator, producer, language, encryption status
```

---

## 10. Security Skills

### Digital Signature (PKCS#7)

```typescript
import { signPKCS7 } from 'lombokpdf/skills/security'

// In pipe() chain
const signed = await pdf
  .from({ template: 'contract', data })
  .pipe(signPKCS7({
    cert:        './cert.p12',
    pass:        process.env.CERT_PASS!,
    reason:      'Approved by Legal Dept',
    contactInfo: 'legal@company.com',
    location:    'Jakarta, Indonesia',
  }))
  .export('pdf/a-1b')

// Standalone
const signed = await signPKCS7(doc, { cert: './cert.p12', pass: '...' })
```

### AES-256 Encryption

```typescript
import { encryptAES } from 'lombokpdf/skills/security'

const encrypted = await pdf
  .from({ template: 'report', data })
  .pipe(encryptAES({
    userPassword:  'view-only-pass',    // password to open (can be empty = no password to open)
    ownerPassword: 'admin-pass',        // admin password
    permissions:   ['print', 'copy'],   // what user can do
    algorithm:     'aes-256',           // default
  }))
  .export('pdf')
```

Permission values: `'print'`, `'print-high'`, `'copy'`, `'modify'`, `'annotate'`, `'form-fill'`

### Permanent Redaction (GDPR)

```typescript
import { redact } from 'lombokpdf/skills/security'

// Redact text patterns (permanently removes — not just visually hidden)
const redacted = await redact(doc, {
  patterns:  [/\b\d{16}\b/g, /\b[A-Z]{2}\d{6}\b/g],  // credit cards, IDs
  fillColor: '#000000',
})

// Redact specific page regions
const redacted2 = await redact(doc, {
  regions: [
    [1, 40, 60, 200, 30],   // page 1, signature area
    [2, 40, 80, 150, 20],   // page 2, date area
  ],
})
```

### Verify Signature

```typescript
import { verify } from 'lombokpdf/skills/security'

const results = await verify(doc)
for (const sig of results) {
  console.log(`Signer: ${sig.signerName}`)
  console.log(`Valid:  ${sig.valid}`)
  console.log(`At:     ${sig.signedAt}`)
}
```

---

## 11. Document Operations

### Merge

```typescript
import { merge } from 'lombokpdf/skills/ops'

const combined = await merge([docA, docB, docC], {
  bookmarks: ['Section A', 'Section B', 'Section C'],
})
await combined.save('merged.pdf')
```

### Split

```typescript
import { split } from 'lombokpdf/skills/ops'

// By page range
const part1 = await split(doc, { pages: '1-10' })
const part2 = await split(doc, { pages: '11-' })

// By bookmark name
const chapter2 = await split(doc, { bookmark: 'Chapter 2' })
```

### Watermark

```typescript
import { watermarkSkill } from 'lombokpdf/skills/ops'

const watermarked = await pdf
  .from({ template: 'report', data })
  .pipe(watermarkSkill({
    text:     'CONFIDENTIAL',
    opacity:  0.15,
    rotation: 45,
    fontSize: 60,
    color:    '#888888',
    pages:    'all',          // or '1-5' for specific pages
  }))
  .export('pdf')
```

### Compress

```typescript
import { compressSkill } from 'lombokpdf/skills/ops'

const compressed = await pdf
  .from({ file: './large-report.pdf' })
  .pipe(compressSkill({
    imageQuality:     75,    // JPEG quality 1-100
    imageDPI:         120,   // downsample to max 120 DPI
    deduplicateFonts: true,
  }))
  .export('pdf')
```

### TOC / Footnotes / Bookmarks

```typescript
import { toc, footnotes, bookmarks } from 'lombokpdf/skills/structure'

const doc = await pdf
  .from({ file: './book.html' })
  .pipe(toc({ levels: [1, 2], title: 'Contents' }))
  .pipe(footnotes({ style: 'footnote', numberStyle: 'decimal' }))
  .pipe(bookmarks({ autoFromHeadings: true, levels: [1, 2, 3] }))
  .export('pdf')
```

---

## 12. Image & Media Skills

### splitimg — Image Grid

Split a large image into a grid of cells on one or more PDF pages:

```typescript
import { splitimg } from 'lombokpdf/skills/image'

// 3×4 grid (12 cells) from a single photo
const doc = await splitimg('./photo.jpg', {
  cols:        3,
  rows:        4,
  gutter:      5,          // 5pt gap between cells
  pageSize:    'A4',
  orientation: 'portrait',
  fit:         'contain',  // 'fill' | 'contain' | 'cover'
  showBorders: false,
})
await doc.save('grid.pdf')
```

**Use cases:** ID photo sheets (4×6), collages, contact sheets, label sheets.

### QR Code

```typescript
import { qrcode } from 'lombokpdf/skills/marks'

// Standalone QR code PDF
const doc = await qrcode({
  data:                 'https://lombokpdf.dev',
  errorCorrectionLevel: 'M',
  size:                 150,
  renderer:             'svg',    // SVG = crisp in PDF
})

// Embed into existing PDF at position
const updated = await qrcode({
  data:     'https://example.com/track/INV-001',
  size:     80,
  position: { page: 1, x: 450, y: 720 },
}, existingDoc)
```

### Barcode

```typescript
import { barcode } from 'lombokpdf/skills/marks'

const doc = await barcode({
  data:       'INV-2026-001',
  symbology:  'code128',
  width:      200,
  height:     50,
  showText:   true,
  position:   { page: 1, x: 40, y: 750 },
}, existingDoc)
```

---

## 13. Forms

### Fill a Form

```typescript
import { formFill } from 'lombokpdf/skills/forms'

const filled = await formFill(doc, {
  fields: {
    'applicant_name':    'Budi Santoso',
    'applicant_email':   'budi@example.com',
    'date_of_birth':     '1990-01-15',
    'agreed_to_terms':   true,
    'preferred_contact': 'email',   // radio button value
    'country':           'ID',      // dropdown value
  },
  flatten: false,   // keep fields interactive
})
await filled.save('filled-form.pdf')
```

### Extract Form Data

```typescript
import { formExtract } from 'lombokpdf/skills/forms'

const result = await formExtract(doc)
console.log(result.fields)
// { applicant_name: 'Budi Santoso', agreed_to_terms: true, ... }
console.log(result.fieldTypes)
// { applicant_name: 'text', agreed_to_terms: 'checkbox', ... }
```

---

## 14. Charting (LombokCharts)

Requires peer dependency `@lombok/charts` (from https://github.com/codinglombok/LombokCharts).

```bash
npm install @lombok/charts
```

```typescript
import { LombokPDF } from 'lombokpdf'
import { barChart, lineChart, pieChart } from '@lombok/charts/pdf'

const salesChart = barChart({
  data: [
    { month: 'Jan', revenue: 45_000_000 },
    { month: 'Feb', revenue: 52_000_000 },
    { month: 'Mar', revenue: 61_000_000 },
    { month: 'Apr', revenue: 58_000_000 },
    { month: 'May', revenue: 72_000_000 },
    { month: 'Jun', revenue: 80_000_000 },
  ],
  x:        'month',
  y:        'revenue',
  title:    'Monthly Revenue 2026',
  renderer: 'svg',     // ALWAYS use 'svg' for PDF embedding
  width:    500,
  height:   280,
})

const doc = await new LombokPDF()
  .from({ template: 'report', data: reportData })
  .embed(salesChart, { page: 2, x: 40, y: 200, width: 500, height: 280 })
  .export('pdf')
```

### In Templates

```handlebars
{{!-- Embed a chart directly in template markup --}}
{{chart type="bar" data=monthlySales x="month" y="revenue" width=480 height=260}}
{{chart type="pie" data=regionShare label="region" value="pct" width=300 height=300}}
```

---

## 15. Deployment

### Docker

```bash
# Pull and run
docker run -p 3000:3000 lombokdigital/lombokpdf:latest

# With docker compose
curl -O https://raw.githubusercontent.com/codinglombok/lombokpdf/main/deploy/docker/docker-compose.yml
docker compose up -d
```

**Why LombokPDF is Docker-friendly:**
- No Chromium → **~120MB image** vs ~700MB for Puppeteer-based images
- No native compile-time deps
- Runs as non-root user (`lombok:1001`)
- Read-only filesystem (only `/tmp/lombokpdf` writable)
- 256MB RAM limit is generous (LombokPDF uses 10–50MB per conversion)

### AWS Lambda

```typescript
// deploy/aws/lambda-handler.ts (already in repo)
// Deploy as Lambda function + API Gateway
// Memory: 256MB (more than enough)
// Timeout: 30s (covers worst-case large documents)

// SAM deploy:
sam build
sam deploy --guided
```

```bash
# Or use the pre-built Lambda layer:
aws lambda add-layer-version-permission \
  --layer-name lombokpdf \
  --version-id 1 \
  --action lambda:GetLayerVersion \
  --principal '*' \
  --statement-id public
```

### Niagahoster / Shared Hosting (PHP)

```bash
# One-command setup (PHP port)
curl -sSL https://raw.githubusercontent.com/codinglombok/lombokpdf/main/deploy/niagahoster/setup.sh | bash
```

Or manually:
```bash
composer require lombok/pdf
```

Then in your PHP file:
```php
<?php
require 'vendor/autoload.php';
use LombokPDF\LombokPDF;

$doc = (new LombokPDF())
    ->from(['template' => 'invoice', 'data' => $yourData])
    ->locale('id-ID')
    ->export('pdf');

$doc->inline('invoice.pdf');   // stream to browser
```

### VPS (Node.js Service)

```bash
# Install
npm install -g lombokpdf

# Run as HTTP service with PM2
npm install -g pm2
pm2 start "node server.js" --name lombokpdf-api
pm2 startup && pm2 save
```

```nginx
# /etc/nginx/sites-available/lombokpdf
server {
    listen 443 ssl;
    server_name pdf.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 16. Performance Guide

### Baseline Performance

| Document | RAM | Time |
|---|---|---|
| Simple invoice (1 page) | ~12 MB | ~45ms |
| 10-page report with tables | ~22 MB | ~120ms |
| 50-page legal document | ~35 MB | ~480ms |
| 100-page book (CJK) | ~48 MB | ~920ms |
| Report with embedded charts | ~18 MB | ~95ms |

### Tips

**1. Reuse LombokPDF instance**
```typescript
// ✅ Create once, reuse across requests
const pdf = new LombokPDF()
app.get('/invoice', async (req, res) => {
  const doc = await pdf.from({ ... }).export('pdf')
})

// ❌ Don't create a new instance per request
app.get('/invoice', async (req, res) => {
  const pdf = new LombokPDF()   // wasteful
})
```

**2. Use streaming for large files**
```typescript
// Stream directly to response instead of buffering
doc.pipe(res)   // ✅ streams incrementally
// vs
res.send(await doc.toBytes())  // ❌ buffers full PDF in memory
```

**3. Use PDF/A only when required**
PDF/A-1b adds validation overhead. Use plain `pdf` for internal documents.

**4. Font subsetting is automatic**
LombokPDF only embeds glyphs actually used. A CJK document only using 200 characters won't embed the full 65,000-glyph font.

**5. Compress before storage**
```typescript
import { compressSkill } from 'lombokpdf/skills/ops'

const doc = await pdf.from({ ... })
  .pipe(compressSkill({ imageQuality: 80, imageDPI: 120 }))
  .export('pdf')
```

**6. Lambda/serverless sizing**
- Memory: 256 MB (plenty for most documents; scale up for 100-page+ with many images)
- Timeout: 30s
- Reserve concurrency: set based on your SLA

---

## 17. Troubleshooting

### "Cannot find module 'lombokpdf'"

```bash
npm install lombokpdf
# Check Node version ≥ 18
node --version
```

### Arabic/Hebrew text not rendering RTL

Ensure your HTML has `lang` and `dir` attributes, or use `.locale('ar-SA')`:
```typescript
pdf.from({ html: '<html lang="ar" dir="rtl"><body>مرحباً</body></html>' })
// or
pdf.from({ html: '<h1>مرحباً</h1>' }).locale('ar-SA')
```

### CJK text shows boxes / tofu

Install a Noto CJK font or pass a custom font:
```typescript
new LombokPDF({
  fonts: { primary: 'NotoSansSC', custom: { NotoSansSC: './fonts/NotoSansSC-Regular.ttf' } }
})
```

### `formFill` throws "No AcroForm in document"

The PDF must already contain interactive form fields. Use `formCreate` to add fields first, or use a PDF that was created as a form.

### PDF is too large

```typescript
import { compressSkill } from 'lombokpdf/skills/ops'
pdf.from({ ... }).pipe(compressSkill({ imageQuality: 70, imageDPI: 96 })).export('pdf')
```

### Lambda cold start is slow

Use provisioned concurrency for latency-sensitive workloads. LombokPDF's warm-start time is ~15ms.

### `wkhtmltopdf` was my old tool — how do I migrate?

LombokPDF is a drop-in upgrade with a better API:

```bash
# Old (DO NOT USE — CVSS 9.8 vulnerability)
wkhtmltopdf input.html output.pdf

# New
lombokpdf convert input.html -o output.pdf
```

```typescript
// In code (before)
const wk = require('wkhtmltopdf')
wk(html, { pageSize: 'A4' }, (err, stream) => { ... })

// In code (after — LombokPDF)
import { LombokPDF } from 'lombokpdf'
const doc = await new LombokPDF().fromHTML(html).export('pdf')
doc.pipe(response)
```

---

## 18. API Quick Reference

### LombokPDF class

```typescript
new LombokPDF(options?: LombokPDFOptions)
pdf.from(source: Source): Builder
pdf.fromHTML(html: string): Builder
pdf.fromMarkdown(md: string): Builder
pdf.fromFile(path: string): Builder
pdf.fromURL(url: string): Builder
LombokPDF.version(): string
LombokPDF.supported(): SupportMatrix
```

### Builder (chainable)

```typescript
.template(name: string, data?: object): Builder
.locale(locale: string | LocaleConfig): Builder
.theme(name: string): Builder
.page(config: PageConfig): Builder
.metadata(meta: Partial<PDFMetadata>): Builder
.embed(chart: Chart, position?: EmbedPosition): Builder
.pipe(skill: Skill): Builder
.export(format?: ExportFormat): Promise<Document>
```

### Document

```typescript
.save(path: string): Promise<void>
.toBytes(): Promise<Uint8Array>
.toBase64(): Promise<string>
.toDataURI(): Promise<string>
.toStream(): ReadableStream<Uint8Array>
.pipe(stream: Writable): void
.pages(): number
.size: number
.metadata(): PDFMetadata
.setMetadata(meta: Partial<PDFMetadata>): Document
```

### ExportFormat values

`'pdf'` | `'pdf/a-1b'` | `'pdf/a-2b'` | `'pdf/ua'` | `'png'` | `'svg'`

### PageConfig

```typescript
{
  size?:        'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | [w: number, h: number]
  orientation?: 'portrait' | 'landscape'
  margins?:     { top?: number; right?: number; bottom?: number; left?: number }
}
```

---

*LombokPDF v1.0.0 — Apache 2.0 — crafted in Lombok, built for the world.*
*Docs: https://docs.lombokpdf.dev | GitHub: https://github.com/codinglombok/lombokpdf*
