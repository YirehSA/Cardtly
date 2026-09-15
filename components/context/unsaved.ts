'use client'

// A one-value store for "the Context editor has unsaved changes".
//
// WHY A MODULE VARIABLE RATHER THAN CONTEXT. The thing that needs to ask is
// the target switcher, which is rendered by the SERVER component above the
// editor. Putting both under a provider would mean making the page's layout
// client-rendered to carry one boolean, and the App Router gives no route
// change guard to hook instead. A module-level flag in a shared client bundle
// is the smallest thing that actually works.
//
// It is deliberately NOT reactive. Nothing re-renders when it changes; it is
// read once, at the moment somebody clicks a link, which is the only moment
// the answer matters.

let unsaved = false

export function setUnsavedContext(next: boolean) {
  unsaved = next
}

export function hasUnsavedContext(): boolean {
  return unsaved
}

export const LEAVE_WARNING = 'You have unsaved Context changes. Leave without saving?'
