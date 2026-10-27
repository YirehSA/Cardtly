'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Wifi, CheckCircle, AlertCircle, X, Loader2, SkipForward } from 'lucide-react'
import { detectNfcWriter, writeLinkToTag, type NfcSupport } from '@/lib/nfc-write'
import { cardTagUrl, NFC_BLOCK_TEXT } from '@/lib/nfc-tag'

// Writing Cardtly links onto blank NFC cards, one card or a whole team in a
// row, instead of the NFC Tools app (lib/nfc-tag says where it works).
//
// A batch goes one card at a time and waits for a tap on Next between cards,
// on purpose. Blank cards all look alike, so each one needs labelling the
// moment it is written, and a card left on the phone when the next write
// starts can be written again with the next person's link. The Next button is
// where both of those get said.
//
// Which cards were written is remembered on this phone only (localStorage),
// so a long batch can be stopped and picked up again. Nothing is stored on
// the server.

export interface NfcCardItem {
  id: string
  name: string
  title?: string | null
  slug: string
  /** Cards to write with this same link (an order of 3 for one person). */
  copies?: number
}

interface Item { key: string; card: NfcCardItem; label: string }

/** Which writer this phone has. null while it is being worked out. */
export function useNfcSupport(): NfcSupport | null {
  const [support, setSupport] = useState<NfcSupport | null>(null)
  useEffect(() => {
    let live = true
    detectNfcWriter().then(s => { if (live) setSupport(s) }).catch(() => { if (live) setSupport({ writer: null, block: 'no-nfc' }) })
    return () => { live = false }
  }, [])
  return support
}

const memoryName = (key: string) => `cardtly-nfc-written:${key}`
function recall(key: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(memoryName(key)) || '{}') || {} } catch { return {} }
}
function remember(key: string, written: Record<string, string>) {
  try { localStorage.setItem(memoryName(key), JSON.stringify(written)) } catch { /* still written, just not remembered */ }
}
const shortDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) } catch { return '' }
}

type Phase = 'pick' | 'wait' | 'done' | 'error' | 'finished'

export default function NfcWriteSession({ cards, memoryKey, heading, onClose }: {
  cards: NfcCardItem[]
  /** Where this batch's progress is remembered, e.g. `team:<id>`. */
  memoryKey: string
  heading: string
  onClose: () => void
}) {
  const support = useNfcSupport()
  const items: Item[] = useMemo(() => cards.filter(c => c.slug).flatMap(card => {
    const n = Math.max(1, Math.floor(card.copies || 1))
    return Array.from({ length: n }, (_, i) => ({
      key: n > 1 ? `${card.id}#${i + 1}` : card.id,
      card,
      label: n > 1 ? `${card.name} (${i + 1} of ${n})` : card.name,
    }))
  }), [cards])
  const single = items.length === 1

  const [written, setWritten] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('pick')
  const [queue, setQueue] = useState<string[]>([])
  const [pos, setPos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [nextReady, setNextReady] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const turn = useRef(0)

  useEffect(() => {
    const w = recall(memoryKey)
    setWritten(w)
    setSelected(new Set(items.filter(i => !w[i.key]).map(i => i.key)))
  }, [memoryKey, items])

  // Stop listening for a tag when the window closes.
  useEffect(() => () => { abort.current?.abort() }, [])

  const byKey = useMemo(() => new Map(items.map(i => [i.key, i])), [items])
  const current = byKey.get(queue[pos])
  const upNext = byKey.get(queue[pos + 1])

  function arm(q: string[], i: number) {
    const item = byKey.get(q[i])
    if (!item || !support?.writer) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    const mine = ++turn.current
    setError(null)
    setPhase('wait')
    writeLinkToTag(support.writer, cardTagUrl(item.card.slug), controller.signal).then(() => {
      if (mine !== turn.current) return
      setWritten(prev => {
        const next = { ...prev, [item.key]: new Date().toISOString() }
        remember(memoryKey, next)
        return next
      })
      try { navigator.vibrate?.(150) } catch { /* no buzz, no harm */ }
      setPhase('done')
      // A moment to lift the card off before Next can start the next write.
      setNextReady(false)
      setTimeout(() => { if (mine === turn.current) setNextReady(true) }, 1200)
    }).catch((e: any) => {
      if (mine !== turn.current || e?.name === 'AbortError') return
      setError(e?.message || 'The card could not be written. Try again.')
      setPhase('error')
    })
  }

  function start(keys: string[]) {
    const q = items.map(i => i.key).filter(k => keys.includes(k))
    if (!q.length) return
    setQueue(q)
    setPos(0)
    arm(q, 0)
  }

  function advance() {
    if (pos + 1 < queue.length) {
      setPos(pos + 1)
      arm(queue, pos + 1)
    } else {
      turn.current++
      abort.current?.abort()
      setPhase('finished')
    }
  }

  function stop() {
    turn.current++
    abort.current?.abort()
    setSelected(new Set(items.filter(i => !written[i.key]).map(i => i.key)))
    setPhase('pick')
  }

  function close() {
    turn.current++
    abort.current?.abort()
    onClose()
  }

  // One card: no list to pick from, start as soon as the phone is ready.
  const started = useRef(false)
  useEffect(() => {
    if (single && support?.writer && !started.current) {
      started.current = true
      start([items[0].key])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single, support])

  const writtenCount = items.filter(i => written[i.key]).length
  const muted = 'rgba(255,255,255,0.55)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={close}>
      <div className="rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative text-white"
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <Wifi className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--accent))' }} />
          <h3 className="font-semibold text-base flex-1 min-w-0 truncate">{heading}</h3>
          <button onClick={close} aria-label="Close"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          {!support ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: muted }} /></div>
          ) : !support.writer ? (
            <p className="text-sm py-4" style={{ color: muted }}>{NFC_BLOCK_TEXT[support.block]}</p>
          ) : phase === 'pick' ? (
            <PickList items={items} written={written} selected={selected} setSelected={setSelected}
              writtenCount={writtenCount} onStart={() => start([...selected])} muted={muted} />
          ) : phase === 'wait' && current ? (
            <div className="text-center py-4">
              {queue.length > 1 && <p className="text-xs mb-4" style={{ color: muted }}>Card {pos + 1} of {queue.length}</p>}
              <div className="relative w-24 h-24 flex items-center justify-center mx-auto mb-4">
                <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '0s' }} />
                <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '0.6s' }} />
                <span className="nfc-pulse-ring absolute inset-0 rounded-full" style={{ animationDelay: '1.2s' }} />
                <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--accent) / 0.16)' }}>
                  <Wifi className="w-8 h-8" style={{ color: 'hsl(var(--accent))' }} />
                </div>
              </div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: muted }}>Hold a blank card for</p>
              <p className="text-2xl font-bold mb-1 break-words">{current.label}</p>
              {current.card.title && <p className="text-sm mb-3" style={{ color: muted }}>{current.card.title}</p>}
              <p className="text-sm mb-1" style={{ color: muted }}>Against the back of the phone, near the camera. Hold it still until it buzzes.</p>
              <p className="text-[11px] font-mono break-all mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>{cardTagUrl(current.card.slug)}</p>
              <div className="flex gap-2 justify-center">
                {queue.length > 1 && (
                  <button onClick={advance} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition flex items-center gap-1.5"
                    style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                    <SkipForward className="w-4 h-4" />Skip
                  </button>
                )}
                <button onClick={queue.length > 1 ? stop : close} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition"
                  style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                  {queue.length > 1 ? 'Stop' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : phase === 'done' && current ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
              </div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#22c55e' }}>Written</p>
              <p className="text-2xl font-bold mb-3 break-words">{current.label}</p>
              <p className="text-sm mb-5" style={{ color: muted }}>
                {upNext
                  ? <>Take it off the phone and label it {current.card.name} now, before you pick up the next card.</>
                  : single ? <>Tap it on any phone to open the card.</> : <>That was the last one. Take it off the phone and label it.</>}
              </p>
              {upNext ? (
                <button onClick={advance} disabled={!nextReady}
                  className="w-full px-5 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'hsl(var(--accent))' }}>
                  Card is off the phone. Next: {upNext.label}
                </button>
              ) : (
                <button onClick={single ? close : advance}
                  className="w-full px-5 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90" style={{ background: 'hsl(var(--accent))' }}>
                  Done
                </button>
              )}
              {upNext && (
                <button onClick={stop} className="mt-2 text-xs px-3 py-2 rounded-lg hover:bg-white/10 transition" style={{ color: muted }}>
                  Stop here. The rest can be written later.
                </button>
              )}
            </div>
          ) : phase === 'error' && current ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <AlertCircle className="w-8 h-8" style={{ color: '#ef4444' }} />
              </div>
              <p className="text-lg font-bold mb-1 break-words">{current.label} was not written</p>
              <p className="text-sm mb-5" style={{ color: muted }}>{error}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={() => arm(queue, pos)} className="px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:opacity-90" style={{ background: 'hsl(var(--accent))' }}>
                  Try again
                </button>
                {queue.length > 1 && (
                  <button onClick={advance} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                    Skip
                  </button>
                )}
                <button onClick={queue.length > 1 ? stop : close} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                  {queue.length > 1 ? 'Stop' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
              </div>
              <p className="text-lg font-bold mb-1">{writtenCount} of {items.length} written</p>
              <p className="text-sm mb-5" style={{ color: muted }}>
                {writtenCount < items.length ? 'The ones not written yet are ticked when you open this again.' : 'Every card is written. Tap one on any phone to check it.'}
              </p>
              <div className="flex gap-2 justify-center">
                {writtenCount < items.length && (
                  <button onClick={stop} className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                    Back to the list
                  </button>
                )}
                <button onClick={close} className="px-5 py-2.5 rounded-xl font-semibold text-sm transition hover:opacity-90" style={{ background: 'hsl(var(--accent))' }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PickList({ items, written, selected, setSelected, writtenCount, onStart, muted }: {
  items: Item[]
  written: Record<string, string>
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  writtenCount: number
  onStart: () => void
  muted: string
}) {
  if (!items.length) return <p className="text-sm py-4" style={{ color: muted }}>There are no cards with a link to write yet.</p>
  const toggle = (k: string) => {
    const next = new Set(selected)
    if (next.has(k)) next.delete(k); else next.add(k)
    setSelected(next)
  }
  return (
    <div>
      <p className="text-sm mb-3" style={{ color: muted }}>
        Each card gets that person's link. Have the blank cards and a pen or labels ready: they all look the same once written.
        {writtenCount > 0 && <> {writtenCount} of {items.length} already written on this phone.</>}
      </p>
      <div className="flex gap-3 text-xs mb-2">
        <button onClick={() => setSelected(new Set(items.filter(i => !written[i.key]).map(i => i.key)))} className="underline" style={{ color: muted }}>Not written yet</button>
        <button onClick={() => setSelected(new Set(items.map(i => i.key)))} className="underline" style={{ color: muted }}>All</button>
        <button onClick={() => setSelected(new Set())} className="underline" style={{ color: muted }}>None</button>
      </div>
      <div className="space-y-1 mb-4 max-h-[46vh] overflow-y-auto">
        {items.map(i => (
          <label key={i.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <input type="checkbox" checked={selected.has(i.key)} onChange={() => toggle(i.key)} className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{i.label}</span>
              {i.card.title && <span className="block text-[11px] truncate" style={{ color: muted }}>{i.card.title}</span>}
            </span>
            {written[i.key] && (
              <span className="text-[10px] px-2 py-0.5 rounded-md shrink-0" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                Written {shortDate(written[i.key])}
              </span>
            )}
          </label>
        ))}
      </div>
      <button onClick={onStart} disabled={selected.size === 0}
        className="w-full px-5 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90 disabled:opacity-40" style={{ background: 'hsl(var(--accent))' }}>
        Write {selected.size} card{selected.size === 1 ? '' : 's'}
      </button>
    </div>
  )
}
