'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DARK_CLASS,
  DEFAULT_PREFERENCE,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

/**
 * ThemeProvider — owns the light/dark preference.
 *
 * The <html> class is already correct before React mounts (see THEME_INIT_SCRIPT),
 * so this provider's job is to keep state in sync afterwards: persist the choice,
 * follow the OS while the preference is `system`, and mirror changes made in
 * another tab.
 */

interface ThemeContextValue {
  /** What the user picked, including `system`. */
  preference: ThemePreference
  /** What is currently painted. */
  theme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  /** Flips to the opposite of what is currently painted. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

/** Reads the stored preference. Safe when storage is blocked. */
function storedPreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCE
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : DEFAULT_PREFERENCE
  } catch {
    return DEFAULT_PREFERENCE
  }
}

function paint(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle(DARK_CLASS, theme === 'dark')
  // Tells the browser which palette to use for scrollbars, form controls, and
  // the address bar. Without it, native UI stays light inside a dark page.
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialised from storage on the client so the first render already matches
  // what the inline script painted; the server always renders DEFAULT_PREFERENCE.
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference)
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(storedPreference()))

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    const resolved = resolve(next)
    setTheme(resolved)
    paint(resolved)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode). The choice still applies this session.
    }
  }, [])

  const toggle = useCallback(() => {
    // Resolve against what is painted, so the first click on `system` does the
    // visually obvious thing instead of appearing to do nothing.
    setPreference(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setPreference])

  // Follow the OS while the preference is `system`.
  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia(MEDIA_QUERY)
    const onChange = () => {
      const resolved: ResolvedTheme = media.matches ? 'dark' : 'light'
      setTheme(resolved)
      paint(resolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  // Mirror the choice across tabs.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return
      const next = isThemePreference(event.newValue) ? event.newValue : DEFAULT_PREFERENCE
      setPreferenceState(next)
      const resolved = resolve(next)
      setTheme(resolved)
      paint(resolved)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
