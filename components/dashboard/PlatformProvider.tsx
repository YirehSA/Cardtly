'use client'

import { createContext, useContext } from 'react'

// Whether this page is being rendered inside the iOS app, decided on the SERVER
// and handed down.
//
// Capacitor can answer the same question in the browser, but only after the
// page has loaded - so a purchase button would be in the HTML, would flash
// before hydration, and would sit in the page source for anyone who looked.
// App Review is exactly the kind of somebody who looks. Reading it from the
// request instead means the markup is never produced.
//
// The dashboard layout is already dynamic because it is behind auth, so the
// header read costs nothing extra there.

const IosAppContext = createContext(false)

export function PlatformProvider({ iosApp, children }: { iosApp: boolean; children: React.ReactNode }) {
  return <IosAppContext.Provider value={iosApp}>{children}</IosAppContext.Provider>
}

/** True inside the iOS app. Anything that sells, names a price, or unlocks a
 *  subscription outside the App Store must not render when this is true. */
export function useIosApp(): boolean {
  return useContext(IosAppContext)
}
