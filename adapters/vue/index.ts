/**
 * LombokPDF — Vue.js Adapter
 * Package: lombokpdf-vue
 *
 * Install:
 *   npm install lombokpdf lombokpdf-vue
 *
 * Usage in Vue 3 (Composition API):
 * @example
 * ```vue
 * <template>
 *   <LombokPDFPreview template="invoice" :data="invoiceData" locale="id-ID" />
 *   <button @click="downloadPDF" :disabled="loading">Download PDF</button>
 * </template>
 *
 * <script setup>
 * import { LombokPDFPreview, useLombokPDF } from 'lombokpdf-vue'
 * const { generate, download, loading } = useLombokPDF()
 * const invoiceData = { company: 'Acme', total: 1500 }
 * async function downloadPDF() {
 *   const doc = await generate({ template: 'invoice', data: invoiceData, locale: 'id-ID' })
 *   download(doc, 'invoice.pdf')
 * }
 * </script>
 * ```
 */

import { ref, shallowRef, defineComponent, h, onMounted, watch, type Ref, type PropType } from 'vue'
import type { ExportFormat, Source } from 'lombokpdf'

// ─── useLombokPDF composable ─────────────────────────────────────────────────

export interface UseLombokPDFOptions {
  locale?: string
  theme?:  string
}

export interface GenerateOptions {
  template?: string
  html?:     string
  data?:     Record<string, unknown>
  locale?:   string
  theme?:    string
  format?:   ExportFormat
}

export function useLombokPDF(defaultOptions: UseLombokPDFOptions = {}) {
  const loading = ref(false)
  const error:  Ref<Error | null> = ref(null)

  async function generate(options: GenerateOptions) {
    loading.value = true
    error.value   = null

    try {
      const { LombokPDF } = await import('lombokpdf')
      const pdf = new LombokPDF({
        locale: options.locale ?? defaultOptions.locale ?? 'en-US',
        theme:  options.theme  ?? defaultOptions.theme,
      })

      const source: Source = options.template
        ? { template: options.template, data: options.data }
        : { html: options.html ?? '' }

      return await pdf
        .from(source)
        .locale(options.locale ?? defaultOptions.locale ?? 'en-US')
        .export(options.format ?? 'pdf')
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw err
    } finally {
      loading.value = false
    }
  }

  function download(doc: { toBytes(): Promise<Uint8Array> }, filename: string = 'document.pdf') {
    doc.toBytes().then(bytes => {
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function open(doc: { toBytes(): Promise<Uint8Array> }) {
    doc.toBytes().then(bytes => {
      const blob = new Blob([bytes], { type: 'application/pdf' })
      window.open(URL.createObjectURL(blob), '_blank')
    })
  }

  return { generate, download, open, loading, error }
}

// ─── LombokPDFPreview component ──────────────────────────────────────────────

export const LombokPDFPreview = defineComponent({
  name: 'LombokPDFPreview',
  props: {
    template: { type: String,  default: '' },
    html:     { type: String,  default: '' },
    data:     { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    locale:   { type: String,  default: 'en-US' },
    theme:    { type: String,  default: 'modern-corporate-flat' },
    format:   { type: String as PropType<ExportFormat>, default: 'pdf' },
    width:    { type: String,  default: '100%' },
    height:   { type: String,  default: '600px' },
  },
  setup(props) {
    const dataURI  = ref<string>('')
    const loading  = ref(true)
    const error:   Ref<string | null> = ref(null)

    async function render() {
      loading.value = true
      error.value   = null

      try {
        const { LombokPDF } = await import('lombokpdf')
        const pdf = new LombokPDF({ locale: props.locale, theme: props.theme })

        const source: Source = props.template
          ? { template: props.template, data: props.data }
          : { html: props.html }

        const doc = await pdf.from(source).locale(props.locale).export(props.format)
        dataURI.value = await doc.toDataURI()
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'PDF generation failed'
      } finally {
        loading.value = false
      }
    }

    onMounted(render)

    watch(() => [props.template, props.html, props.data, props.locale], render, { deep: true })

    return () => {
      if (loading.value) {
        return h('div', {
          style: `display:flex;align-items:center;justify-content:center;width:${props.width};height:${props.height};background:#f9fafb;color:#6b7280;font-family:sans-serif;font-size:14px;`,
        }, 'Generating PDF…')
      }

      if (error.value) {
        return h('div', {
          style: `display:flex;align-items:center;justify-content:center;width:${props.width};height:${props.height};background:#fef2f2;color:#dc2626;font-family:sans-serif;font-size:13px;padding:16px;`,
        }, `Error: ${error.value}`)
      }

      return h('iframe', {
        src:    dataURI.value,
        style:  `width:${props.width};height:${props.height};border:none;border-radius:4px;`,
        title:  'PDF Preview',
      })
    }
  },
})

// ─── Plugin (optional) ───────────────────────────────────────────────────────

export const LombokPDFPlugin = {
  install(app: any, options: UseLombokPDFOptions = {}) {
    app.component('LombokPDFPreview', LombokPDFPreview)
    app.provide('lombokpdf:options', options)
  },
}

export default LombokPDFPlugin
