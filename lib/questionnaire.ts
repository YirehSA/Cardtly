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
}

// One saved form in the library. Same as a QuestionnaireConfig but with
// a stable id so we can remember which one is "live".
export interface SavedQuestionnaire {
  id: string
  title?: string
  questions: Question[]
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
  return { title: title || undefined, questions }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

// Sanitise one saved form (a config plus a stable id).
export function sanitizeSavedQuestionnaire(input: any, index = 0): SavedQuestionnaire {
  const { title, questions } = sanitizeQuestionnaire(input)
  const id = typeof input?.id === 'string' && input.id
    ? input.id
    : `form_${index + 1}_${Math.abs(hash(JSON.stringify(questions) + index))}`
  return { id, title, questions }
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
