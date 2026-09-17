/**
 * Cross-session recall reference helpers for Desktop plugins.
 * Encodes canonical `dsh-session:` URIs and mentions compatible with upstream sessionReferenceResolver.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'

export const SESSION_REFERENCE_SCHEME = 'dsh-session:'

/**
 * Lossless canonical base64url encoding for session ID.
 */
export function encodeSessionReferenceUri(sessionId: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      const payload = Buffer.from(JSON.stringify(sessionId), 'utf8').toString('base64url')
      return `${SESSION_REFERENCE_SCHEME}${payload}`
    }
  } catch {
    // fallback to browser btoa
  }
  const json = JSON.stringify(sessionId)
  const base64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${SESSION_REFERENCE_SCHEME}${base64}`
}

/**
 * Escape mention labels according to DeepSeek Harness Markdown mention grammar.
 */
export function escapeMentionLabel(label: string): string {
  return label.replace(/[\\\]]/gu, match => `\\${match}`)
}

/**
 * Format a standard Markdown mention for a session.
 */
export function formatSessionReferenceMention(sessionId: string, label?: string): string {
  const displayLabel = escapeMentionLabel((label && label.trim()) || sessionId)
  const uri = encodeSessionReferenceUri(sessionId)
  return `@[${displayLabel}](${uri})`
}

let activeToastTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Show a sleek floating toast notification in the bottom center.
 */
export function showRecallToast(message: string, duration = 2500): void {
  if (typeof document === 'undefined') return

  let toast = document.getElementById('dsh-session-recall-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'dsh-session-recall-toast'
    toast.className = 'dsh-recall-toast'
    document.body.appendChild(toast)
  }

  toast.textContent = message
  toast.classList.add('visible')

  if (activeToastTimer) clearTimeout(activeToastTimer)
  activeToastTimer = setTimeout(() => {
    toast?.classList.remove('visible')
  }, duration)
}

/**
 * Copy the formatted session reference to the clipboard and show feedback.
 */
export async function copyMentionToClipboard(sessionId: string, label?: string): Promise<boolean> {
  const mention = formatSessionReferenceMention(sessionId, label)
  try {
    await navigator.clipboard.writeText(mention)
    const name = label ? `「${label}」` : ''
    showRecallToast(`已复制会话引用 ${name}`)
    return true
  } catch {
    showRecallToast('复制失败，请检查剪贴板权限')
    return false
  }
}

/**
 * Insert a session reference into the currently active conversation composer.
 * Inserts an atomic session ReferenceChip pill (appearance: 'session') into the Lexical editor,
 * matching native @ trigger selection, and focuses the composer input.
 */
export function insertMentionToCurrentComposer(ctx: ClientContext, sessionId: string, label?: string): boolean {
  const displayLabel = (label && label.trim()) || sessionId
  const uri = encodeSessionReferenceUri(sessionId)
  const mention = `@[${escapeMentionLabel(displayLabel)}](${uri})`

  try {
    const composerInput = typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('[data-composer-input]')
      : null

    let editor: any = null
    let shell: any = null

    // 1. Resolve editor and shell from composer DOM / React fiber
    if (composerInput) {
      editor = (composerInput as any).__lexicalEditor || null
      const fiberKey = Object.keys(composerInput).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))
      if (fiberKey) {
        let curr = (composerInput as any)[fiberKey]
        let depth = 0
        while (curr && depth < 20) {
          if (!editor && curr.memoizedProps?.editor) {
            editor = curr.memoizedProps.editor
          }
          if (!shell && (curr.memoizedProps?.keyboard || curr.memoizedProps?.shell)) {
            shell = curr.memoizedProps.keyboard || curr.memoizedProps.shell
          }
          curr = curr.return
          depth++
        }
      }
    }

    // 2. Resolve shell from client context if not yet found
    if (!shell) {
      try {
        const sessions = (ctx as any).sessions
        const currentSessionId = sessions?.list?.getSnapshot?.()?.current
        const conversation = (ctx as any).conversation
        if (currentSessionId && conversation?.input?.shell) {
          shell = conversation.input.shell(currentSessionId)
        }
      } catch {
        // ignore
      }
    }

    // 3. Focus the input surface first
    if (composerInput) {
      composerInput.focus()
    }
    if (editor && typeof editor.focus === 'function') {
      try {
        editor.focus()
      } catch {
        // ignore
      }
    }

    let inserted = false

    // 4. Try atomic reference chip insertion via shell
    if (shell) {
      try {
        if (typeof shell.insertReference === 'function') {
          const caret = typeof shell.caretSpan === 'function' ? shell.caretSpan() : { start: 0, end: 0 }
          const draftRev = shell.snapshot?.draftRev ?? (shell as any).rev ?? 0
          inserted = shell.insertReference(
            {
              source: 'reference',
              ref: mention,
              label: displayLabel,
              appearance: 'session',
              clipboardText: mention,
            },
            {
              start: caret.start,
              end: caret.end,
              draftRev,
            },
          )
        }
        if (!inserted && typeof shell.paste === 'function') {
          shell.paste(mention + ' ')
          inserted = true
        }
      } catch (err) {
        console.warn('Direct shell reference insertion failed, falling back:', err)
      }
    }

    // 5. If shell wasn't directly accessible, dispatch paste event onto composerInput
    if (!inserted && composerInput) {
      try {
        const dt = new DataTransfer()
        dt.setData('text/plain', mention + ' ')
        const pasteEvt = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        })
        composerInput.dispatchEvent(pasteEvt)
        inserted = true
      } catch {
        // ignore
      }
    }

    // 6. Native execCommand fallback
    if (!inserted && composerInput) {
      try {
        inserted = document.execCommand('insertText', false, mention + ' ')
      } catch {
        // ignore
      }
    }

    // Ensure focus is active and caret is placed at the end
    if (composerInput) {
      setTimeout(() => {
        composerInput.focus()
        if (editor && typeof editor.focus === 'function') {
          editor.focus()
        }
      }, 0)
    }

    // Also populate clipboard as background courtesy
    void navigator.clipboard?.writeText?.(mention).catch(() => {})

    if (inserted) {
      showRecallToast(`已引用会话 「${displayLabel}」`)
      return true
    }
  } catch (err) {
    console.error('Failed to insert session mention:', err)
  }

  // If could not insert directly, copy to clipboard as seamless fallback
  void copyMentionToClipboard(sessionId, label)
  showRecallToast('已将引用复制到剪贴板，可直接在输入框粘贴')
  return false
}

