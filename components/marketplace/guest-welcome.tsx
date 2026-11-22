'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'

export function GuestWelcome({ isAuthenticated }: { isAuthenticated: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const isAuthRoute = pathname === '/sign-in' || pathname === '/sign-up'
  const shouldShow = isOpen && !isAuthenticated && !isAuthRoute

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (shouldShow && !dialog.open) dialog.showModal()
    if (!shouldShow && dialog.open) dialog.close()
  }, [shouldShow])

  useEffect(() => {
    setIsOpen(!isAuthenticated && !isAuthRoute)
  }, [isAuthenticated, isAuthRoute])

  function dismiss() {
    setIsOpen(false)
  }

  return (
    <dialog
      ref={dialogRef}
      className="guest-welcome-dialog"
      aria-label="مرحباً بك في مَسار"
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
    >
      <AuthForm
        mode="sign-in"
        redirectTo={pathname || '/'}
        variant="welcome"
        onAuthSuccess={dismiss}
        onGuestBrowse={dismiss}
      />
    </dialog>
  )
}
