import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals:     false,
    environment: 'node',
    include:     ['tests/**/*.test.ts'],
    exclude:     ['node_modules', 'dist'],
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'lcov', 'html'],
      include:    ['src/**/*.ts'],
      exclude:    ['src/cli/**', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches:   75,
        functions:  80,
        lines:      80,
      },
    },
    benchmark: {
      include:    ['benchmarks/**/*.bench.ts'],
      reporters:  ['verbose'],
      outputFile: 'benchmarks/results.json',
    },
    // Snapshot directory
    resolveSnapshotPath: (testPath, snapExt) =>
      testPath.replace('tests/', 'tests/snapshots/') + snapExt,
  },
})
