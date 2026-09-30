import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { AccountResponse } from '../types.ts'

export interface SessionMonitorCallbacks {
  onSessionExpired?: () => void
  onDisallowedDepartment?: (payload: { message?: string; title?: string }) => void
}

let isChecking = false
let lastCheckTime = 0
let monitorStarted = false
let intervalTimer: any = null

/**
 * Actively query /api/ezai-auth/account:
 * - If 200: sync latest account & token usage, notify listeners
 * - If 401: session expired / invalid cookies -> trigger onSessionExpired callback, broadcast logout
 * - If 403: disallowed department / not whitelisted -> trigger onDisallowedDepartment callback, broadcast logout
 */
export async function checkSessionStatus(
  ctx?: ClientContext,
  force = false,
  callbacks?: SessionMonitorCallbacks,
): Promise<AccountResponse | null> {
  if (isChecking && !force) return null
  isChecking = true

  try {
    const res = await fetch('/api/ezai-auth/account', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })

    if (res.status === 200) {
      const payload = (await res.json()) as AccountResponse
      lastCheckTime = Date.now()
      if (typeof window !== 'undefined') {
        ;(window as any).__EZAI_ACCOUNT__ = payload
        ;(window as any).__EZAI_LOGGED_IN__ = true
        window.dispatchEvent(new CustomEvent('ezai-auth:account-updated', { detail: payload }))
      }
      return payload
    }

    // 401: Expired or unauthenticated
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        delete (window as any).__EZAI_ACCOUNT__
        ;(window as any).__EZAI_LOGGED_IN__ = false
        window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
      }
      callbacks?.onSessionExpired?.()
      return null
    }

    // 403: Department or whitelist restriction
    if (res.status === 403) {
      const payload = (await res.json().catch(() => ({}))) as any
      if (typeof window !== 'undefined') {
        delete (window as any).__EZAI_ACCOUNT__
        ;(window as any).__EZAI_LOGGED_IN__ = false
        window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
      }
      if (payload.departmentDisallowed) {
        callbacks?.onDisallowedDepartment?.(payload)
      } else {
        callbacks?.onSessionExpired?.()
      }
      return null
    }

    return null
  } catch {
    // Keep current session on transient offline network failure
    return null
  } finally {
    isChecking = false
  }
}

/**
 * Start periodic polling and visibility-change checking to prevent
 * expired accounts from staying active indefinitely.
 */
export function startSessionMonitor(
  ctx: ClientContext,
  callbacks: SessionMonitorCallbacks,
  intervalMs = 60_000,
): void {
  if (typeof window === 'undefined' || monitorStarted) return
  monitorStarted = true

  // 1. Periodic background timer (default: every 60s)
  intervalTimer = setInterval(() => {
    void checkSessionStatus(ctx, false, callbacks)
  }, intervalMs)

  // 2. Trigger check whenever window/tab becomes visible again (e.g. computer wakes from sleep or user switches back)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const elapsed = Date.now() - lastCheckTime
      if (elapsed > 30_000) {
        void checkSessionStatus(ctx, true, callbacks)
      }
    }
  }

  const onWindowFocus = () => {
    const elapsed = Date.now() - lastCheckTime
    if (elapsed > 30_000) {
      void checkSessionStatus(ctx, true, callbacks)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onWindowFocus)

  // Clean up if unloaded
  window.addEventListener(
    'beforeunload',
    () => {
      if (intervalTimer) clearInterval(intervalTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
    },
    { once: true },
  )
}
