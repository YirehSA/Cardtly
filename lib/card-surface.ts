'use client'

import { createContext, createElement, useContext, type ReactNode } from 'react'

// WHICH SURFACE IS THIS CARD BEING RENDERED ON.
//
// PublicCardView renders the real card in two very different places:
//
//   public    a visitor has opened /card/<slug> or a team card page
//   preview   the OWNER is looking at their own card inside the dashboard,
//             the template picker, or the marketing template grid
//
// Everything about the markup is deliberately identical, which is the whole
// point of CardPreview: a preview that is a separate hand-written miniature
// drifts, and ours did. But the SIDE EFFECTS must not be identical. A visitor
// tapping a link is data the owner paid for. The owner scrolling their own
// editor is not, and recording it would quietly corrupt the very analytics
// the feature exists to provide.
//
// WHY A CONTEXT RATHER THAN A PROP. There are nine places inside the card tree
// that write something: five analytics events, two contact forms, the
// questionnaire and a booking request. Three of them live inside modals that
// portal to document.body. Threading a boolean through every one of those,
// and through every future one, is a guarantee that somebody eventually
// forgets. React context reaches the whole subtree including portals, because
// it follows the React tree rather than the DOM, so a component added under
// the card next year inherits the guard without anybody remembering to wire
// it.
//
// THE DEFAULT IS `public`. Every existing call site that renders
// PublicCardView directly gets exactly the behaviour it had before this file
// existed. Only CardPreview opts into `preview`.
//
// This is NOT a security boundary and must never be used as one. It runs in
// the browser, so a determined visitor could set it. It is a correctness
// boundary: it stops Cardtly's own dashboard from polluting Cardtly's own
// analytics. Everything that actually matters is still enforced server side,
// where /api/analytics and /api/contact validate ownership and shape.

export const CARD_SURFACES = ['public', 'preview'] as const
export type CardSurface = (typeof CARD_SURFACES)[number]

const SurfaceContext = createContext<CardSurface>('public')

/** Wrap a card that is being shown to its own owner rather than to a visitor. */
export function CardSurfaceProvider({ surface, children }: { surface: CardSurface; children: ReactNode }) {
  return createElement(SurfaceContext.Provider, { value: surface }, children)
}

export function useCardSurface(): CardSurface {
  return useContext(SurfaceContext)
}

/** The question every write site actually asks. */
export function useIsPreview(): boolean {
  return useContext(SurfaceContext) === 'preview'
}

/** What a form says when the owner tries to submit it from a preview. Shared
 *  so the four forms cannot drift into four different explanations of the
 *  same thing. */
export const PREVIEW_SUBMIT_NOTICE = 'This is a preview of your own card. Nothing is sent.'
