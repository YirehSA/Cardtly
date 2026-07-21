// Shared types + helpers for the custom questionnaire add-on.

export const MAX_QUESTIONS = 5
// You can build several forms and switch which one is live. Cap the
// library so the switcher stays tidy.
export const MAX_QUESTIONNAIRES = 3
export type QuestionType = 'short' | 'paragraph' | 'dropdown'

export interface Question {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options?: string[] // dropdown only
}

export interface QuestionnaireConfig {
  title?: string
  questions: Question[]
  /** Button fill on the public card. Undefined follows the card's accent. */
  buttonBg?: string
  /** Button label colour. Undefined follows the card's text colour. */
  buttonText?: string
}

// One saved form in the library. Same as a QuestionnaireConfig but with
// a stable id so we can remember which one is "live".
export interface SavedQuestionnaire {
  id: string
  title?: string
  questions: Question[]
  buttonBg?: string
  buttonText?: string
}

// A colour we are willing to put in a style attribute. Only #rgb and #rrggbb.
//
// Deliberately strict rather than passing the string through: these values are
// stored from the browser and rendered into the style of a public page, so
// anything clever in them is somebody else's idea of clever.
export function safeHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v.toLowerCase() : undefined
}

// WCAG contrast between two hex colours, 1 (identical) to 21 (black on white).
// Used to warn before somebody publishes a yellow button with white writing on
// it. AA wants 4.5 for body text, 3 for large or bold text; this button is
// bold 14px, so 3 is the line that matters and 4.5 is the comfortable one.
export function contrastRatio(a: string, b: string): number | null {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return null
  const la = luminance(ca)
  const lb = luminance(cb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function hexToRgb(hex: string): [number, number, number] | null {
  const v = safeHex(hex)
  if (!v) return null
  const h = v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

// Sanitise a questionnaire config coming from the client before we
// save it: cap at MAX_QUESTIONS, trim text, keep only valid types,
// require dropdown options, drop blank questions.
export function sanitizeQuestionnaire(input: any): QuestionnaireConfig {
  const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 80) : ''
  const rawQuestions = Array.isArray(input?.questions) ? input.questions : []

  const questions: Question[] = []
  for (const q of rawQuestions.slice(0, MAX_QUESTIONS)) {
    const label = typeof q?.label === 'string' ? q.label.trim().slice(0, 120) : ''
    if (!label) continue
    const type: QuestionType = q?.type === 'paragraph' || q?.type === 'dropdown' ? q.type : 'short'
    const required = !!q?.required
    let options: string[] | undefined
    if (type === 'dropdown') {
      options = (Array.isArray(q?.options) ? q.options : [])
        .map((o: any) => (typeof o === 'string' ? o.trim() : ''))
        .filter(Boolean)
        .slice(0, 12)
      if (options.length === 0) continue // a dropdown with no options is useless
    }
    questions.push({
      id: typeof q?.id === 'string' && q.id ? q.id : `q${questions.length + 1}_${Math.abs(hash(label))}`,
      label, type, required, options,
    })
  }
  // Anything this function does not name is dropped, which is what makes it a
  // sanitiser. It also means a new field that is not added here saves
  // successfully, reports success, and is simply gone on the next load.
  return {
    title: title || undefined,
    questions,
    buttonBg: safeHex(input?.buttonBg),
    buttonText: safeHex(input?.buttonText),
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

// Sanitise one saved form (a config plus a stable id).
export function sanitizeSavedQuestionnaire(input: any, index = 0): SavedQuestionnaire {
  const { title, questions, buttonBg, buttonText } = sanitizeQuestionnaire(input)
  const id = typeof input?.id === 'string' && input.id
    ? input.id
    : `form_${index + 1}_${Math.abs(hash(JSON.stringify(questions) + index))}`
  return { id, title, questions, buttonBg, buttonText }
}

// The copy of the live form that the public card reads, from the saved form.
//
// Everything except the library id, by subtraction rather than by listing what
// to keep. The previous version named title and questions explicitly, so any
// field added afterwards was written to the library, shown in the builder, and
// dropped from the only copy that renders.
export function liveMirror(form: SavedQuestionnaire): QuestionnaireConfig {
  const { id: _id, ...rest } = form
  return rest
}

// Sanitise the whole library (up to MAX_QUESTIONNAIRES forms) and work
// out which one is live. Empty forms (no valid questions) are dropped;
// if that leaves nothing, one empty form is kept so the builder always
// has something to edit. The active form is the one whose id matches
// activeId, else the first.
export function sanitizeLibrary(
  inputForms: any,
  activeId?: string
): { questionnaires: SavedQuestionnaire[]; active: SavedQuestionnaire } {
  const raw = Array.isArray(inputForms) ? inputForms.slice(0, MAX_QUESTIONNAIRES) : []
  let forms = raw
    .map((f, i) => sanitizeSavedQuestionnaire(f, i))
    .filter(f => f.questions.length > 0)
  if (forms.length === 0) forms = [{ id: 'form_1', title: undefined, questions: [] }]
  const active = forms.find(f => f.id === activeId) || forms[0]
  return { questionnaires: forms, active }
}
