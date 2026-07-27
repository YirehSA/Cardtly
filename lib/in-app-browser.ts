// Detecting the in-app browsers that cannot download a file.
//
// A card shared in WhatsApp opens in WhatsApp's own WebView, which has no
// download manager: tapping Save Contact navigates to the .vcf and nothing
// happens at all. Verified against the real thing - the same card and the same
// file save perfectly in Chrome. Instagram, Facebook and Messenger behave the
// same way.
//
// This is the most common way a card gets shared, so a silent no-op here is a
// lost contact every time. We cannot fix their WebView; we can notice we are
// inside one and offer a way out.

export type InAppBrowser = 'WhatsApp' | 'Instagram' | 'Facebook' | 'Messenger' | 'LinkedIn' | 'TikTok' | null

export function detectInAppBrowser(ua?: string): InAppBrowser {
  const s = (ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')) || ''
  if (/WhatsApp/i.test(s)) return 'WhatsApp'
  if (/Instagram/i.test(s)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return 'Facebook'
  if (/Messenger/i.test(s)) return 'Messenger'
  if (/LinkedInApp/i.test(s)) return 'LinkedIn'
  if (/BytedanceWebview|TikTok/i.test(s)) return 'TikTok'
  return null
}

export function isInAppBrowser(ua?: string): boolean {
  return detectInAppBrowser(ua) !== null
}

export function isAndroid(ua?: string): boolean {
  const s = (ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')) || ''
  return /Android/i.test(s)
}

/**
 * An Android intent URL that hands a page to Chrome. This is the one reliable
 * way out of an in-app WebView: it leaves the host app entirely, and a download
 * then works like any other.
 *
 * Point it at the .vcf itself and the whole thing is one tap: Chrome opens and
 * the contact file downloads, with no second trip through the card.
 *
 * browser_fallback_url matters. Without it, a phone with no Chrome installed
 * follows an intent nothing can handle and the tap silently does nothing - the
 * exact failure this is here to remove. With it, the WebView falls back to the
 * plain URL instead.
 *
 * Android only. iOS gives a web page no way to launch Safari, so there the user
 * has to use the host app's own "open in browser" menu item.
 */
export function chromeIntentUrl(httpsUrl: string): string {
  const withoutScheme = httpsUrl.replace(/^https?:\/\//, '')
  const fallback = encodeURIComponent(httpsUrl)
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`
}
