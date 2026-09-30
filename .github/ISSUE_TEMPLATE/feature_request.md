---
name: Feature Request
about: Suggest a new feature, skill, template, or locale for LombokPDF
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Is your feature request related to a problem?
A clear description of what the problem is. E.g. "I need to generate PDFs with [X] but there's no skill for it."

## Describe the solution you'd like
What you want to happen. If proposing a new skill, template, or locale, describe the API shape you'd expect:

```typescript
// Example of proposed API
import { myNewSkill } from 'lombokpdf/skills/category'

const doc = await pdf.from({ ... }).pipe(myNewSkill({ ... })).export('pdf')
```

## Describe alternatives you've considered
Any alternative solutions or workarounds you've tried.

## Which category does this fall under?
- [ ] New skill module
- [ ] New built-in template
- [ ] New locale/language support
- [ ] New framework adapter
- [ ] Core engine feature (CSS/layout)
- [ ] CLI command
- [ ] Documentation
- [ ] Other

## Additional context
Any other context, mockups, or examples from other libraries.
