// Salinan dari LombokMarkDown v2.0.0 (4fceb72), src/node.ts; jangan diubah di sini.
// Perbaikan dilakukan di repo LombokMarkDown lalu disalin ulang (docs/map_LombokPDF_v1.0.0.md bagian 3).
// @ts-nocheck -- tipe diperiksa di repo asal dengan tsconfig-nya sendiri; opsi ketat LombokPDF tidak diterapkan ke salinan.
/**
 * Internal document tree used while parsing (converted to the public AST at the end).
 */

export type NodeType =
  | 'document' | 'blockquote' | 'list' | 'item' | 'paragraph' | 'heading' | 'thematicBreak' | 'codeBlock'
  | 'htmlBlock' | 'table' | 'tableRow' | 'tableCell'
  | 'text' | 'softbreak' | 'linebreak' | 'emph' | 'strong' | 'delete' | 'code' | 'htmlInline' | 'link' | 'image'

export interface ListData {
  type: 'bullet' | 'ordered'
  tight: boolean
  bulletChar?: string
  start?: number
  delimiter?: '.' | ')'
  markerOffset: number
  padding: number
}

export type Align = 'left' | 'center' | 'right' | null

export class MdNode {
  parent: MdNode | null = null
  firstChild: MdNode | null = null
  lastChild: MdNode | null = null
  prev: MdNode | null = null
  next: MdNode | null = null
  open = true
  lastLineBlank = false
  startLine = 0
  /** Accumulated raw lines (paragraph, code, HTML block). */
  content = ''
  /** Text value (text, code, codeBlock, html). */
  literal = ''
  level = 0
  fenced = false
  fenceChar = ''
  fenceLength = 0
  fenceOffset = 0
  info = ''
  htmlBlockType = 0
  listData?: ListData
  checked?: boolean
  destination = ''
  title = ''
  /** Table: alignments; tableCell: alignment; tableRow/tableCell: header flag. */
  aligns: Align[] = []
  align: Align = null
  header = false
  /** Raw cells per table row before inline parsing. */
  rawRows: string[][] = []

  constructor(readonly type: NodeType) {}

  append(child: MdNode): MdNode {
    child.unlink()
    child.parent = this
    if (this.lastChild) {
      this.lastChild.next = child
      child.prev = this.lastChild
      this.lastChild = child
    } else {
      this.firstChild = this.lastChild = child
    }
    return child
  }

  insertAfter(sibling: MdNode): void {
    sibling.unlink()
    sibling.next = this.next
    if (sibling.next) sibling.next.prev = sibling
    sibling.prev = this
    this.next = sibling
    sibling.parent = this.parent
    if (sibling.parent && !sibling.next) sibling.parent.lastChild = sibling
  }

  insertBefore(sibling: MdNode): void {
    sibling.unlink()
    sibling.prev = this.prev
    if (sibling.prev) sibling.prev.next = sibling
    sibling.next = this
    this.prev = sibling
    sibling.parent = this.parent
    if (sibling.parent && !sibling.prev) sibling.parent.firstChild = sibling
  }

  unlink(): void {
    if (this.prev) this.prev.next = this.next
    else if (this.parent) this.parent.firstChild = this.next
    if (this.next) this.next.prev = this.prev
    else if (this.parent) this.parent.lastChild = this.prev
    this.parent = this.prev = this.next = null
  }
}

export function text(value: string): MdNode {
  const n = new MdNode('text')
  n.literal = value
  return n
}

const LEAVES = new Set<NodeType>(['text', 'softbreak', 'linebreak', 'code', 'htmlInline', 'thematicBreak', 'codeBlock', 'htmlBlock'])

export interface WalkEvent {
  node: MdNode
  entering: boolean
}

/**
 * Iterative depth-first walk: containers yield an entering and an exiting event, leaves
 * only an entering event. No recursion, so arbitrarily deep documents are safe.
 */
export function* walk(root: MdNode): Generator<WalkEvent> {
  let cur: MdNode | null = root
  let entering = true
  while (cur) {
    const leaf = LEAVES.has(cur.type)
    if (!leaf || entering) yield { node: cur, entering }
    if (entering && !leaf && cur.firstChild) {
      cur = cur.firstChild
      continue
    }
    if (entering && !leaf) {
      entering = false
      continue
    }
    if (cur === root) break
    if (cur.next) {
      cur = cur.next
      entering = true
    } else {
      cur = cur.parent
      entering = false
    }
  }
}
