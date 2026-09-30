---
name: Bug Report
about: Report a bug or unexpected behavior in LombokPDF
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the bug
A clear and concise description of what the bug is.

## Minimal reproduction
```typescript
// Minimal code that reproduces the issue
import { LombokPDF } from 'lombokpdf'

const pdf = new LombokPDF()
const doc = await pdf.from({ html: '...' }).export('pdf')
// ...
```

## Expected behavior
What you expected to happen.

## Actual behavior
What actually happened. Include error messages/stack traces.

## Environment
- LombokPDF version: [e.g. 1.0.0]
- Language/port: [e.g. TypeScript, Python, PHP, Go]
- Node/Python/PHP/Go version: [e.g. Node 22.1.0]
- OS: [e.g. Ubuntu 24.04, macOS 15, Windows 11]
- Locale used (if relevant): [e.g. ar-SA]

## Additional context
Add any other context, screenshots, or sample PDFs here.

## Checklist
- [ ] I have searched existing issues for duplicates
- [ ] I have included a minimal reproduction
- [ ] This is not a security vulnerability (if it is, see [SECURITY.md](../../SECURITY.md) instead)
