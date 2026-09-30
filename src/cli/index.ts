#!/usr/bin/env node
/**
 * LombokPDF CLI
 * Usage: lombokpdf <command> [options]
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import ora from 'ora'
import chalk from 'chalk'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as { version: string }

const program = new Command()

program
  .name('lombokpdf')
  .description('LombokPDF — Lightweight, elegant PDF generation')
  .version(pkg.version, '-v, --version', 'Print version')

// ─── convert ─────────────────────────────────────────────────────────────────

program
  .command('convert <input>')
  .description('Convert HTML, Markdown, or DOCX to PDF')
  .option('-o, --output <path>', 'Output path (default: stdout)', '')
  .option('--locale <locale>', 'BCP 47 locale', 'en-US')
  .option('--theme <name>', 'LombokCSS theme', 'modern-corporate-flat')
  .option('--format <format>', 'Output format: pdf|pdf/a-1b|pdf/a-2b|pdf/ua|png|svg', 'pdf')
  .option('--page-size <size>', 'Page size: A4|Letter|Legal|A3|A5', 'A4')
  .option('--orientation <o>', 'portrait|landscape', 'portrait')
  .action(async (input: string, opts: Record<string, string>) => {
    const spinner = ora(`Converting ${chalk.cyan(input)}...`).start()
    try {
      const { LombokPDF } = await import('../index.js')
      const cliOpts: Record<string, any> = {}
      if (opts['locale']) cliOpts.locale = opts['locale']
      if (opts['theme']) cliOpts.theme = opts['theme']
      const pdf = new LombokPDF(cliOpts)

      const doc = await pdf
        .fromFile(resolve(input))
        .page({ size: opts['pageSize'] as any, orientation: opts['orientation'] as any })
        .export(opts['format'] as any)

      const out = opts['output'] || input.replace(/\.[^.]+$/, '.pdf')
      await doc.save(resolve(out))
      spinner.succeed(`Saved to ${chalk.green(out)} (${doc.pages()} pages)`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── render ──────────────────────────────────────────────────────────────────

program
  .command('render <input>')
  .description('Render a template (Markdown + YAML front-matter or named template)')
  .option('-o, --output <path>', 'Output path', '')
  .option('--template <name>', 'Named built-in template', '')
  .option('--locale <locale>', 'BCP 47 locale', 'en-US')
  .option('--data <json>', 'Template data as JSON string or @file.json', '{}')
  .option('--theme <name>', 'LombokCSS theme', 'modern-corporate-flat')
  .option('--format <format>', 'pdf|pdf/a-1b', 'pdf')
  .action(async (input: string, opts: Record<string, string>) => {
    const spinner = ora('Rendering template...').start()
    try {
      const { LombokPDF } = await import('../index.js')

      // Parse data
      const dataStr = opts['data'] ?? '{}'
      let data: Record<string, unknown> = {}
      if (dataStr.startsWith('@')) {
        data = JSON.parse(readFileSync(dataStr.slice(1), 'utf-8'))
      } else {
        data = JSON.parse(dataStr)
      }

      const cliOpts2: Record<string, any> = {}
      if (opts['locale']) cliOpts2.locale = opts['locale']
      if (opts['theme']) cliOpts2.theme = opts['theme']
      const pdf = new LombokPDF(cliOpts2)

      const builder = opts['template']
        ? pdf.from({ template: opts['template'], data })
        : pdf.fromFile(resolve(input))

      const doc  = await builder.locale(opts['locale']!).export(opts['format'] as any)
      const out  = opts['output'] || input.replace(/\.[^.]+$/, '.pdf')
      await doc.save(resolve(out))
      spinner.succeed(`Rendered to ${chalk.green(out)} (${doc.pages()} pages)`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── merge ───────────────────────────────────────────────────────────────────

program
  .command('merge <files...>')
  .description('Merge multiple PDFs into one')
  .option('-o, --output <path>', 'Output path', 'merged.pdf')
  .action(async (files: string[], opts: Record<string, string>) => {
    const spinner = ora(`Merging ${files.length} files...`).start()
    try {
      const { LombokPDF } = await import('../index.js')
      const { merge } = await import('../skills/ops/index.js')

      const pdf = new LombokPDF()
      const docs = await Promise.all(files.map(f => pdf.fromFile(resolve(f)).export('pdf')))
      const merged = await merge(docs)
      await merged.save(resolve(opts['output']!))
      spinner.succeed(`Merged to ${chalk.green(opts['output'])} (${merged.pages()} pages)`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── split ───────────────────────────────────────────────────────────────────

program
  .command('split <file>')
  .description('Split a PDF by page range or bookmark')
  .option('-o, --output <path>', 'Output path', 'split.pdf')
  .option('--pages <range>', 'Page range, e.g. 1-5 or 2,4,6', '')
  .option('--bookmark <name>', 'Split at named bookmark', '')
  .action(async (file: string, opts: Record<string, string>) => {
    const spinner = ora('Splitting...').start()
    try {
      const { LombokPDF } = await import('../index.js')
      const { split } = await import('../skills/ops/index.js')

      const pdf  = new LombokPDF()
      const doc  = await pdf.fromFile(resolve(file)).export('pdf')
      const options = opts['bookmark']
        ? { bookmark: opts['bookmark'] }
        : { pages: opts['pages'] || '1-' }

      const result = await split(doc, options as any)
      await result.save(resolve(opts['output']!))
      spinner.succeed(`Split to ${chalk.green(opts['output'])} (${result.pages()} pages)`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── splitimg ────────────────────────────────────────────────────────────────

program
  .command('splitimg <image>')
  .description('Slice an image into a PDF grid layout')
  .option('-o, --output <path>', 'Output path', 'grid.pdf')
  .option('--cols <n>', 'Number of columns', '3')
  .option('--rows <n>', 'Number of rows', '3')
  .option('--gutter <pt>', 'Gutter between cells in points', '0')
  .option('--page-size <size>', 'Page size', 'A4')
  .option('--show-borders', 'Show cell borders', false)
  .action(async (image: string, opts: Record<string, unknown>) => {
    const spinner = ora(`Splitting image into ${opts['cols']}×${opts['rows']} grid...`).start()
    try {
      const { splitimg } = await import('../skills/image/index.js')
      const doc = await splitimg(resolve(image as string), {
        cols: parseInt(opts['cols'] as string),
        rows: parseInt(opts['rows'] as string),
        gutter: parseInt(opts['gutter'] as string),
        pageSize: opts['pageSize'] as any,
        showBorders: opts['showBorders'] as boolean,
      })
      await doc.save(resolve(opts['output'] as string))
      spinner.succeed(`Grid saved to ${chalk.green(opts['output'])}`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── form ────────────────────────────────────────────────────────────────────

const form = program.command('form').description('AcroForm operations')

form
  .command('fill <file>')
  .description('Fill form fields from JSON')
  .option('-o, --output <path>', 'Output path', '')
  .option('--data <json>', 'Fields as JSON string or @file.json', '{}')
  .option('--flatten', 'Flatten fields after filling', false)
  .action(async (file: string, opts: Record<string, unknown>) => {
    const spinner = ora('Filling form...').start()
    try {
      const { LombokPDF } = await import('../index.js')
      const { formFill } = await import('../skills/forms/index.js')

      const dataStr = opts['data'] as string
      const fields = dataStr.startsWith('@')
        ? JSON.parse(readFileSync(dataStr.slice(1), 'utf-8'))
        : JSON.parse(dataStr)

      const pdf  = new LombokPDF()
      const doc  = await pdf.fromFile(resolve(file)).export('pdf')
      const filled = await formFill(doc, { fields, flatten: opts['flatten'] as boolean })
      const out  = (opts['output'] as string) || file.replace('.pdf', '-filled.pdf')
      await filled.save(resolve(out))
      spinner.succeed(`Filled form saved to ${chalk.green(out)}`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

form
  .command('extract <file>')
  .description('Extract form field values to JSON')
  .option('-o, --output <path>', 'JSON output path', '')
  .action(async (file: string, opts: Record<string, unknown>) => {
    try {
      const { LombokPDF } = await import('../index.js')
      const { formExtract } = await import('../skills/forms/index.js')

      const pdf    = new LombokPDF()
      const doc    = await pdf.fromFile(resolve(file)).export('pdf')
      const result = await formExtract(doc)
      const json   = JSON.stringify(result.fields, null, 2)

      const out = opts['output'] as string
      if (out) {
        writeFileSync(resolve(out), json)
        console.log(chalk.green(`✓ Fields written to ${out}`))
      } else {
        console.log(json)
      }
    } catch (err: any) {
      console.error(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── sign ────────────────────────────────────────────────────────────────────

program
  .command('sign <file>')
  .description('Apply PKCS#7 digital signature')
  .option('-o, --output <path>', 'Output path', '')
  .requiredOption('--cert <path>', 'Path to .p12 certificate')
  .option('--pass <password>', 'Certificate password (prefer $ENV_VAR)', '')
  .option('--reason <text>', 'Reason for signing', '')
  .option('--location <text>', 'Signer location', '')
  .action(async (file: string, opts: Record<string, string>) => {
    const spinner = ora('Signing document...').start()
    try {
      const { LombokPDF } = await import('../index.js')
      const { signPKCS7 } = await import('../skills/security/index.js')

      const pass = opts['pass'] || process.env['CERT_PASS'] || ''
      const pdf  = new LombokPDF()
      const doc  = await pdf.fromFile(resolve(file)).export('pdf')
      const signed = await (signPKCS7 as any)(doc, { cert: resolve(opts['cert']!), pass, reason: opts['reason'], location: opts['location'] })
      const out  = opts['output'] || file.replace('.pdf', '-signed.pdf')
      await signed.save(resolve(out))
      spinner.succeed(`Signed document saved to ${chalk.green(out)}`)
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── audit ───────────────────────────────────────────────────────────────────

program
  .command('audit <file>')
  .description('Inspect metadata, security, and compliance of a PDF')
  .action(async (file: string) => {
    try {
      const { LombokPDF } = await import('../index.js')
      const pdf  = new LombokPDF()
      const doc  = await pdf.fromFile(resolve(file)).export('pdf')
      const meta = doc.metadata()

      console.log(chalk.bold('\n📋 LombokPDF Document Audit'))
      console.log(chalk.dim('─'.repeat(40)))
      console.log(`Pages:     ${doc.pages()}`)
      console.log(`Size:      ${(doc.size / 1024).toFixed(1)} KB`)
      console.log(`Title:     ${meta.title || chalk.dim('(none)')}`)
      console.log(`Author:    ${meta.author || chalk.dim('(none)')}`)
      console.log(`Creator:   ${meta.creator || chalk.dim('(unknown)')}`)
      console.log(`Producer:  ${meta.producer || chalk.dim('(unknown)')}`)
      console.log(`Language:  ${meta.language || chalk.dim('(none)')}`)
      console.log(chalk.dim('─'.repeat(40)))
      console.log(chalk.green('✓ Audit complete'))
    } catch (err: any) {
      console.error(chalk.red(err.message))
      process.exit(1)
    }
  })

// ─── version ─────────────────────────────────────────────────────────────────

program
  .command('version')
  .description('Print version info')
  .action(async () => {
    const { LombokPDF } = await import('../index.js')
    const support = LombokPDF.supported()
    console.log(`LombokPDF v${LombokPDF.version()}`)
    console.log(`WASM: ${support.wasm ? '✓' : '✗'}`)
    console.log(`HarfBuzz: ${support.harfbuzz ? '✓' : '✗'}`)
    console.log(`Locales: ${support.locales.length}`)
  })

program.parse()
