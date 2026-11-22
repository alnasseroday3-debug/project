'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [helpMessage, setHelpMessage] = useState<string | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true

    setIsInstalled(isStandalone)

    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      if (isAppleMobileDevice()) return
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
      setHelpMessage(null)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setHelpMessage(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      if (choice.outcome === 'accepted') setIsInstalled(true)
      return
    }

    const message = isAppleMobileDevice()
      ? 'على iPhone أو iPad: اضغط زر المشاركة في المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية».'
      : 'افتح قائمة المتصفح، ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'

    setHelpMessage(message)
  }

  if (isInstalled) return null

  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        className="min-h-11 cursor-pointer rounded-full"
        onClick={handleInstall}
        aria-expanded={Boolean(helpMessage)}
        aria-controls={helpMessage ? 'pwa-install-help' : undefined}
      >
        <Download data-icon="inline-start" aria-hidden="true" />
        تثبيت التطبيق على الهاتف
      </Button>
      {helpMessage && (
        <p
          id="pwa-install-help"
          className="max-w-sm rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {helpMessage}
        </p>
      )}
    </div>
  )
}
