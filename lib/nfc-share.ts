// Wrapper around the Android-only NfcShare Capacitor plugin (HCE).
// On web this all degrades to no-ops + { supported: false }.

import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './capacitor'

export interface NfcShareCapabilities {
  supported: boolean
  enabled: boolean
}

interface NfcSharePlugin {
  startBroadcast(opts: { url: string }): Promise<{ success: boolean }>
  stopBroadcast(): Promise<{ success: boolean }>
  isSupported(): Promise<NfcShareCapabilities>
}

const Plugin = registerPlugin<NfcSharePlugin>('NfcShare')

/**
 * Arm phone-to-phone NFC sharing with the given URL. Returns a
 * discriminated result so the UI can show specific guidance for each
 * failure mode (no hardware vs. NFC turned off).
 */
export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'web' | 'nfc_not_supported' | 'nfc_disabled' | 'unknown' }

export async function startTapToShare(url: string): Promise<StartResult> {
  if (!isNativeApp()) return { ok: false, reason: 'web' }
  try {
    const r = await Plugin.startBroadcast({ url })
    return r.success ? { ok: true } : { ok: false, reason: 'unknown' }
  } catch (e: any) {
    const reason: StartResult extends { reason: infer R } ? R : never =
      e?.message === 'nfc_not_supported' ? 'nfc_not_supported'
      : e?.message === 'nfc_disabled' ? 'nfc_disabled'
      : 'unknown'
    return { ok: false, reason }
  }
}

export async function stopTapToShare(): Promise<void> {
  if (!isNativeApp()) return
  try { await Plugin.stopBroadcast() } catch { /* ignore */ }
}

export async function checkNfcSupport(): Promise<NfcShareCapabilities> {
  if (!isNativeApp()) return { supported: false, enabled: false }
  try { return await Plugin.isSupported() } catch { return { supported: false, enabled: false } }
}
