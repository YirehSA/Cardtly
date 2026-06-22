// Shared types + helpers for the custom questionnaire add-on.

export const MAX_QUESTIONS = 5
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
