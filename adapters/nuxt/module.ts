/**
 * LombokPDF — Nuxt Module
 * Package: lombokpdf-nuxt
 *
 * Install:
 *   npm install lombokpdf lombokpdf-nuxt
 *
 * nuxt.config.ts:
 *   export default defineNuxtConfig({
 *     modules: ['lombokpdf-nuxt'],
 *     lombokpdf: {
 *       defaultLocale: 'id-ID',
 *       defaultTheme:  'modern-corporate-flat',
 *     }
 *   })
 *
 * server/api/invoice.pdf.ts:
 *   export default defineLombokPDFHandler({
 *     template: 'invoice',
 *     data: async (event) => await getOrder(getRouterParam(event, 'id')),
 *     locale: 'id-ID',
 *   })
 */

import { defineNuxtModule, addServerImportsDir, createResolver, addImportsDir } from '@nuxt/kit'

export interface LombokPDFModuleOptions {
  defaultLocale?: string
  defaultTheme?:  string
  timeout?:       number
}

export default defineNuxtModule<LombokPDFModuleOptions>({
  meta: {
    name:          'lombokpdf-nuxt',
    configKey:     'lombokpdf',
    compatibility: { nuxt: '^3.0.0' },
  },
  defaults: {
    defaultLocale: 'en-US',
    defaultTheme:  'modern-corporate-flat',
    timeout:       30_000,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Make module options available at runtime
    nuxt.options.runtimeConfig.lombokpdf = {
      defaultLocale: options.defaultLocale,
      defaultTheme:  options.defaultTheme,
      timeout:       options.timeout,
    }

    // Register server-side composables (defineLombokPDFHandler)
    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    // Register client-side composables (useLombokPDF)
    addImportsDir(resolver.resolve('./runtime/composables'))
  },
})

// ─── Type augmentation for runtimeConfig ─────────────────────────────────────

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    lombokpdf: {
      defaultLocale: string
      defaultTheme:  string
      timeout:       number
    }
  }
}
