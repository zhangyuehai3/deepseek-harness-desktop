/**
 * Sidebar right-click context menu (P0.1), ... menu enhancement, and Drag-and-Drop to composer (P1.1).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import {
  copyMentionToClipboard,
  insertMentionToCurrentComposer,
  showRecallToast,
} from './session-reference-utils.ts'

interface SessionElementInfo {
  id: string
  title: string
}

let activeDraggedSession: SessionElementInfo | null = null
let activeContextMenu: HTMLElement | null = null
let lastContextSession: SessionElementInfo | null = null

function closeContextMenu(): void {
  if (activeContextMenu) {
    activeContextMenu.remove()
    activeContextMenu = null
  }
}

/**
 * Resolve session info from a DOM treeitem in the sidebar.
 */
function getSessionFromElement(el: Element, ctx: ClientContext): SessionElementInfo | null {
  // Method 1: React Fiber traversal
  const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))
  if (fiberKey) {
    let curr = (el as any)[fiberKey]
    let depth = 0
    while (curr && depth < 12) {
      const node = curr.memoizedProps?.node
      if (node && typeof node.id === 'string') {
        const title = curr.memoizedProps?.title || node.title || node.id
        return { id: String(node.id), title: String(title) }
      }
      curr = curr.return
      depth++
    }
  }

  // Method 2: Match visible title against sessions list
  const titleEl = el.querySelector('span[class*="title"]') || el
  const titleText = titleEl.textContent?.trim()
  if (titleText) {
    try {
      const list = (ctx as any).sessions?.list?.getSnapshot?.()
      if (list?.byId) {
        for (const [id, session] of Object.entries<any>(list.byId)) {
          if (session?.title?.trim() === titleText) {
            return { id, title: titleText }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null
}

const QUOTE_SVG = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 3.5H3.5C2.67 3.5 2 4.17 2 5v2.5C2 8.33 2.67 9 3.5 9H5v1.5c0 1.1-.9 2-2 2H2.5v1.5H3c2.21 0 4-1.79 4-4V5c0-.83-.67-1.5-1.5-1.5zm8 0h-2.5c-.83 0-1.5.67-1.5 1.5v2.5c0 .83.67 1.5 1.5 1.5H13v1.5c0 1.1-.9 2-2 2h-.5v1.5h.5c2.21 0 4-1.79 4-4V5c0-.83-.67-1.5-1.5-1.5z" fill="currentColor"/></svg>`
const COPY_SVG = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 2h7a2 2 0 012 2v1H5a2 2 0 00-2 2v7H2a2 2 0 01-2-2V4a2 2 0 012-2h2zm2 4h8a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" fill="currentColor"/></svg>`

/**
 * Enhance the native sidebar session "..." menu by injecting quote & copy actions.
 */
function enhanceSessionMenu(menu: HTMLElement, ctx: ClientContext): void {
  if (menu.querySelector('.dsh-injected-recall-item')) return

  const text = menu.textContent || ''
  const isSessionMenu = (text.includes('重命名') || text.includes('Rename')) &&
    (text.includes('归档') || text.includes('Archive'))
  if (!isSessionMenu) return

  // Locate the target session: prefer recorded lastContextSession, then active row
  const activeRow = document.querySelector<HTMLElement>('[role="treeitem"][class*="menuOpen"]')
    || document.querySelector<HTMLElement>('[role="treeitem"]:has(button[aria-expanded="true"])')
    || document.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]')

  const session = lastContextSession || (activeRow ? getSessionFromElement(activeRow, ctx) : null)
  if (!session) return

  const viewport = menu.querySelector<HTMLElement>('div[class*="viewport"]') || menu
  const sampleWrap = viewport.querySelector<HTMLElement>('div[class*="itemWrap"]')
  if (!sampleWrap) return

  const sampleButton = sampleWrap.querySelector<HTMLButtonElement>('button[role="menuitem"]')
  const sampleIcon = sampleWrap.querySelector<HTMLElement>('span[class*="itemIcon"]')
  const sampleLabel = sampleWrap.querySelector<HTMLElement>('span[class*="itemLabel"]')

  // Separator
  const existingSep = menu.querySelector('div[class*="separator"]')
  const sep = document.createElement('div')
  sep.className = 'dsh-injected-recall-item ' + (existingSep?.className || 'dsh-session-context-menu-separator')
  sep.setAttribute('role', 'separator')
  viewport.appendChild(sep)

  const createItem = (label: string, svg: string, onClick: () => void) => {
    const wrap = document.createElement('div')
    wrap.className = sampleWrap.className + ' dsh-injected-recall-item'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.role = 'menuitem'
    btn.className = sampleButton?.className || ''

    const icon = document.createElement('span')
    icon.className = sampleIcon?.className || ''
    icon.innerHTML = svg

    const lbl = document.createElement('span')
    lbl.className = sampleLabel?.className || ''
    lbl.textContent = label

    btn.appendChild(icon)
    btn.appendChild(lbl)
    wrap.appendChild(btn)

    wrap.addEventListener('mousedown', (e) => {
      // Prevent mousedown from stealing focus from composer
      e.preventDefault()
    })

    wrap.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
      closeContextMenu()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    return wrap
  }

  // 1. "引用到当前会话"
  viewport.appendChild(createItem('引用到当前会话', QUOTE_SVG, () => {
    insertMentionToCurrentComposer(ctx, session.id, session.title)
  }))

  // 2. "复制引用"
  viewport.appendChild(createItem('复制引用', COPY_SVG, () => {
    void copyMentionToClipboard(session.id, session.title)
  }))
}

/**
 * Render the fallback session right-click context menu.
 */
function openContextMenu(
  ctx: ClientContext,
  session: SessionElementInfo,
  clientX: number,
  clientY: number,
): void {
  closeContextMenu()

  const menu = document.createElement('div')
  menu.className = 'dsh-session-context-menu'
  menu.style.left = `${Math.min(clientX, window.innerWidth - 180)}px`
  menu.style.top = `${Math.min(clientY, window.innerHeight - 150)}px`

  // Item 1: Quote in Current Session
  const quoteItem = document.createElement('div')
  quoteItem.className = 'dsh-session-context-menu-item'
  quoteItem.innerHTML = `
    ${QUOTE_SVG}
    <span>引用到当前会话</span>
  `
  quoteItem.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeContextMenu()
    insertMentionToCurrentComposer(ctx, session.id, session.title)
  })

  // Item 2: Copy Reference
  const copyItem = document.createElement('div')
  copyItem.className = 'dsh-session-context-menu-item'
  copyItem.innerHTML = `
    ${COPY_SVG}
    <span>复制引用</span>
  `
  copyItem.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeContextMenu()
    void copyMentionToClipboard(session.id, session.title)
  })

  // Separator
  const sep = document.createElement('div')
  sep.className = 'dsh-session-context-menu-separator'

  // Item 3: Copy Session ID
  const copyIdItem = document.createElement('div')
  copyIdItem.className = 'dsh-session-context-menu-item'
  copyIdItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" stroke-width="1.2"/>
    </svg>
    <span>复制会话 ID</span>
  `
  copyIdItem.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeContextMenu()
    void navigator.clipboard.writeText(session.id)
    showRecallToast('已复制会话 ID')
  })

  menu.appendChild(quoteItem)
  menu.appendChild(copyItem)
  menu.appendChild(sep)
  menu.appendChild(copyIdItem)

  document.body.appendChild(menu)
  activeContextMenu = menu
}

/**
 * Install sidebar right-click menu, "..." menu enhancements & drag-drop interactions.
 */
export function installSessionSidebarInteractions(ctx: ClientContext): () => void {
  if (typeof document === 'undefined') return () => {}

  // 1. Right click delegation for sidebar session rows: opens the enhanced native menu directly
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const row = target.closest<HTMLElement>('[role="treeitem"]')
    if (!row) return

    const session = getSessionFromElement(row, ctx)
    if (session) {
      lastContextSession = session
      e.preventDefault()
      e.stopPropagation()

      // Prefer opening the native row actions menu which now contains all 5 options
      const actionBtn = row.querySelector<HTMLButtonElement>('button[aria-label*="会话"], span[class*="rowActions"] button')
      if (actionBtn) {
        actionBtn.click()
      } else {
        openContextMenu(ctx, session, e.clientX, e.clientY)
      }
    }
  }

  // 2. Observer for dynamically mounted menus in document.body
  const menuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.getAttribute('role') === 'menu') {
            enhanceSessionMenu(node, ctx)
          } else {
            const menuEl = node.querySelector<HTMLElement>('[role="menu"]')
            if (menuEl) enhanceSessionMenu(menuEl, ctx)
          }
        }
      }
    }
  })

  menuObserver.observe(document.body, { childList: true, subtree: true })

  // 3. Dismiss context menu on click or escape, and track row actions clicks
  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null
    if (target) {
      const btn = target.closest<HTMLElement>('button[aria-label*="会话"], span[class*="rowActions"] button')
      if (btn) {
        const row = btn.closest<HTMLElement>('[role="treeitem"]')
        if (row) {
          const session = getSessionFromElement(row, ctx)
          if (session) {
            lastContextSession = session
          }
        }
      }
    }
    if (activeContextMenu && !activeContextMenu.contains(e.target as Node)) {
      closeContextMenu()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeContextMenu()
    }
  }

  // 4. Drag and Drop handling
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const row = target.closest('[role="treeitem"]')
    if (!row) return

    const session = getSessionFromElement(row, ctx)
    if (session) {
      activeDraggedSession = session
      if (e.dataTransfer) {
        e.dataTransfer.setData('application/x-dsh-session', session.id)
      }
    }
  }

  const handleDragEnd = () => {
    activeDraggedSession = null
    document.querySelectorAll('.dsh-drop-target-active').forEach(el => {
      el.classList.remove('dsh-drop-target-active')
    })
  }

  const handleDragOver = (e: DragEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const composerCard = target.closest<HTMLElement>('[data-composer-card]')
    if (!composerCard) return

    if (activeDraggedSession || e.dataTransfer?.types.includes('application/x-dsh-session')) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      composerCard.classList.add('dsh-drop-target-active')
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const composerCard = target.closest<HTMLElement>('[data-composer-card]')
    if (!composerCard) return

    if (e.relatedTarget && composerCard.contains(e.relatedTarget as Node)) {
      return
    }
    composerCard.classList.remove('dsh-drop-target-active')
  }

  const handleDrop = (e: DragEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const composerCard = target.closest<HTMLElement>('[data-composer-card]')
    if (!composerCard) return

    composerCard.classList.remove('dsh-drop-target-active')

    const sessionId = e.dataTransfer?.getData('application/x-dsh-session')
      || activeDraggedSession?.id
      || e.dataTransfer?.getData('text/plain')

    if (!sessionId) return

    try {
      const list = (ctx as any).sessions?.list?.getSnapshot?.()
      if (list?.byId && list.byId[sessionId]) {
        e.preventDefault()
        e.stopPropagation()
        const title = list.byId[sessionId].title || activeDraggedSession?.title || sessionId
        insertMentionToCurrentComposer(ctx, sessionId, title)
      }
    } catch {
      // ignore
    }

    activeDraggedSession = null
  }

  document.addEventListener('contextmenu', handleContextMenu, true)
  document.addEventListener('pointerdown', handlePointerDown, true)
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('dragstart', handleDragStart, true)
  document.addEventListener('dragend', handleDragEnd, true)
  document.addEventListener('dragover', handleDragOver, true)
  document.addEventListener('dragleave', handleDragLeave, true)
  document.addEventListener('drop', handleDrop, true)

  return () => {
    menuObserver.disconnect()
    closeContextMenu()
    document.removeEventListener('contextmenu', handleContextMenu, true)
    document.removeEventListener('pointerdown', handlePointerDown, true)
    window.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('dragstart', handleDragStart, true)
    document.removeEventListener('dragend', handleDragEnd, true)
    document.removeEventListener('dragover', handleDragOver, true)
    document.removeEventListener('dragleave', handleDragLeave, true)
    document.removeEventListener('drop', handleDrop, true)
  }
}
