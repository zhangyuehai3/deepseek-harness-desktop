/** dsh-ezai-auth — client face: registers the EZAI account tab in Settings → Plugins. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { EzaiAccountTab } from './EzaiAccountTab.tsx'
import { showEzaiLoginModal } from './EzaiLoginModal.tsx'
import { en, NS, zh } from './locales.ts'

import { injectCss } from './styles.ts'

export const inject = ['slots', 'locale']

function getActiveLocale(ctx: ClientContext): 'zh' | 'en' {
  const snapshot = (ctx.locale as any).getSnapshot?.()
  const active = typeof snapshot?.active === 'string' ? snapshot.active : 'en'
  return active === 'zh' ? 'zh' : 'en'
}

export function apply(ctx: ClientContext): void {
  injectCss()

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ezai-auth: dictionaries')

  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'ezai-account',
      order: 110,
      label: () => {
        const t = ctx.locale.bind(NS)
        return t('tabTitle')
      },
      locale: NS,
      inject: () => ({}),
    }, EzaiAccountTab)
  )

  // On startup, force a login modal if the user has no active EZAI session.
  void (async () => {
    try {
      const response = await fetch('/api/ezai-auth/account', { headers: { accept: 'application/json' } })
      if (response.status === 401) {
        showEzaiLoginModal(getActiveLocale(ctx))
      }
    } catch {
      // Ignore transient network errors on startup; the settings tab can still
      // be opened manually to log in.
    }
  })()
}
