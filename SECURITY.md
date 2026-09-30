# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Active support  |
| < 1.0   | Not supported   |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Report security vulnerabilities via **GitHub Security Advisories:**
Report: https://github.com/codinglombok/lombokpdf/security/advisories/new

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact assessment
- (Optional) Suggested fix or patch

### Response SLA

| Severity | Acknowledgement | Patch Target |
|---|---|---|
| Critical (CVSS 9.0+) | 24 hours | 7 days |
| High (CVSS 7.0–8.9) | 48 hours | 14 days |
| Medium (CVSS 4.0–6.9) | 72 hours | 30 days |
| Low (CVSS < 4.0) | 7 days | Next release |

We follow [Coordinated Vulnerability Disclosure (CVD)](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html).

## Security Design

### What We Audit on Every Release

```bash
npm run audit:security   # 0 critical, 0 high CVEs (npm audit + OSV scanner)
npm run audit:tokens     # 40+ secret patterns — no credentials in source
npm run audit:sql        # SQL injection pattern scan
npm run audit:types      # TypeScript strict — zero `any`
npm run audit:licenses   # Apache-2.0/MIT/BSD only — no GPL/AGPL
npm run audit:sbom       # SPDX 2.3 Software Bill of Materials generated
```

All audits must pass before any release is tagged. The release CI pipeline (`release.yml`) blocks on `npm run audit:all`.

### Explicitly Banned Dependencies

| Package | Reason | CVE |
|---|---|---|
| `wkhtmltopdf` | Archived, critical unpatched RCE | CVSS 9.8 (CVE-2023-23104) |
| `puppeteer` | Chromium — not appropriate for server PDF generation | N/A |
| `electron` | Desktop app framework — wrong context | N/A |

The audit script scans `package-lock.json` for these packages and blocks release if found.

### Source Code Rules

Enforced by `audit-security.js` on every PR:

- **No `eval()`** — XSS/injection risk
- **No `innerHTML =`** — XSS risk
- **No `new Function()`** — code injection risk
- **No `child_process.exec()`** — prefer `execFile()` with explicit args
- **No `Math.random()`** for security purposes — use `crypto.randomBytes()`
- **No MD5 or SHA-1** — use SHA-256+ for any hashing

### Template Security

User-provided template data is always routed through Handlebars template compilation — never concatenated directly into HTML strings. This prevents XSS via template injection.

```typescript
// ✅ Safe — Handlebars HTML-escapes by default
template.render('invoice', userSuppliedData)

// ❌ Unsafe — never do this
const html = `<h1>${userSuppliedData.company}</h1>`
```

### WASM Sandbox

The LombokLayout Engine runs inside a WebAssembly sandbox which:
- Has no direct access to the host filesystem
- Cannot make network requests
- Cannot spawn subprocesses
- Has bounded memory (configurable, default 512MB max)

### Cryptographic Operations

| Operation | Algorithm | Notes |
|---|---|---|
| PDF encryption | AES-256-CBC | User and owner passwords |
| Digital signature | PKCS#7 / CAdES | X.509 certificate chain |
| Password KDF | Argon2id | For any password storage in optional template stores |
| Secure random | `crypto.randomBytes()` | For nonces, IVs |

### Dependency Integrity

All production dependencies are:
- SHA-512 integrity-hashed in `package-lock.json`
- Pinned to exact versions (no `^` or `~` for production deps)
- Monitored weekly by GitHub Dependabot
- Scanned against the OSV vulnerability database on every build

### SBOM

A Software Bill of Materials (SPDX 2.3 JSON) is generated and published as a release artifact on every tagged version. Verify with:

```bash
cat sbom.spdx.json | sha256sum
# Compare against sbom.spdx.json.sha256 in the release
```

## Known Security History

| Version | Date | Severity | Description | Fixed |
|---|---|---|---|---|
| — | — | — | No known vulnerabilities at launch | — |

## Bug Bounty

We do not currently operate a paid bug bounty program. We gratefully acknowledge security researchers in our `CHANGELOG.md` and release notes.

## Contact

Security team: security@codinglombok.dev (PGP key available on request)
