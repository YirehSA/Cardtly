'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('cardtly-theme') as Theme | null
    const preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(preferred)
    document.documentElement.classList.toggle('dark', preferred === 'dark')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    // Add a transient transition class so background, border, and text
    // colors fade smoothly during the swap, then remove it so per-
    // element transitions can resume normal timing.
    document.documentElement.classList.add('theme-transition')
    setTheme(next)
    localStorage.setItem('cardtly-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 600)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
