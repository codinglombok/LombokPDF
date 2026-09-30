# Contributing to LombokPDF

Thank you for considering a contribution to LombokPDF!

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)
5. [Submitting a PR](#submitting-a-pr)
6. [Adding a Skill](#adding-a-skill)
7. [Adding a Template](#adding-a-template)
8. [Adding a Language Port](#adding-a-language-port)
9. [Commit Convention](#commit-convention)
10. [Release Process](#release-process)

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
Be kind, constructive, and inclusive.

---

## How to Contribute

- **Bug reports** → Open a GitHub Issue with a minimal reproduction
- **Feature requests** → Open a GitHub Discussion first
- **Security vulnerabilities** → See [SECURITY.md](SECURITY.md) — do NOT open a public issue
- **Documentation fixes** → PRs welcome, no issue needed
- **New templates** → Open an issue first to discuss
- **New language ports** → Open an issue first to discuss

---

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/lombokpdf.git
cd lombokpdf

# Install deps
npm install

# Verify setup
npm run audit:types    # should have 0 errors
npm test               # should pass

# Build
npm run build

# Watch mode
npm run dev
```

### Required tools

- Node.js ≥ 18.0.0 (use `nvm` or `fnm` to switch)
- npm ≥ 9.0.0
- Git

### Optional tools (for WASM development)

- Rust + `cargo` (for LLE engine)
- `wasm-pack` (for WASM compilation)
- `wasm-bindgen-cli`

---

## Coding Standards

### TypeScript

- **Strict mode is non-negotiable.** Every file must pass `tsc --strict --noEmit`.
- **Zero `any`.** Use `unknown` and narrow with type guards.
- **Zero `// @ts-ignore`.** Fix the root cause.
- **All public API needs JSDoc** with at least one `@example`.
- **Use `.js` extensions** in ESM imports (required for Node.js ESM).

```typescript
// Good
export async function merge(docs: Document[], options: MergeOptions = {}): Promise<Document> {
  if (docs.length === 0) throw new Error('lombokpdf/merge: no documents provided')
  // ...
}

// ❌ Bad
export async function merge(docs: any[], options?: any) {
  // ...
}
```

### Security Rules (checked by CI)

- No `eval()`, `new Function()`, `innerHTML =`, `document.write()`
- No `Math.random()` for security-sensitive operations
- No MD5 or SHA-1 for hashing
- No string concatenation for building SQL queries
- No hardcoded secrets, API keys, passwords, or tokens

### Skills: Lazy Loading

All skill modules **must** use dynamic imports internally. This keeps the core bundle small.

```typescript
// ✅ Correct — lazy loaded
export async function merge(docs: Document[]): Promise<Document> {
  const { PDFMerger } = await import('./pdf-merger.js')  // loaded on first call
  return PDFMerger.merge(docs)
}

// ❌ Wrong — static import means it's always in the bundle
import { PDFMerger } from './pdf-merger.js'
export async function merge(docs: Document[]): Promise<Document> { ... }
```

### Templates: No String Interpolation

User data must always go through Handlebars compilation, never string concatenation.

```typescript
// ✅ Safe
Handlebars.compile(templateSource)(userData)

// ❌ Unsafe
`<h1>${userData.title}</h1>`
```

---

## Submitting a PR

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** following the coding standards above.

3. **Add or update tests** in `tests/unit/`. Coverage must not decrease.

4. **Run the full audit suite**:
   ```bash
   npm run audit:all   # must pass — this is a hard requirement
   npm test            # must pass
   npm run build       # must succeed
   ```

5. **Update documentation** if you changed public API:
   - JSDoc on the function
   - `docs/HOW_TO_USE.md` if it's a user-facing feature
   - `CHANGELOG.md` — add an entry under `[Unreleased]`

6. **Push and open a PR** against `main`.

### PR Checklist

```
[ ] `npm run audit:all` passes (no errors allowed)
[ ] `npm test` passes with no skipped tests
[ ] New code has unit tests
[ ] Coverage is ≥ 80% (check with `npm run test:coverage`)
[ ] Public API has JSDoc with @example
[ ] CHANGELOG.md updated
[ ] No secrets, credentials, or real API keys anywhere
[ ] Skill modules use dynamic import()
[ ] TypeScript strict — zero `any`
```

---

## Adding a Skill

1. Create the skill directory if needed:
   ```
   src/skills/{category}/my-skill.ts
   ```

2. Export from the category barrel (`src/skills/{category}/index.ts`):
   ```typescript
   export { mySkill } from './my-skill.js'
   ```

3. Export from the top-level barrel (`src/skills/index.ts`) if it's commonly used.

4. Follow this pattern:

```typescript
// src/skills/ops/my-skill.ts

import type { Document } from '../../core/Document.js'

export interface MySkillOptions {
  /** Description of option */
  someOption?: string
}

/**
 * Brief description of what this skill does.
 *
 * @example
 * ```typescript
 * import { mySkill } from 'lombokpdf/skills/ops'
 *
 * // Standalone usage
 * const result = await mySkill(doc, { someOption: 'value' })
 *
 * // In pipe() chain
 * const doc = await pdf.from({ ... }).pipe(mySkillFn({ someOption: 'value' })).export()
 * ```
 */
export async function mySkill(doc: Document, options: MySkillOptions = {}): Promise<Document> {
  // ✅ Lazy-load heavy dependencies
  const { HeavyLibrary } = await import('./heavy-lib.js')

  const bytes = doc._getRaw()
  // ... process bytes ...
  return doc._withRaw(processedBytes)
}

/** Pipeable version for use with .pipe() */
export function mySkillFn(options?: MySkillOptions) {
  return {
    name: 'mySkill' as const,
    async apply(doc: Document): Promise<Document> {
      return mySkill(doc, options)
    },
  }
}
```

5. Add tests in `tests/unit/skills.test.ts`.

---

## Adding a Template

1. Create the template directory:
   ```
   templates/my-template/
   ```

2. Create `templates/my-template/template.html`:
   - Use YAML front-matter for defaults
   - Use Handlebars syntax (`{{ variable }}`, `{{#each}}`, `{{#if}}`)
   - Use `var(--color-*)` CSS custom properties for theming
   - Include `@page` rules for paged media
   - Test in all 5 LombokCSS themes

3. Add to the built-in list in:
   - `src/templates/engine.ts` (error message)
   - `docs/HOW_TO_USE.md` (template table)
   - `docs/README_FULL_SUMMARY.md` (template table)
   - `CHANGELOG.md`

4. Add template test in `tests/unit/`.

---

## Adding a Language Port

Ports must implement the **identical public API** as the TypeScript canonical port:

```
LombokPDF(options) → Builder → Document
builder.from(source).locale(l).theme(t).page(p).metadata(m).pipe(skill).export(format)
document.save(path) / toBytes() / toBase64() / pipe(stream) / pages() / metadata() / setMetadata(m)
```

Port checklist:

```
[ ] Calls LLE WASM via FFI (not a reimplementation)
[ ] Identical fluent API surface
[ ] Supports all ExportFormat values
[ ] Supports all Source types
[ ] Supports locale() with RTL detection
[ ] Unit tests matching the TypeScript test suite
[ ] Package published to the ecosystem's registry
[ ] README with language-specific install and examples
[ ] CI test job added to ports.yml
[ ] Semantic versioning in sync with core (1.x.y)
```

---

## Commit Convention

Format: `type(scope): short description`

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build process, dependencies, CI |
| `security` | Security fix (use for CVE patches) |

Scopes: `core`, `builder`, `document`, `locale`, `bidi`, `lle`, `cssom`, `template`, `skills`, `skills/io`, `skills/ops`, `skills/security`, `skills/image`, `skills/marks`, `skills/forms`, `skills/structure`, `integrations`, `cli`, `browser`, `ports`, `ports/python`, `ports/php`, `ports/go`, etc.

Examples:
```
feat(skills/security): add PKCS#7 visible signature field support
fix(bidi): correct RTL paragraph detection for mixed Arabic/Latin text
perf(lle): LTTB decimation for 1000+ row table rendering
test(skills): add formFill edge case for checkbox arrays
docs(api): add @example to Builder.embed()
chore(deps): bump parse5 from 7.1.2 to 7.1.3
security: remove dep X — CVE-2026-XXXXX (CVSS 8.1)
feat(ports/go): implement all 8 ExportFormat values
feat(template): add booklet template with bleed and crop marks
```

---

## Release Process

Releases are handled by the maintainer team:

```bash
# 1. Update CHANGELOG.md — move [Unreleased] to the new version
# 2. Run full audit
npm run audit:all

# 3. Bump version
npm version patch    # 1.0.x bug fix
npm version minor    # 1.x.0 new feature
npm version major    # x.0.0 breaking change

# 4. Push tag — triggers release.yml which publishes to all registries
git push --follow-tags
```

The release pipeline publishes to: npm, PyPI, Packagist, Maven Central, crates.io, NuGet, RubyGems, Docker Hub, and creates a GitHub Release with SBOM artifacts.
