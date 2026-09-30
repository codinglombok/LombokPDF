// Convenience re-exports of the most commonly used skills
// Import specific skill modules for tree-shaking:
//   import { merge } from 'lombokpdf/skills/ops'
//   import { signPKCS7 } from 'lombokpdf/skills/security'

export { merge, split, rotate, compress, watermark }   from './ops/index.js'
export { importDocx, importMarkdown, importHTML, importCSV, exportPNG, exportSVG } from './io/index.js'
export { splitimg, rasterize, crop, ocr }              from './image/index.js'
export { qrcode, barcode, datamatrix, pdf417 }         from './marks/index.js'
export { formFill, formExtract, formCreate }           from './forms/index.js'
export { signPKCS7, encryptAES, redact, verify }       from './security/index.js'
export { toc, footnotes, crossRef, bookmarks }         from './structure/index.js'
