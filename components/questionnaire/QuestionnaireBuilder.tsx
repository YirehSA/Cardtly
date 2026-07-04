'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Loader2, Save, Check, Radio } from 'lucide-react'
import { MAX_QUESTIONS, MAX_QUESTIONNAIRES, type Question, type QuestionType, type SavedQuestionnaire } from '@/lib/questionnaire'

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
function newFormId(): string {
  idSeq += 1
  return `form_new_${idSeq}_${Date.now()}`
}
function blankForm(): SavedQuestionnaire {
  return { id: newFormId(), title: '', questions: [newQuestion()] }
}

interface Props {
  initial: { questionnaires: SavedQuestionnaire[]; activeId: string | null }
  teamWide?: boolean
  // Which card/org this builder is saving to (from the page's switcher).
  target?: { table: string; id: string }
}

export default function QuestionnaireBuilder({ initial, teamWide, target }: Props) {
  // Every form keeps at least one (possibly empty) question row so the
  // editor is never blank.
  const seeded: SavedQuestionnaire[] = initial.questionnaires.length
    ? initial.questionnaires.map(f => ({ ...f, questions: f.questions.length ? f.questions : [newQuestion()] }))
    : [blankForm()]

  const [forms, setForms] = useState<SavedQuestionnaire[]>(seeded)
  const [activeId, setActiveId] = useState<string>(initial.activeId && seeded.some(f => f.id === initial.activeId) ? initial.activeId : seeded[0].id)
  const [selectedId, setSelectedId] = useState<string>(activeId)
  const [saving, setSaving] = useState(false)

  const selected = forms.find(f => f.id === selectedId) || forms[0]
  const cardWord = teamWide ? 'cards' : 'card'

  // --- Question-level edits (act on the selected form) ---
  function patchSelected(fn: (f: SavedQuestionnaire) => SavedQuestionnaire) {
    setForms(fs => fs.map(f => f.id === selected.id ? fn(f) : f))
  }
  function updateQ(qid: string, patch: Partial<Question>) {
    patchSelected(f => ({ ...f, questions: f.questions.map(q => q.id === qid ? { ...q, ...patch } : q) }))
  }
  function removeQ(qid: string) {
    patchSelected(f => ({ ...f, questions: f.questions.filter(q => q.id !== qid) }))
  }
  function addQ() {
    if (selected.questions.length >= MAX_QUESTIONS) return
    patchSelected(f => ({ ...f, questions: [...f.questions, newQuestion()] }))
  }
  function setTitle(title: string) {
    patchSelected(f => ({ ...f, title }))
  }

  // --- Form-level edits ---
  function addForm() {
    if (forms.length >= MAX_QUESTIONNAIRES) return
    const f = blankForm()
    setForms(fs => [...fs, f])
    setSelectedId(f.id)
  }
  function deleteForm(id: string) {
    if (forms.length <= 1) return
    const remaining = forms.filter(f => f.id !== id)
    setForms(remaining)
    if (selectedId === id) setSelectedId(remaining[0].id)
    if (activeId === id) setActiveId(remaining[0].id) // live form falls back to the first remaining
  }
  function makeLive(id: string) {
    setActiveId(id)
    toast.success('This form is now live')
  }

  async function save() {
    // Drop blank-label rows (the server does too), then validate dropdowns.
    const cleaned = forms.map(f => ({ ...f, questions: f.questions.filter(q => q.label.trim()) }))
    for (const f of cleaned) {
      for (const q of f.questions) {
        if (q.type === 'dropdown' && !(q.options || []).some(o => o.trim())) {
          toast.error(`"${q.label}" is a dropdown - add at least one option`)
          return
        }
      }
    }
    const liveForm = cleaned.find(f => f.id === activeId) || cleaned[0]
    if (!liveForm || liveForm.questions.length === 0) {
      toast.error('Your live form needs at least one question')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/card/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaires: cleaned, activeId, targetTable: target?.table, targetId: target?.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Saved')
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
      {/* Form switcher */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Your forms</h2>
          <span className="text-xs text-muted-foreground">{forms.length}/{MAX_QUESTIONNAIRES}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {forms.map((f, i) => {
            const isLive = f.id === activeId
            const isSel = f.id === selectedId
            return (
              <button key={f.id} type="button" onClick={() => setSelectedId(f.id)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition"
                style={isSel
                  ? { borderColor: 'transparent', background: grad, color: '#fff' }
                  : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
                <span className="max-w-[10rem] truncate">{f.title?.trim() || `Form ${i + 1}`}</span>
                {isLive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={isSel ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                    LIVE
                  </span>
                )}
              </button>
            )
          })}
          {forms.length < MAX_QUESTIONNAIRES && (
            <button type="button" onClick={addForm}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted transition">
              <Plus className="w-4 h-4" />New form
            </button>
          )}
        </div>

        {/* Live / delete controls for the form being edited */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          {selected.id === activeId ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#22c55e' }}>
              <Check className="w-4 h-4" />Live on your {cardWord} now
            </span>
          ) : (
            <button type="button" onClick={() => makeLive(selected.id)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">
              <Radio className="w-3.5 h-3.5" />Make this form live
            </button>
          )}
          {forms.length > 1 && (
            <button type="button" onClick={() => deleteForm(selected.id)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" />Delete
            </button>
          )}
        </div>
      </div>

      {/* Title of the selected form */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Form title (optional)</label>
        <input value={selected.title || ''} onChange={e => setTitle(e.target.value)} maxLength={80}
          placeholder="e.g. A few quick questions"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
        <p className="text-xs text-muted-foreground mt-2">
          Visitors first fill in name, email, contact, and company, then your questions below, then a message box.
        </p>
      </div>

      {/* Questions of the selected form */}
      <div className="space-y-3">
        {selected.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <GripVertical className="w-4 h-4" />Question {i + 1}
              </span>
              <button onClick={() => removeQ(q.id)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <input value={q.label} onChange={e => updateQ(q.id, { label: e.target.value })} maxLength={120}
              placeholder="Your question"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring transition" />

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map(t => (
                <button key={t} onClick={() => updateQ(q.id, { type: t })}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                  style={q.type === t ? { background: grad, color: '#fff' } : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto cursor-pointer">
                <input type="checkbox" checked={q.required} onChange={e => updateQ(q.id, { required: e.target.checked })} />
                Required
              </label>
            </div>

            {q.type === 'dropdown' && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Options (one per line)</label>
                <textarea
                  value={(q.options || []).join('\n')}
                  onChange={e => updateQ(q.id, { options: e.target.value.split('\n') })}
                  rows={3}
                  placeholder={'Option one\nOption two\nOption three'}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={addQ} disabled={selected.questions.length >= MAX_QUESTIONS}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition disabled:opacity-50">
          <Plus className="w-4 h-4" />Add question
          <span className="text-xs text-muted-foreground">({selected.questions.length}/{MAX_QUESTIONS})</span>
        </button>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: grad }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save all
        </button>
      </div>
    </div>
  )
}
