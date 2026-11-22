'use client'

import { useEffect } from 'react'
import { themePreferenceStorageKey } from '@/lib/user-preferences'

export function ThemePreferenceInitializer() {
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(themePreferenceStorageKey)
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.dataset.theme = savedTheme
      }
    } catch {
      document.documentElement.dataset.theme = 'dark'
    }
  }, [])

  return null
}
