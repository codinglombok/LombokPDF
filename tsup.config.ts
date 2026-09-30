import { defineConfig } from 'tsup'

export default defineConfig([
  // Main package — CJS + ESM
  {
    entry: {
      index: 'src/index.ts',
      'skills/index':     'src/skills/index.ts',
      'skills/io':        'src/skills/io/index.ts',
      'skills/ops':       'src/skills/ops/index.ts',
      'skills/image':     'src/skills/image/index.ts',
      'skills/marks':     'src/skills/marks/index.ts',
      'skills/forms':     'src/skills/forms/index.ts',
      'skills/security':  'src/skills/security/index.ts',
      'skills/structure': 'src/skills/structure/index.ts',
      'cli/index':        'src/cli/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: true,
    treeshake: true,
    clean: true,
    external: ['@lombok/css', '@lombok/charts'],
    define: {
      '__LOMBOKPDF_VERSION__': JSON.stringify(process.env['npm_package_version'] ?? '0.0.0'),
    },
  },
  // Browser bundle — ESM only, WASM loaded via fetch
  {
    entry: { browser: 'src/browser.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    minify: true,
    platform: 'browser',
    external: ['@lombok/css', '@lombok/charts'],
  },
])
