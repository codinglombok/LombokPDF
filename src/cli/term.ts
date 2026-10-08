/**
 * Minimal terminal output for the LombokPDF CLI: ANSI colours and a status line.
 * Replaces `chalk` and `ora`; colour follows NO_COLOR / FORCE_COLOR and TTY detection.
 */

type Stream = NodeJS.WriteStream

function colourEnabled(stream: Stream): boolean {
  const env = process.env
  if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return false
  if (env['FORCE_COLOR'] !== undefined) return env['FORCE_COLOR'] !== '0'
  return Boolean(stream.isTTY) && env['TERM'] !== 'dumb'
}

const wrap = (open: number, close: number) => (text: string, stream: Stream = process.stdout): string =>
  colourEnabled(stream) ? `\x1b[${open}m${text}\x1b[${close}m` : text

export const style = {
  bold:  wrap(1, 22),
  dim:   wrap(2, 22),
  red:   wrap(31, 39),
  green: wrap(32, 39),
  cyan:  wrap(36, 39),
}

const FRAMES = ['-', '\\', '|', '/']

/**
 * A one-line progress indicator on stderr. Animates only on a TTY; otherwise it
 * prints nothing until `succeed` or `fail`, so logs and pipes stay clean.
 */
export class Status {
  private timer: ReturnType<typeof setInterval> | undefined
  private frame = 0
  private readonly text: string
  private readonly stream: Stream

  constructor(text: string, stream: Stream = process.stderr) {
    this.text = text
    this.stream = stream
  }

  start(): this {
    if (this.stream.isTTY) {
      this.render()
      this.timer = setInterval(() => this.render(), 100)
      this.timer.unref?.()
    }
    return this
  }

  succeed(message: string): void {
    this.finish(`${style.green('✓', this.stream)} ${message}`)
  }

  fail(message: string): void {
    this.finish(`${style.red('✗', this.stream)} ${message}`)
  }

  private render(): void {
    const f = FRAMES[this.frame++ % FRAMES.length]!
    this.stream.write(`\r\x1b[2K${style.cyan(f, this.stream)} ${this.text}`)
  }

  private finish(line: string): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.stream.write(`${this.stream.isTTY ? '\r\x1b[2K' : ''}${line}\n`)
  }
}
