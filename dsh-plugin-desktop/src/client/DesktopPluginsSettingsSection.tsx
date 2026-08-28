/** Desktop-owned Plugins settings section that surfaces upstream plugin tabs. */

import { useEffect, useId, useRef, useState } from 'react'
import type { HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Pull in the settings.section and settings.plugins.tab slot declarations.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Pull in the 'settings.plugins' locale namespace so PropsLocale resolves.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

/** One tab projected from the upstream settings.plugins.tab slot. */
export interface DesktopPluginsTabEntry {
  readonly id: string
  readonly order: number
  readonly label: string
}

/** Registration-side business face for the Plugins section. */
export interface DesktopPluginsSettingsSectionInjected {
  hooks: {
    /** Ordered, locale-aware projection of the Plugins tab ledger. */
    tabs: HostObservable<readonly DesktopPluginsTabEntry[]>
  }
}

/** Props the renderer binds for the section. */
export type DesktopPluginsSettingsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.plugins'>
  & PropsRenderSlots<'settings.plugins.tab'>
  & InjectFace<DesktopPluginsSettingsSectionInjected>

/** Render the original upstream Plugins settings page inside the desktop shell. */
export function DesktopPluginsSettingsSection({
  t,
  renderSlot,
  useTabs,
}: DesktopPluginsSettingsSectionProps) {
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const rows = useTabs(snapshot => snapshot)
  const [activeId, setActiveId] = useState<string>()
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() => new Set())
  const active = rows.find(row => row.id === activeId)?.id ?? rows[0]?.id

  // A tab mounts only when first selected, then stays mounted while hidden so
  // local drafts and inventory snapshot survive switching between the two views.
  useEffect(() => {
    if (active === undefined) return
    setVisitedIds((previous) => {
      if (previous.has(active)) return previous
      return new Set([...previous, active])
    })
  }, [active])

  return (
    <div className="dshDesktopPluginsSection">
      <h2 className="dshDesktopPluginsSectionHeading">{t('title')}</h2>
      <p className="dshDesktopPluginsSectionIntro">{t('intro')}</p>
      {rows.length === 0 ? (
        <p className="dshDesktopPluginsEmpty">{t('empty')}</p>
      ) : (
        <>
          <div className="dshDesktopPluginsTabs" role="tablist" aria-label={t('tabs')}>
            {rows.map((row, index) => {
              const selected = row.id === active
              return (
                <button
                  key={row.id}
                  ref={(element) => { tabRefs.current[index] = element }}
                  id={`${tabsId}-tab-${row.id}`}
                  type="button"
                  role="tab"
                  className="dshDesktopPluginsTab"
                  aria-selected={selected}
                  aria-controls={`${tabsId}-panel-${row.id}`}
                  data-active={selected ? 'true' : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => { setActiveId(row.id) }}
                  onKeyDown={(event) => {
                    let nextIndex: number
                    switch (event.key) {
                      case 'ArrowRight': nextIndex = (index + 1) % rows.length; break
                      case 'ArrowLeft': nextIndex = (index - 1 + rows.length) % rows.length; break
                      case 'Home': nextIndex = 0; break
                      case 'End': nextIndex = rows.length - 1; break
                      default: return
                    }
                    event.preventDefault()
                    const nextRow = rows[nextIndex] as DesktopPluginsTabEntry
                    const nextTab = tabRefs.current[nextIndex] as HTMLButtonElement
                    setActiveId(nextRow.id)
                    nextTab.focus()
                  }}
                >
                  {row.label}
                </button>
              )
            })}
          </div>
          {rows
            .filter(row => row.id === active || visitedIds.has(row.id))
            .map((row) => {
              const selected = row.id === active
              return (
                <div
                  key={row.id}
                  id={`${tabsId}-panel-${row.id}`}
                  className="dshDesktopPluginsPanel"
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-tab-${row.id}`}
                  hidden={!selected}
                >
                  {renderSlot('settings.plugins.tab', {}, { only: row.id })}
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}
