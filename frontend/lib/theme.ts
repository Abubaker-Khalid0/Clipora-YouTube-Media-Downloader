/**
 * theme.ts — shared contract for the light/dark theme.
 *
 * Kept dependency-free and framework-agnostic so the same constants can be used
 * by the React provider, the toggle button, and the blocking inline script that
 * runs before first paint.
 */

/** What the user chose. `system` follows the OS setting and keeps following it. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** What is actually painted. `system` is always resolved to one of these. */
export type ResolvedTheme = 'light' | 'dark'

/** localStorage key. Changing this resets everyone to `system`. */
export const THEME_STORAGE_KEY = 'clipora-theme'

/** Class placed on <html>. Matches `@custom-variant dark (&:is(.dark *))`. */
export const DARK_CLASS = 'dark'

/** The landing page reads as dark unless the visitor says otherwise. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Inline script injected into <head> before any markup renders.
 *
 * Without this, the server always emits the default theme and the browser
 * repaints once React hydrates — a white flash for dark-mode visitors. Reading
 * localStorage synchronously here is the standard fix; it must stay small and
 * must never throw (private browsing can make localStorage access fail).
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var p=localStorage.getItem(k);
if(p!=='light'&&p!=='dark'&&p!=='system')p=${JSON.stringify(DEFAULT_PREFERENCE)};
var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var e=document.documentElement;
e.classList.toggle(${JSON.stringify(DARK_CLASS)},d);
e.style.colorScheme=d?'dark':'light';
}catch(_){}})();`
