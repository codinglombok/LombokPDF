import type { PageConfig, PageSize } from '../../types.js'

const PAGE_SIZES: Record<string, [number, number]> = {
  'A3':     [841.89, 1190.55],
  'A4':     [595.28,  841.89],
  'A5':     [419.53,  595.28],
  'Letter': [612,     792],
  'Legal':  [612,    1008],
  'Tabloid':[792,    1224],
}

const DEFAULT_MARGINS = { top: 72, right: 72, bottom: 72, left: 72 }

export function applyPageConfig(config: PageConfig): {
  width: number
  height: number
  margins: { top: number; right: number; bottom: number; left: number }
} {
  const size   = config.size        ?? 'A4'
  const orient = config.orientation ?? 'portrait'
  const margins = { ...DEFAULT_MARGINS, ...config.margins }

  let [w, h] = resolveSize(size)

  if (orient === 'landscape') {
    ;[w, h] = [h, w]
  }

  return { width: w, height: h, margins }
}

function resolveSize(size: PageSize): [number, number] {
  if (Array.isArray(size)) return size
  return PAGE_SIZES[size] ?? PAGE_SIZES['A4']!
}
