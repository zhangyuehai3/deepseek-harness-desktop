/**
 * Session Picker Service (P0.2).
 * Mounts SessionPickerModal, registers slash commands into commandUi, and installs global shortcuts.
 */
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { SessionPickerModal } from './SessionPickerModal.tsx'

let pickerContainer: HTMLElement | null = null
let pickerRoot: Root | null = null

export function closeSessionPicker(): void {
  if (pickerRoot) {
    pickerRoot.unmount()
    pickerRoot = null
  }
  if (pickerContainer) {
    pickerContainer.remove()
    pickerContainer = null
  }
}

export function openSessionPicker(ctx: ClientContext): void {
  if (typeof document === 'undefined') return

  closeSessionPicker()

  pickerContainer = document.createElement('div')
  pickerContainer.id = 'dsh-session-picker-root'
  document.body.appendChild(pickerContainer)

  pickerRoot = createRoot(pickerContainer)
  pickerRoot.render(React.createElement(SessionPickerModal, { ctx, onClose: closeSessionPicker }))
}

/**
 * Register `/recall` slash command and shortcut for cross-session recall.
 */
export function installSessionPickerService(ctx: ClientContext): () => void {
  if (typeof window === 'undefined') return () => {}

  // 1. Register shortcut (Mod+Shift+R)
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault()
      e.stopPropagation()
      openSessionPicker(ctx)
    }
  }
  window.addEventListener('keydown', handleKeyDown)

  // 2. Register command into commandUi (if available or upon injection)
  let unregisterCommand: (() => void) | undefined

  const registerToCommandUi = (scope: ClientContext) => {
    try {
      const rawCommandUi = ((scope.get('commandUi') as any)?.[Symbol.for('cordis.original')]) || (scope.get('commandUi') as any)
      if (!rawCommandUi) return

      const recallContribution = {
        name: 'recall',
        label: () => '引用历史会话',
        description: () => '搜索并引用历史会话 (Cross-Session Recall)',
        available: () => true,
        ui: {
          kind: 'action' as const,
          run: () => {
            openSessionPicker(ctx)
          },
        },
      }

      // If commandUi.register is available
      if (typeof rawCommandUi.register === 'function') {
        unregisterCommand = rawCommandUi.register(recallContribution)
      } else if (rawCommandUi.live?.contributions) {
        rawCommandUi.live.contributions.set('recall', recallContribution)
        unregisterCommand = () => { rawCommandUi.live?.contributions?.delete('recall') }
      }
    } catch {
      // ignore
    }
  }

  // Inject commandUi when ready
  try {
    ctx.inject(['commandUi'], (scope: ClientContext) => {
      registerToCommandUi(scope)
    })
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    unregisterCommand?.()
    closeSessionPicker()
  }
}
