import type { Document } from '../../core/Document.js'

// ─── Fill ─────────────────────────────────────────────────────────────────────

export type FieldValue = string | number | boolean | string[]

export interface FormFillOptions {
  /** Key-value map of field name → value */
  fields: Record<string, FieldValue>
  /** Flatten fields to static content after filling (default: false) */
  flatten?: boolean
  /** Font to use for text fields (default: inherit) */
  font?: string
}

/**
 * Fill AcroForm fields from a JSON key-value map.
 *
 * @example
 * ```typescript
 * import { formFill } from 'lombokpdf/skills/forms'
 *
 * const filled = await formFill(doc, {
 *   fields: {
 *     'name':    'John Doe',
 *     'email':   'john@example.com',
 *     'agreed':  true,
 *     'country': 'Indonesia',
 *   }
 * })
 * ```
 */
export async function formFill(doc: Document, options: FormFillOptions): Promise<Document> {
  const { AcroFormFiller } = await import('./acroform-filler.js')
  return AcroFormFiller.fill(doc, options)
}

// ─── Extract ──────────────────────────────────────────────────────────────────

export interface FormExtractResult {
  fields: Record<string, FieldValue>
  fieldNames: string[]
  fieldTypes: Record<string, 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature'>
}

/**
 * Extract all AcroForm field names and values as a JSON object.
 *
 * @example
 * ```typescript
 * import { formExtract } from 'lombokpdf/skills/forms'
 *
 * const data = await formExtract(doc)
 * console.log(data.fields)  // { name: 'John', email: 'john@example.com' }
 * ```
 */
export async function formExtract(doc: Document): Promise<FormExtractResult> {
  const { AcroFormExtractor } = await import('./acroform-extractor.js')
  return AcroFormExtractor.extract(doc)
}

// ─── Create ───────────────────────────────────────────────────────────────────

export type FieldDefinition =
  | { type: 'text';     name: string; label?: string; required?: boolean; maxLength?: number; multiline?: boolean }
  | { type: 'checkbox'; name: string; label?: string; required?: boolean; defaultChecked?: boolean }
  | { type: 'radio';    name: string; label?: string; options: string[]; defaultValue?: string }
  | { type: 'dropdown'; name: string; label?: string; options: string[]; required?: boolean }
  | { type: 'signature';name: string; label?: string }
  | { type: 'date';     name: string; label?: string; required?: boolean }

export interface FormCreateOptions {
  fields: Array<FieldDefinition & {
    /** Position: [x, y, width, height] in points on specified page */
    position: [x: number, y: number, width: number, height: number]
    page?: number
  }>
}

/**
 * Add interactive AcroForm fields to a PDF document.
 */
export async function formCreate(doc: Document, options: FormCreateOptions): Promise<Document> {
  const { AcroFormCreator } = await import('./acroform-creator.js')
  return AcroFormCreator.create(doc, options)
}

// ─── Flatten ──────────────────────────────────────────────────────────────────

/**
 * Flatten all form fields — convert interactive fields to static content.
 * Useful before distributing completed forms.
 */
export async function formFlatten(doc: Document): Promise<Document> {
  const { AcroFormFlattener } = await import('./acroform-flattener.js')
  return AcroFormFlattener.flatten(doc)
}
