'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Loader2, Save, Check, Radio, Copy, ClipboardList, ChevronRight, AlertTriangle } from 'lucide-react'
import { MAX_QUESTIONS, MAX_QUESTIONNAIRES, safeHex, contrastRatio, type Question, type QuestionType, type SavedQuestionnaire } from '@/lib/questionnaire'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// A colour swatch plus its hex, kept in step. The native picker alone gives no
// way to paste a brand colour, and a text box alone gives no way to browse.
//
// The unset state has to be unmistakable. The first version used the fallback
// hex as the input's placeholder and as the swatch colour, so an empty field
// showed "#7c3aed" next to a confident purple square - identical to a field
// holding #7c3aed. It read as configured when nothing was stored, and the
// preview beside it, correctly showing the unstyled button, looked like the
// broken part.
//
// Now: unset is a dashed, faded swatch and the word "auto", and there is an
// explicit button to apply the suggestion. Nothing about it can be mistaken
// for a colour that has been chosen.
function ColourField({ label, value, fallback, onChange }: {
  label: string
  value: string
  fallback: string
  onChange: (v: string) => void
}) {
  const set = !!safeHex(value)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-12">{label}</span>
      <input type="color" value={safeHex(value) || fallback}
        onChange={e => onChange(e.target.value)}
        aria-label={`${label} colour`}
        title={set ? value : `Not set. Pick a colour to use one.`}
        className="w-9 h-9 rounded-lg bg-transparent cursor-pointer p-0.5"
        style={{
          border: set ? '1px solid hsl(var(--border))' : '1px dashed hsl(var(--muted-foreground))',
          opacity: set ? 1 : 0.35,
        }} />
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder="auto" maxLength={7} spellCheck={false}
        aria-label={`${label} colour hex`}
        className="w-20 px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring transition" />
      {!set && (
        <button type="button" onClick={() => onChange(fallback)}
          className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title={`Use ${fallback}`}>
          Use {fallback}
        </button>
      )}
    </div>
  )
}

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
  // Forms already built on the user's other cards, so a team form can be
  // reused on a personal card without retyping it. Copied in, not linked -
  // see the page for why.
  importable?: { label: string; forms: SavedQuestionnaire[] }[]
}

export default function QuestionnaireBuilder({ initial, teamWide, target, importable = [] }: Props) {
  const [importOpen, setImportOpen] = useState(false)
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

  // Warn before a button ships that nobody can read. A colour picker with no
  // contrast check is a way to make the label invisible against its own
  // background and see nothing wrong until it is on a customer's card.
  const btnStyled = !!(selected.buttonBg || selected.buttonBorder)

  const contrastWarning = (() => {
    const bgHex = safeHex(selected.buttonBg)
    if (!bgHex) return null
    const ratio = contrastRatio(bgHex, safeHex(selected.buttonText) || '#ffffff')
    if (ratio === null) return null
    if (ratio >= 4.5) return null
    if (ratio >= 3) return `Contrast is ${ratio.toFixed(1)}:1. Readable at this size, but tight. 4.5:1 is comfortable.`
    return `Contrast is only ${ratio.toFixed(1)}:1. People will struggle to read this button. Try a darker button or lighter text.`
  })()

  // --- Form-level edits ---
  function addForm() {
    if (forms.length >= MAX_QUESTIONNAIRES) return
    const f = blankForm()
    setForms(fs => [...fs, f])
    setSelectedId(f.id)
  }
  // Copy a form off another card into this one. A fresh id, so it is a
  // genuinely separate form here and saving cannot overwrite the original.
  function importForm(form: SavedQuestionnaire, from: string) {
    if (forms.length >= MAX_QUESTIONNAIRES) return
    const copy: SavedQuestionnaire = {
      id: `form_${Date.now().toString(36)}`,
      title: form.title?.trim() || `From ${from}`,
      questions: form.questions.map(q => ({ ...q })),
    }
    setForms(fs => [...fs, copy])
    setSelectedId(copy.id)
    setImportOpen(false)
    toast.success(`Copied in from ${from}. Save to keep it.`)
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
          {forms.length < MAX_QUESTIONNAIRES && importable.length > 0 && (
            <button type="button" onClick={() => setImportOpen(o => !o)}
              aria-expanded={importOpen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted transition">
              <Copy className="w-4 h-4" />Copy from another card
            </button>
          )}
        </div>

        {importOpen && (
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground mb-2">
              Copies the questions across. The two stay separate afterwards, so
              editing one does not change the other.
            </p>
            <div className="space-y-3">
              {importable.map(src => (
                <div key={src.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {src.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {src.forms.map((f, i) => (
                      <button key={f.id} type="button" onClick={() => importForm(f, src.label)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition min-h-[44px]">
                        <span className="max-w-[11rem] truncate">{f.title?.trim() || `Form ${i + 1}`}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {f.questions.length} {f.questions.length === 1 ? 'question' : 'questions'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* The button that opens this form on the public card. It used to be a
            faint wash of the card's accent colour and was easy to miss, which
            is a problem for the one control on the card whose whole job is to
            be pressed. */}
        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">The button on your card</p>

          <div className="flex flex-wrap items-center gap-4">
            <ColourField label="Button" value={selected.buttonBg || ''} fallback="#7c3aed"
              onChange={v => patchSelected(f => ({ ...f, buttonBg: v || undefined }))} />
            <ColourField label="Text" value={selected.buttonText || ''} fallback="#ffffff"
              onChange={v => patchSelected(f => ({ ...f, buttonText: v || undefined }))} />
            <ColourField label="Border" value={selected.buttonBorder || ''} fallback="#00d4ff"
              onChange={v => patchSelected(f => ({ ...f, buttonBorder: v || undefined }))} />
            {(selected.buttonBg || selected.buttonBorder) && (
              <button type="button"
                onClick={() => patchSelected(f => ({ ...f, buttonBg: undefined, buttonText: undefined, buttonBorder: undefined }))}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition">
                Back to the card&apos;s colours
              </button>
            )}
          </div>

          {/* Shown as it will look, because a hex code beside a colour swatch
              still does not tell you whether the label will be readable. */}
          <div className="mt-3.5 rounded-xl p-3" style={{ background: 'rgba(120,120,120,0.10)' }}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Preview {btnStyled
                ? '- your colours'
                : '- no colours set, so it follows the card'}
            </p>
            {/* Mirrors QuestionnaireForm's button exactly. Two renderings of
                one look is how they drift, but a preview that lives in a modal
                on a public page cannot be imported here - so if you change one,
                change both. */}
            <div className="w-full py-3 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3"
              style={btnStyled
                ? {
                    background: selected.buttonBg || 'transparent',
                    border: selected.buttonBorder
                      ? `2px solid ${selected.buttonBorder}`
                      : (selected.buttonBg ? `1px solid ${selected.buttonBg}` : 'none'),
                    color: selected.buttonText || '#ffffff',
                  }
                : { background: 'rgba(124,58,237,0.13)', border: '1px solid rgba(124,58,237,0.35)' }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: selected.buttonBg ? 'rgba(255,255,255,0.18)' : (selected.buttonBorder ? selected.buttonBorder + '2e' : 'rgba(124,58,237,0.18)') }}>
                  <ClipboardList className="w-4 h-4" style={{ color: btnStyled ? (selected.buttonText || '#fff') : '#7c3aed' }} />
                </span>
                <span className="truncate">{selected.title?.trim() || 'Answer a few questions'}</span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0"
                style={{ color: btnStyled ? (selected.buttonText || '#fff') : '#7c3aed' }} />
            </div>
          </div>

          {contrastWarning && (
            <p className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: '#f59e0b' }}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {contrastWarning}
            </p>
          )}
        </div>
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
