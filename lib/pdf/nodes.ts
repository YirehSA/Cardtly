// The PDF document tree, built without React.
//
// @react-pdf is normally driven through JSX. That does not work here, and the
// reason is worth writing down because the error it produces says nothing.
//
// Next 15's App Router serves route handlers its OWN bundled React (19.0.0-rc)
// while @react-pdf, loaded from node_modules, sees the installed React 18.3.1.
// @react-pdf picks a fiber reconciler by reading React.version, so it loads the
// React 18 build, which then receives elements created by React 19. React 19
// tags elements Symbol(react.transitional.element); React 18 looks for
// Symbol(react.element), does not recognise them, and throws "Minified React
// error #31" from deep inside the reconciler with no mention of versions.
//
// The fix is to skip React entirely. @react-pdf's reconciler exists only to
// turn elements into plain nodes of the shape below, and the layout engine
// takes those nodes directly. Building them here removes the reconciler, the
// version coupling and a whole class of failure from a document that has to
// render identically for years.
//
// Node shape is exactly what createInstance produces in
// @react-pdf/renderer: { type, box, style, props, children }, with text as
// { type: 'TEXT_INSTANCE', value }.

export type Style = Record<string, any>

export interface PdfNode {
  type: string
  box?: Record<string, unknown>
  style?: Style | Style[]
  props?: Record<string, any>
  children?: PdfNode[]
  value?: string
}

export type Child = PdfNode | string | number | null | undefined | false

/** Types whose children may be bare text. Mirrors appendChild in
 *  @react-pdf/renderer: a string anywhere else is dropped, because the layout
 *  engine has nothing to measure it with. */
const TEXTUAL = new Set(['TEXT', 'LINK', 'TSPAN', 'NOTE'])

export function el(
  type: string,
  props?: (Record<string, any> & { style?: Style | Style[] }) | null,
  ...children: (Child | Child[])[]
): PdfNode {
  const { style, ...rest } = props || {}
  // Typed as the survivors, not as Child: the guard below drops every empty
  // form a conditional can produce, so what lands in the array is only ever a
  // node or a printable primitive.
  const flat: (PdfNode | string | number)[] = []
  const push = (c: Child | Child[]) => {
    if (Array.isArray(c)) { c.forEach(push); return }
    if (c === null || c === undefined || c === false || c === '') return
    flat.push(c)
  }
  children.forEach(push)

  const kids: PdfNode[] = []
  for (const c of flat) {
    if (typeof c === 'string' || typeof c === 'number') {
      if (!TEXTUAL.has(type)) continue
      kids.push({ type: 'TEXT_INSTANCE', value: String(c) })
    } else {
      kids.push(c)
    }
  }

  return { type, box: {}, style: style || {}, props: rest, children: kids }
}

export const doc = (props: Record<string, any> | null, ...kids: (Child | Child[])[]) => el('DOCUMENT', props, ...kids)
export const page = (props: Record<string, any> | null, ...kids: (Child | Child[])[]) => el('PAGE', props, ...kids)
export const view = (props: Record<string, any> | null, ...kids: (Child | Child[])[]) => el('VIEW', props, ...kids)
export const text = (props: Record<string, any> | null, ...kids: (Child | Child[])[]) => el('TEXT', props, ...kids)
export const image = (props: Record<string, any>) => el('IMAGE', props)
