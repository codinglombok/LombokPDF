/**
 * LombokPDF — Skill Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { Document } from '../../src/core/Document.js'

const fakePDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF

// ─── security skills ─────────────────────────────────────────────────────────

describe('signPKCS7 skill factory', () => {
  it('returns a Skill object when called with options only', async () => {
    const { signPKCS7 } = await import('../../src/skills/security/index.js')

    vi.mock('../../src/skills/security/pkcs7.js', () => ({
      PKCS7Signer: { sign: vi.fn().mockResolvedValue(new Document(fakePDF)) },
    }))

    const skill = signPKCS7({ cert: './fake.p12', pass: 'test' })
    expect(skill).toHaveProperty('name', 'signPKCS7')
    expect(typeof skill.apply).toBe('function')
  })
})

describe('encryptAES skill factory', () => {
  it('returns a Skill object when called with options only', async () => {
    const { encryptAES } = await import('../../src/skills/security/index.js')

    const skill = encryptAES({ ownerPassword: 'admin123' })
    expect(skill).toHaveProperty('name', 'encryptAES')
    expect(typeof skill.apply).toBe('function')
  })
})

// ─── ops skills ───────────────────────────────────────────────────────────────

describe('merge()', () => {
  it('throws when given 0 documents', async () => {
    const { merge } = await import('../../src/skills/ops/index.js')
    await expect(merge([])).rejects.toThrow('no documents provided')
  })

  it('returns the same document when given 1', async () => {
    const { merge } = await import('../../src/skills/ops/index.js')
    const doc    = new Document(fakePDF)
    const result = await merge([doc])
    expect(result).toBe(doc)
  })
})

describe('watermarkSkill()', () => {
  it('creates a pipeable Skill', async () => {
    const { watermarkSkill } = await import('../../src/skills/ops/index.js')
    const skill = watermarkSkill({ text: 'DRAFT' })
    expect(skill.name).toBe('watermark')
    expect(typeof skill.apply).toBe('function')
  })
})

describe('compressSkill()', () => {
  it('creates a pipeable Skill', async () => {
    const { compressSkill } = await import('../../src/skills/ops/index.js')
    const skill = compressSkill()
    expect(skill.name).toBe('compress')
    expect(typeof skill.apply).toBe('function')
  })
})

// ─── page config ─────────────────────────────────────────────────────────────

describe('applyPageConfig()', () => {
  it('returns A4 dimensions in portrait', async () => {
    const { applyPageConfig } = await import('../../src/core/lle/page.js')
    const { width, height } = applyPageConfig({ size: 'A4', orientation: 'portrait' })
    expect(width).toBeCloseTo(595.28, 1)
    expect(height).toBeCloseTo(841.89, 1)
  })

  it('swaps dimensions for landscape', async () => {
    const { applyPageConfig } = await import('../../src/core/lle/page.js')
    const { width, height } = applyPageConfig({ size: 'A4', orientation: 'landscape' })
    expect(width).toBeCloseTo(841.89, 1)
    expect(height).toBeCloseTo(595.28, 1)
  })

  it('accepts custom dimensions as [w, h] tuple', async () => {
    const { applyPageConfig } = await import('../../src/core/lle/page.js')
    const { width, height } = applyPageConfig({ size: [400, 600] })
    expect(width).toBe(400)
    expect(height).toBe(600)
  })

  it('defaults to 72pt margins', async () => {
    const { applyPageConfig } = await import('../../src/core/lle/page.js')
    const { margins } = applyPageConfig({})
    expect(margins.top).toBe(72)
    expect(margins.right).toBe(72)
    expect(margins.bottom).toBe(72)
    expect(margins.left).toBe(72)
  })

  it('allows partial margin override', async () => {
    const { applyPageConfig } = await import('../../src/core/lle/page.js')
    const { margins } = applyPageConfig({ margins: { top: 36, bottom: 36 } })
    expect(margins.top).toBe(36)
    expect(margins.bottom).toBe(36)
    expect(margins.left).toBe(72) // default
  })
})

// ─── BiDi resolver ───────────────────────────────────────────────────────────

describe('BiDiResolver', () => {
  it('resolves RTL for Arabic text', async () => {
    const { BiDiResolver } = await import('../../src/core/bidi/resolver.js')
    const bidi   = new BiDiResolver('auto')
    const result = bidi.resolve('مرحباً بالعالم')
    expect(result).toContain('\u202B') // RLE mark
  })

  it('does not add marks for Latin text in LTR base', async () => {
    const { BiDiResolver } = await import('../../src/core/bidi/resolver.js')
    const bidi   = new BiDiResolver('ltr')
    const result = bidi.resolve('Hello, World')
    expect(result).toBe('Hello, World')
  })

  it('adds LRE for Latin text in RTL base document', async () => {
    const { BiDiResolver } = await import('../../src/core/bidi/resolver.js')
    const bidi   = new BiDiResolver('rtl')
    const result = bidi.resolve('Hello World')
    expect(result).toContain('\u202A') // LRE mark
  })

  it('rtlBlock() wraps in RTL markers', async () => {
    const { BiDiResolver } = await import('../../src/core/bidi/resolver.js')
    const wrapped = BiDiResolver.rtlBlock('مرحباً')
    expect(wrapped.startsWith('\u202B')).toBe(true)
    expect(wrapped.endsWith('\u202C')).toBe(true)
  })
})
