'use client'

import { useEffect } from 'react'

// Brings the hero to life. Renders nothing.
//
// The scene arrives as two files in /public rather than inside the page: an
// 838KB bundle with three.js in it and 524KB of textures. Inline, that is a
// megabyte the browser has to receive and parse before it can finish the
// document, on every visit, uncached. As files they are fetched in parallel
// with the rest of the page, served gzipped, and cached after the first view,
// and the poster still paints the hero while they are on their way.
//
// This is the only part that has to be a client component. The markup and the
// stylesheet are static, so they stay on the server and out of the JS bundle.

declare global {
  interface Window {
    __CT_TEX?: Record<string, string>
    __hero?: { renderer?: { dispose?: () => void; forceContextLoss?: () => void } }
  }
}

export default function HeroSceneLoader() {
  useEffect(() => {
    let cancelled = false
    let script: HTMLScriptElement | null = null

    // A poster that fails to load must not sit as a broken image over the
    // canvas. Handled here rather than with an onError prop, so the markup can
    // stay a server component.
    const poster = document.getElementById('hero-poster')
    const dropPoster = () => poster?.remove()
    poster?.addEventListener('error', dropPoster)

    // Order matters twice over. The bundle is an IIFE: it reads
    // window.__CT_TEX the moment it evaluates and queries #hero-gl on the line
    // after, so the textures must be assigned before the tag is added and the
    // markup must already be mounted. Both hold inside an effect; neither
    // would if the script were in the document.
    fetch('/hero/textures.json')
      .then(r => {
        if (!r.ok) throw new Error(`textures ${r.status}`)
        return r.json()
      })
      .then((tex: Record<string, string>) => {
        // React runs effects twice in development. The injection sits behind
        // this flag rather than the fetch, so the first pass is cancelled
        // before it can build a second scene on top of the first.
        if (cancelled) return
        window.__CT_TEX = tex
        script = document.createElement('script')
        script.src = '/hero/scene.js'
        script.async = true
        document.body.appendChild(script)
      })
      .catch(() => {
        // No scene. The poster stays where it is and the hero is a still
        // picture with working copy and buttons over it, which is a worse
        // hero rather than a broken page.
      })

    return () => {
      cancelled = true
      poster?.removeEventListener('error', dropPoster)

      // The bundle publishes its renderer, and that is the only handle anyone
      // has on the GPU context it created. Leaving the home page without this
      // leaves a live context and its buffers behind for the rest of the
      // session; browsers keep about sixteen and silently kill the oldest when
      // a seventeenth is asked for, which is how an unrelated page ends up
      // with a dead canvas on it.
      try {
        window.__hero?.renderer?.dispose?.()
        window.__hero?.renderer?.forceContextLoss?.()
      } catch { /* the scene never finished building */ }

      delete window.__hero
      delete window.__CT_TEX
      script?.remove()
    }
  }, [])

  return null
}
