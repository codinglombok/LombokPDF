#!/usr/bin/env node
/**
 * LombokPDF CLI
 * Usage: lombokpdf <command> [options]
 *
 * Argument parsing: LombokCLIParse (vendored in src/vendor/lombokcliparse).
 * Exit codes: 0 success / help / version, 1 command failed, 2 invalid command line.
 */

import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { App, ArgType, ParseError, type Matches } from '../vendor/lombokcliparse/index.js'
import { Status, style } from './term.js'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as { version: string }

// ─── Command-line definition ─────────────────────────────────────────────────

export function buildApp(version: string = pkg.version): App {
  const output = (app: App, help: string, def?: string) =>
    def === undefined ? app.option('output', help, ArgType.Str, 'o') : app.option('output', help, ArgType.Str, 'o', def)

  const convert = output(new App('convert', 'Convert HTML, Markdown, or DOCX to PDF')
    .positional('input', 'Input file (.html, .md, .docx, .csv)', ArgType.Str, true), 'Output path (default: input name with .pdf)')
    .option('locale', 'BCP 47 locale', ArgType.Str, undefined, 'en-US')
    .option('theme', 'LombokCSS theme', ArgType.Str, undefined, 'modern-corporate-flat')
    .option('format', 'Output format: pdf|pdf/a-1b|pdf/a-2b|pdf/ua|png|svg', ArgType.Str, undefined, 'pdf')
    .option('page-size', 'Page size: A4|Letter|Legal|A3|A5', ArgType.Str, undefined, 'A4')
    .option('orientation', 'portrait|landscape', ArgType.Str, undefined, 'portrait')

  const render = output(new App('render', 'Render a template (Markdown + YAML front-matter or named template)')
    .positional('input', 'Template or Markdown file', ArgType.Str, true), 'Output path')
    .option('template', 'Named built-in template', ArgType.Str)
    .option('locale', 'BCP 47 locale', ArgType.Str, undefined, 'en-US')
    .option('data', 'Template data as JSON string or @file.json', ArgType.Str, undefined, '{}')
    .option('theme', 'LombokCSS theme', ArgType.Str, undefined, 'modern-corporate-flat')
    .option('format', 'pdf|pdf/a-1b', ArgType.Str, undefined, 'pdf')

  const merge = output(new App('merge', 'Merge multiple PDFs into one (lombokpdf merge a.pdf b.pdf -o out.pdf)'),
    'Output path', 'merged.pdf')

  const split = output(new App('split', 'Split a PDF by page range or bookmark')
    .positional('file', 'PDF file', ArgType.Str, true), 'Output path', 'split.pdf')
    .option('pages', 'Page range, e.g. 1-5 or 2,4,6', ArgType.Str)
    .option('bookmark', 'Split at named bookmark', ArgType.Str)

  const splitimg = output(new App('splitimg', 'Slice an image into a PDF grid layout')
    .positional('image', 'Image file', ArgType.Str, true), 'Output path', 'grid.pdf')
    .option('cols', 'Number of columns', ArgType.Int, undefined, '3')
    .option('rows', 'Number of rows', ArgType.Int, undefined, '3')
    .option('gutter', 'Gutter between cells in points', ArgType.Int, undefined, '0')
    .option('page-size', 'Page size', ArgType.Str, undefined, 'A4')
    .flag('show-borders', 'Show cell borders')

  const formFill = output(new App('fill', 'Fill form fields from JSON')
    .positional('file', 'PDF file', ArgType.Str, true), 'Output path (default: <file>-filled.pdf)')
    .option('data', 'Fields as JSON string or @file.json', ArgType.Str, undefined, '{}')
    .flag('flatten', 'Flatten fields after filling')

  const formExtract = output(new App('extract', 'Extract form field values to JSON')
    .positional('file', 'PDF file', ArgType.Str, true), 'JSON output path (default: stdout)')

  const form = new App('form', 'AcroForm operations').subcommand(formFill).subcommand(formExtract)

  const sign = output(new App('sign', 'Apply PKCS#7 digital signature')
    .positional('file', 'PDF file', ArgType.Str, true), 'Output path (default: <file>-signed.pdf)')
    .option('cert', 'Path to .p12 certificate (required)', ArgType.Str)
    .option('pass', 'Certificate password', ArgType.Str, undefined, undefined, 'CERT_PASS')
    .option('reason', 'Reason for signing', ArgType.Str)
    .option('location', 'Signer location', ArgType.Str)

  const audit = new App('audit', 'Inspect metadata, security, and compliance of a PDF')
    .positional('file', 'PDF file', ArgType.Str, true)

  const versionCmd = new App('version', 'Print version info')

  return new App('lombokpdf', 'LombokPDF — Lightweight, elegant PDF generation')
    .version(version)
    .subcommand(convert)
    .subcommand(render)
    .subcommand(merge)
    .subcommand(split)
    .subcommand(splitimg)
    .subcommand(form)
    .subcommand(sign)
    .subcommand(audit)
    .subcommand(versionCmd)
}

/** Options of `merge` that take a value (needed to tell values from file names). */
const MERGE_VALUE_OPTIONS = new Set(['-o', '--output'])

/**
 * Adjust argv for features LombokCLIParse 0.2.0 does not have yet:
 * - `-v` as an alias of `--version` at the top level;
 * - variadic file list for `merge`: `merge a.pdf -o x.pdf b.pdf` becomes
 *   `merge -o x.pdf -- a.pdf b.pdf`, and the files are read from `rest()`.
 */
export function normalizeArgv(argv: readonly string[]): string[] {
  if (argv[0] === '-v') return ['--version', ...argv.slice(1)]
  if (argv[0] !== 'merge') return [...argv]

  const opts: string[] = []
  const files: string[] = []
  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i]!
    if (tok === '--') { files.push(...argv.slice(i + 1)); break }
    if (tok.startsWith('-') && tok.length > 1) {
      opts.push(tok)
      if (MERGE_VALUE_OPTIONS.has(tok) && i + 1 < argv.length) opts.push(argv[++i]!)
    } else {
      files.push(tok)
    }
  }
  return ['merge', ...opts, '--', ...files]
}

// ─── Command handlers ────────────────────────────────────────────────────────

type Handler = (m: Matches) => Promise<void>

const str = (m: Matches, name: string): string => m.getStr(name) ?? ''

function readJSONArg(value: string): Record<string, unknown> {
  const text = value.startsWith('@') ? readFileSync(value.slice(1), 'utf-8') : value
  return JSON.parse(text) as Record<string, unknown>
}

async function withStatus(text: string, body: () => Promise<string>): Promise<void> {
  const status = new Status(text).start()
  try {
    status.succeed(await body())
  } catch (err: unknown) {
    status.fail(style.red(err instanceof Error ? err.message : String(err), process.stderr))
    process.exitCode = 1
  }
}

const handlers: Record<string, Handler> = {
  async convert(m) {
    const input = str(m, 'input')
    await withStatus(`Converting ${style.cyan(input, process.stderr)}...`, async () => {
      const { LombokPDF } = await import('../index.js')
      const pdf = new LombokPDF({ locale: str(m, 'locale'), theme: str(m, 'theme') } as any)
      const doc = await pdf
        .fromFile(resolve(input))
        .page({ size: str(m, 'page-size') as any, orientation: str(m, 'orientation') as any })
        .export(str(m, 'format') as any)
      const out = str(m, 'output') || input.replace(/\.[^.]+$/, '.pdf')
      await doc.save(resolve(out))
      return `Saved to ${style.green(out, process.stderr)} (${doc.pages()} pages)`
    })
  },

  async render(m) {
    const input = str(m, 'input')
    await withStatus('Rendering template...', async () => {
      const { LombokPDF } = await import('../index.js')
      const data = readJSONArg(str(m, 'data'))
      const pdf = new LombokPDF({ locale: str(m, 'locale'), theme: str(m, 'theme') } as any)
      const template = str(m, 'template')
      const builder = template ? pdf.from({ template, data }) : pdf.fromFile(resolve(input))
      const doc = await builder.locale(str(m, 'locale')).export(str(m, 'format') as any)
      const out = str(m, 'output') || input.replace(/\.[^.]+$/, '.pdf')
      await doc.save(resolve(out))
      return `Rendered to ${style.green(out, process.stderr)} (${doc.pages()} pages)`
    })
  },

  async merge(m) {
    const files = m.rest()
    if (files.length < 2) throw new ParseError('MISSING_REQUIRED', 'files')
    await withStatus(`Merging ${files.length} files...`, async () => {
      const { LombokPDF } = await import('../index.js')
      const { merge } = await import('../skills/ops/index.js')
      const pdf = new LombokPDF()
      const docs = await Promise.all(files.map(f => pdf.fromFile(resolve(f)).export('pdf')))
      const merged = await merge(docs)
      await merged.save(resolve(str(m, 'output')))
      return `Merged to ${style.green(str(m, 'output'), process.stderr)} (${merged.pages()} pages)`
    })
  },

  async split(m) {
    await withStatus('Splitting...', async () => {
      const { LombokPDF } = await import('../index.js')
      const { split } = await import('../skills/ops/index.js')
      const doc = await new LombokPDF().fromFile(resolve(str(m, 'file'))).export('pdf')
      const options = str(m, 'bookmark') ? { bookmark: str(m, 'bookmark') } : { pages: str(m, 'pages') || '1-' }
      const result = await split(doc, options as any)
      await result.save(resolve(str(m, 'output')))
      return `Split to ${style.green(str(m, 'output'), process.stderr)} (${result.pages()} pages)`
    })
  },

  async splitimg(m) {
    const cols = m.getInt('cols')!
    const rows = m.getInt('rows')!
    await withStatus(`Splitting image into ${cols}×${rows} grid...`, async () => {
      const { splitimg } = await import('../skills/image/index.js')
      const doc = await splitimg(resolve(str(m, 'image')), {
        cols,
        rows,
        gutter: m.getInt('gutter')!,
        pageSize: str(m, 'page-size') as any,
        showBorders: m.getBool('show-borders'),
      })
      await doc.save(resolve(str(m, 'output')))
      return `Grid saved to ${style.green(str(m, 'output'), process.stderr)}`
    })
  },

  async 'form fill'(m) {
    const file = str(m, 'file')
    await withStatus('Filling form...', async () => {
      const { LombokPDF } = await import('../index.js')
      const { formFill } = await import('../skills/forms/index.js')
      const fields = readJSONArg(str(m, 'data'))
      const doc = await new LombokPDF().fromFile(resolve(file)).export('pdf')
      const filled = await formFill(doc, { fields: fields as any, flatten: m.getBool('flatten') })
      const out = str(m, 'output') || file.replace('.pdf', '-filled.pdf')
      await filled.save(resolve(out))
      return `Filled form saved to ${style.green(out, process.stderr)}`
    })
  },

  async 'form extract'(m) {
    try {
      const { LombokPDF } = await import('../index.js')
      const { formExtract } = await import('../skills/forms/index.js')
      const doc = await new LombokPDF().fromFile(resolve(str(m, 'file'))).export('pdf')
      const result = await formExtract(doc)
      const json = JSON.stringify(result.fields, null, 2)
      const out = str(m, 'output')
      if (out) {
        writeFileSync(resolve(out), json)
        console.log(style.green(`✓ Fields written to ${out}`))
      } else {
        console.log(json)
      }
    } catch (err: unknown) {
      console.error(style.red(err instanceof Error ? err.message : String(err), process.stderr))
      process.exitCode = 1
    }
  },

  async sign(m) {
    const file = str(m, 'file')
    const cert = str(m, 'cert')
    if (!cert) throw new ParseError('MISSING_REQUIRED', '--cert')
    await withStatus('Signing document...', async () => {
      const { LombokPDF } = await import('../index.js')
      const { signPKCS7 } = await import('../skills/security/index.js')
      const doc = await new LombokPDF().fromFile(resolve(file)).export('pdf')
      const signed = await (signPKCS7 as any)(doc, {
        cert: resolve(cert), pass: str(m, 'pass'), reason: str(m, 'reason'), location: str(m, 'location'),
      })
      const out = str(m, 'output') || file.replace('.pdf', '-signed.pdf')
      await signed.save(resolve(out))
      return `Signed document saved to ${style.green(out, process.stderr)}`
    })
  },

  async audit(m) {
    try {
      const { LombokPDF } = await import('../index.js')
      const doc = await new LombokPDF().fromFile(resolve(str(m, 'file'))).export('pdf')
      const meta = doc.metadata()
      const none = (v: string | undefined, fallback: string) => v || style.dim(fallback)

      console.log(style.bold('\nLombokPDF Document Audit'))
      console.log(style.dim('─'.repeat(40)))
      console.log(`Pages:     ${doc.pages()}`)
      console.log(`Size:      ${(doc.size / 1024).toFixed(1)} KB`)
      console.log(`Title:     ${none(meta.title, '(none)')}`)
      console.log(`Author:    ${none(meta.author, '(none)')}`)
      console.log(`Creator:   ${none(meta.creator, '(unknown)')}`)
      console.log(`Producer:  ${none(meta.producer, '(unknown)')}`)
      console.log(`Language:  ${none(meta.language, '(none)')}`)
      console.log(style.dim('─'.repeat(40)))
      console.log(style.green('✓ Audit complete'))
    } catch (err: unknown) {
      console.error(style.red(err instanceof Error ? err.message : String(err), process.stderr))
      process.exitCode = 1
    }
  },

  async version() {
    const { LombokPDF } = await import('../index.js')
    const support = LombokPDF.supported()
    console.log(`LombokPDF v${LombokPDF.version()}`)
    console.log(`WASM: ${support.wasm ? '✓' : '✗'}`)
    console.log(`HarfBuzz: ${support.harfbuzz ? '✓' : '✗'}`)
    console.log(`Locales: ${support.locales.length}`)
  },
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/** Run the CLI with `argv` (without the node and script paths). Returns the exit code. */
export async function main(argv: readonly string[]): Promise<number> {
  const app = buildApp()
  try {
    let m = app.parse(['lombokpdf', ...normalizeArgv(argv)])
    const path: string[] = []
    for (let sub = m.subcommand(); sub; sub = m.subcommand()) {
      path.push(sub.name)
      m = sub.matches
    }
    const handler = handlers[path.join(' ')]
    if (!handler) {
      // No (complete) subcommand: parsing `--help` at that level throws HELP with its text
      app.parse(['lombokpdf', ...path, '--help'])
      return 2
    }
    await handler(m)
    return typeof process.exitCode === 'number' ? process.exitCode : 0
  } catch (err: unknown) {
    if (!(err instanceof ParseError)) throw err
    if (err.isInfo) {
      process.stdout.write(err.text ?? '')
      return 0
    }
    process.stderr.write(`error: ${err.message}\n`)
    return 2
  }
}

function invokedDirectly(): boolean {
  const script = process.argv[1]
  if (!script) return false
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code })
}
