'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Loader2, Save, Eye } from 'lucide-react'
import { MAX_QUESTIONS, type Question, type QuestionType, type QuestionnaireConfig } from '@/lib/questionnaire'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

const TYPE_LABELS: Record<QuestionType, string> = {
  short: 'Short answer',
  paragraph: 'Paragraph',
  dropdown: 'Dropdown',
}

let idSeq = 0
function newQuestion(): Question {
  idSeq += 1
  return { id: `new_${idSeq}_${Date.now()}`, label: '', type: 'short', required: false }
}

export default function QuestionnaireBuilder({ initial }: { initial: QuestionnaireConfig | null }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [questions, setQuestions] = useState<Question[]>(initial?.questions?.length ? initial.questions : [newQuestion()])
  const [saving, setSaving] = useState(false)

  function update(id: string, patch: Partial<Question>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
  }
  function remove(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }
  function add() {
    if (questions.length >= MAX_QUESTIONS) return
    setQuestions(qs => [...qs, newQuestion()])
  }

  async function save() {
    // Validate before sending.
    for (const q of questions) {
      if (!q.label.trim()) { toast.error('Every question needs a label'); return }
      if (q.type === 'dropdown' && !(q.options || []).some(o => o.trim())) {
        toast.error(`"${q.label}" is a dropdown - add at least one option`); return
      }
    }
    setSaving(true)
    try {
      const res = await fetch('/api/card/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, questions }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Questionnaire saved')
      } else {
        toast.error(data.error || 'Could not save')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Form title (optional)</label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
          placeholder="e.g. A few quick questions"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
        <p className="text-xs text-muted-foreground mt-2">
          Visitors first fill in name, email, contact, and company, then your questions below, then a message box.
        </p>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <GripVertical className="w-4 h-4" />Question {i + 1}
              </span>
              <button onClick={() => remove(q.id)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <input value={q.label} onChange={e => update(q.id, { label: e.target.value })} maxLength={120}
              placeholder="Your question"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring transition" />

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map(t => (
                <button key={t} onClick={() => update(q.id, { type: t })}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                  style={q.type === t ? { background: grad, color: '#fff' } : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto cursor-pointer">
                <input type="checkbox" checked={q.required} onChange={e => update(q.id, { required: e.target.checked })} />
                Required
              </label>
            </div>

            {q.type === 'dropdown' && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Options (one per line)</label>
                <textarea
                  value={(q.options || []).join('\n')}
                  onChange={e => update(q.id, { options: e.target.value.split('\n') })}
                  rows={3}
                  placeholder={'Option one\nOption two\nOption three'}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={add} disabled={questions.length >= MAX_QUESTIONS}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition disabled:opacity-50">
          <Plus className="w-4 h-4" />Add question
          <span className="text-xs text-muted-foreground">({questions.length}/{MAX_QUESTIONS})</span>
        </button>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: grad }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save questionnaire
        </button>
      </div>
    </div>
  )
}
