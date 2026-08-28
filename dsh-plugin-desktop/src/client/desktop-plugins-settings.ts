/** Register a Desktop-owned Plugins section that renders upstream plugin tabs. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
// Pull in the settings.plugins.tab slot declaration and locale namespace.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DesktopPluginsSettingsSection,
  type DesktopPluginsTabEntry,
} from './DesktopPluginsSettingsSection.tsx'

/** Build a locale-following observable over the plugins.tab ledger. */
function createPluginsTabsObservable(ctx: ClientContext): HostObservable<readonly DesktopPluginsTabEntry[]> {
  let version = -1
  let revision = -1
  let tabs: readonly DesktopPluginsTabEntry[] = []
  return {
    getSnapshot: () => {
      const currentVersion = ctx.slots.getVersion('settings.plugins.tab')
      const currentRevision = ctx.locale.getSnapshot().revision
      if (currentVersion !== version || currentRevision !== revision) {
        version = currentVersion
        revision = currentRevision
        tabs = ctx.slots.entries('settings.plugins.tab')
          .map((entry) => {
            const ns = entry.locale ?? 'settings.plugins'
            const translate = ctx.locale.bind(ns)
            const labelKey = resolveSlotLabel(entry.options.label) ?? ''
            return {
              id: entry.options.id ?? '',
              order: entry.options.order ?? 0,
              label: translate(labelKey),
            }
          })
          .sort((a, b) => a.order - b.order)
      }
      return tabs
    },
    subscribe: (listener) => {
      const offLedger = ctx.slots.subscribe('settings.plugins.tab', listener)
      const offLocale = ctx.locale.subscribe(listener)
      return () => {
        offLedger()
        offLocale()
      }
    },
  }
}

/** Add the original upstream Plugins entry to the Settings nav. */
export function applyDesktopPluginsSection(ctx: ClientContext): void {
  const t = ctx.locale.bind('settings.plugins')
  const tabs = createPluginsTabsObservable(ctx)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugins',
    order: 20,
    label: () => t('nav'),
    locale: 'settings.plugins',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
    inject: () => ({
      hooks: { tabs },
    }),
  }, DesktopPluginsSettingsSection))
}
