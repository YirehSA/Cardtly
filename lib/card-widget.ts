// Wrapper around the Android-only CardWidget Capacitor plugin that
// feeds the home-screen QR widget. On web (and on app versions that
// predate the plugin) everything degrades to a silent no-op.

import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './capacitor'

interface CardWidgetPlugin {
  setCard(opts: { url: string; name: string }): Promise<{ success: boolean }>
  clearCard(): Promise<{ success: boolean }>
}

const Plugin = registerPlugin<CardWidgetPlugin>('CardWidget')

/**
 * Push the user's card to the native home-screen widget. Called from
 * the dashboard whenever it loads, so the widget tracks slug/name
 * changes automatically. Never throws - older app builds without the
 * plugin reject with "not implemented", which we swallow.
 */
export async function syncCardToWidget(url: string, name: string): Promise<void> {
  if (!isNativeApp()) return
  try {
    await Plugin.setCard({ url, name })
  } catch {
    // Plugin missing (old APK) or native failure - widget just
    // keeps its previous state. Never disrupt the dashboard.
  }
}

export async function clearCardWidget(): Promise<void> {
  if (!isNativeApp()) return
  try { await Plugin.clearCard() } catch { /* ignore */ }
}
