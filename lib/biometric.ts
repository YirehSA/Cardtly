'use client'

// Biometric login helpers wrapping capacitor-native-biometric.
//
// We store the Supabase refresh_token in the device's native secure
// store (Android Keystore / iOS Keychain) keyed by the user's email.
// On next app launch, prompting biometric unlocks the refresh token,
// which we hand back to Supabase to mint a fresh session - no email
// or password is kept in the app.
//
// On the web (cardtly.com in a regular browser), every helper here
// short-circuits to a safe no-op so the same auth code paths work in
// both environments.

import { isNativeApp } from './capacitor'

const SERVER_KEY = 'cardtly.com'
const ENABLED_FLAG = 'cardtly:biometric-enabled'

interface BiometricStatus {
  available: boolean
  // Friendly label for UI prompts, e.g. "fingerprint" or "face".
  label: string
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (!isNativeApp()) return { available: false, label: '' }
  try {
    const { NativeBiometric, BiometryType } = await import('capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable({ useFallback: false })
    if (!result.isAvailable) return { available: false, label: '' }
    let label = 'biometric'
    switch (result.biometryType) {
      case BiometryType.FINGERPRINT:
      case BiometryType.TOUCH_ID:
        label = 'fingerprint'
        break
      case BiometryType.FACE_ID:
      case BiometryType.FACE_AUTHENTICATION:
        label = 'face'
        break
      case BiometryType.IRIS_AUTHENTICATION:
        label = 'iris'
        break
    }
    return { available: true, label }
  } catch {
    return { available: false, label: '' }
  }
}

export function hasBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(ENABLED_FLAG) === 'true'
  } catch {
    return false
  }
}

export async function enableBiometric(email: string, refreshToken: string): Promise<void> {
  if (!isNativeApp()) return
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.setCredentials({
    username: email,
    password: refreshToken,
    server: SERVER_KEY,
  })
  localStorage.setItem(ENABLED_FLAG, 'true')
}

export async function disableBiometric(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ENABLED_FLAG)
  }
  if (!isNativeApp()) return
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER_KEY })
  } catch {
    // Already cleared or never set
  }
}

interface BiometricSignInResult {
  ok: boolean
  email?: string
  refreshToken?: string
  reason?: string
}

/**
 * Prompts biometric, then returns the stored credentials so the caller
 * can hand them to supabase.auth.refreshSession(). Returns { ok: false }
 * if biometric fails, is cancelled, or no credentials are stored.
 */
export async function signInWithBiometric(): Promise<BiometricSignInResult> {
  if (!isNativeApp() || !hasBiometricEnabled()) {
    return { ok: false, reason: 'not-enabled' }
  }
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to Cardtly',
      title: 'Cardtly',
      subtitle: 'Verify it is you',
      description: '',
      negativeButtonText: 'Cancel',
      maxAttempts: 3,
    })
    const creds = await NativeBiometric.getCredentials({ server: SERVER_KEY })
    return { ok: true, email: creds.username, refreshToken: creds.password }
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'biometric-failed'
    return { ok: false, reason }
  }
}
