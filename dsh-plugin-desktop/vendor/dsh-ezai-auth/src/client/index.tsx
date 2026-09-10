import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { EzaiAccountTab } from './EzaiAccountTab.tsx'
import { showDepartmentNoticeModal } from './DepartmentNoticeModal.tsx'
import { showEzaiLoginModal } from './EzaiLoginModal.tsx'
import { en, NS, zh } from './locales.ts'
import { injectCss } from './styles.ts'

export const inject = ['slots', 'locale']

let isEzaiLoggedIn = false
let conversationService: any = null
const authBlockedSessions = new Set<string>()

function unlockAllSessions(): void {
  if (!conversationService || !conversationService.blocks) return
  for (const sessionId of authBlockedSessions) {
    try {
      conversationService.blocks.set(sessionId, undefined)
    } catch {
      // ignore
    }
  }
  authBlockedSessions.clear()

  try {
    const stores = conversationService.blocks.stores
    if (stores instanceof Map) {
      for (const [sessionId, store] of stores.entries()) {
        const snapshot = store?.getSnapshot?.()
        if (
          snapshot &&
          typeof snapshot.reason === 'string' &&
          (snapshot.reason.includes('登录') ||
            snapshot.reason.toLowerCase().includes('log in') ||
            snapshot.reason.includes('模型') ||
            snapshot.reason.toLowerCase().includes('model'))
        ) {
          conversationService.blocks.set(sessionId, undefined)
        }
      }
    }
  } catch {
    // ignore
  }
}

function lockAllSessions(ctx: ClientContext): void {
  if (!conversationService || !conversationService.blocks) return
  const isZh = getActiveLocale(ctx) === 'zh'
  const prompt = isZh ? '请登录账号后使用' : 'Please log in to your account first'

  try {
    const stores = conversationService.blocks.stores
    if (stores instanceof Map) {
      for (const [sessionId] of stores.entries()) {
        authBlockedSessions.add(sessionId)
        try {
          conversationService.blocks.set(sessionId, { reason: prompt })
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

function getActiveLocale(ctx: ClientContext): 'zh' | 'en' {
  const snapshot = (ctx.locale as any).getSnapshot?.()
  const active = typeof snapshot?.active === 'string' ? snapshot.active : 'en'
  return active === 'zh' ? 'zh' : 'en'
}

function installModelLockObserver(ctx: ClientContext): void {
  if (typeof document === 'undefined') return

  const cleanUI = () => {
    const isZh = getActiveLocale(ctx) === 'zh'
    const loginPrompt = isZh ? '请登录账号后使用' : 'Please log in to your account first'

    // 1. Hide models nav button in Settings dialog
    const navButtons = document.querySelectorAll('button[class*="navCell"], button[class*="SettingsRoot_navCell"]')
    for (const btn of navButtons) {
      const text = btn.textContent?.trim()
      if (text === '模型' || text === 'Models') {
        (btn as HTMLElement).style.display = 'none'
        btn.classList.add('dshHideModelsNav')
        // If it was currently active, switch to the next available tab
        if (btn.getAttribute('aria-current') === 'true' || btn.classList.contains('active') || btn.className.includes('active')) {
          const sibling = btn.parentElement?.querySelector('button[class*="navCell"]:not([style*="display: none"]):not(.dshHideModelsNav)') as HTMLElement | null
          if (sibling && sibling !== btn) {
            sibling.click()
          }
        }
      }
    }

    // 2. Hide model trigger in conversation / composer
    const modelTriggers = document.querySelectorAll('[class*="ModelSelect_root"], [class*="ModelSelect_trigger"], [data-slot="conversation.input.model"]')
    for (const el of modelTriggers) {
      (el as HTMLElement).style.display = 'none'
    }

    // 2.1 Hide 'model' slash command option in trigger suggestions popover menu
    const slashOptions = document.querySelectorAll('button[role="option"]')
    for (const opt of slashOptions) {
      const nameEl = opt.querySelector('span[class*="itemName"]')
      if (nameEl && nameEl.textContent?.trim() === 'model') {
        (opt as HTMLElement).style.display = 'none'
      }
    }

    // 3. Dismiss ONLY the specific DeepSeek API Key onboarding dialog
    const headings = document.querySelectorAll('h2')
    for (const heading of headings) {
      const headingText = heading.textContent?.trim()
      if (headingText === '添加一个 API Key 开始使用' || headingText === 'Add an API key to get started') {
        const dialog = heading.closest('div[role="dialog"]') || heading.closest('div[class*="dialog"]')
        if (dialog) {
          const presentationRoot = dialog.closest('div[role="presentation"]') as HTMLElement | null
          if (presentationRoot && !presentationRoot.dataset.dshDismissed) {
            presentationRoot.dataset.dshDismissed = 'true'
            presentationRoot.style.display = 'none'
            
            // Auto click "稍后配置" to advance onboarding state
            const buttons = dialog.querySelectorAll('button')
            for (const btn of buttons) {
              const bText = btn.textContent?.trim()
              if (bText === '稍后配置' || bText === 'Later' || bText === 'Configure later') {
                btn.click()
                break
              }
            }

            // Restore root inert
            const appRoot = document.getElementById('root')
            if (appRoot) {
              appRoot.inert = false
              appRoot.removeAttribute('inert')
            }
          }
        }
      }
    }

    // 4. Handle logged-out vs logged-in state on composer textarea and card
    const textareas = document.querySelectorAll('textarea')
    const composerCards = document.querySelectorAll('[data-composer-card]')

    if (!isEzaiLoggedIn) {
      if (typeof window !== 'undefined') {
        (window as any).__EZAI_LOGGED_IN__ = false
      }
      // Not logged in: set placeholder, make readOnly so click bubbles to card without breaking IME
      for (const ta of textareas) {
        ta.placeholder = loginPrompt
        ta.readOnly = true
        ta.dataset.ezaiLoggedOut = 'true'
      }

      for (const card of composerCards) {
        card.setAttribute('data-ezai-logged-out', 'true')
        if (!(card as any)._ezaiClickAttached) {
          ;(card as any)._ezaiClickAttached = true
          card.addEventListener('click', (e: MouseEvent) => {
            if (!isEzaiLoggedIn) {
              e.preventDefault()
              e.stopPropagation()
              showEzaiLoginModal(getActiveLocale(ctx))
            }
          }, true)
        }
      }

      // Hide any technical model-unavailable toasts when logged out
      const toasts = document.querySelectorAll('div[role="alert"], div[class*="Toast_toast"]')
      for (const toast of toasts) {
        const text = toast.textContent || ''
        if (text.includes('no adapter serves provider') || text.includes('model-unavailable') || text.includes('选择模型')) {
          (toast as HTMLElement).style.display = 'none'
        }
      }
    } else {
      if (typeof window !== 'undefined') {
        (window as any).__EZAI_LOGGED_IN__ = true
      }
      // Logged in: ensure textarea is fully interactive and clean any lock residue
      for (const ta of textareas) {
        delete ta.dataset.ezaiLoggedOut
        if (ta.readOnly) {
          ta.readOnly = false
        }
        if (ta.disabled) {
          ta.disabled = false
          ta.removeAttribute('disabled')
        }
        if (ta.placeholder === '请登录账号后使用' || ta.placeholder === 'Please log in to your account first') {
          ta.placeholder = isZh ? '输入消息或使用 / 调用命令...' : 'Send a message or type / for commands...'
        }
      }

      for (const card of composerCards) {
        card.removeAttribute('data-ezai-logged-out')
      }
    }

    // 5. Update hero preview badge to "版本 2.0.3"
    const badges = document.querySelectorAll('span[class*="previewBadge"], span[class*="HeroShell_previewBadge"]')
    for (const badge of badges) {
      const text = badge.textContent?.trim()
      if (text === '预览版' || text === 'Preview' || text === '版本 2.0.2') {
        badge.textContent = '版本 2.0.3'
      }
    }
  }

  // Listen for login / logout state changes
  window.addEventListener('ezai-auth:state-change', (event: any) => {
    const nextLoggedIn = Boolean(event.detail?.loggedIn)
    isEzaiLoggedIn = nextLoggedIn
    if (typeof window !== 'undefined') {
      (window as any).__EZAI_LOGGED_IN__ = isEzaiLoggedIn
    }
    if (nextLoggedIn) {
      unlockAllSessions()
      setTimeout(() => {
        const ta = document.querySelector('textarea:not([disabled])') as HTMLTextAreaElement | null
        if (ta && document.activeElement !== ta) {
          ta.focus()
        }
      }, 50)
    } else {
      lockAllSessions(ctx)
    }
    cleanUI()
  })

  // Run immediately and observe DOM changes
  cleanUI()
  const observer = new MutationObserver(() => {
    cleanUI()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

export function apply(ctx: ClientContext): void {
  injectCss()
  installModelLockObserver(ctx)

  // Intercept commandUi to disable and hide /model slash command
  ctx.inject(['commandUi'], (scope: ClientContext) => {
    const commandUi = scope.get('commandUi') as any
    if (!commandUi) return

    // 1. Filter out 'model' from command candidates
    const origCandidates = commandUi.candidates?.bind(commandUi)
    if (origCandidates) {
      commandUi.candidates = async (...args: any[]) => {
        const rows = await origCandidates(...args)
        if (Array.isArray(rows)) {
          return rows.filter((r: any) => r && r.name !== 'model')
        }
        return rows
      }
    }

    // 2. Mark 'model' contribution as unavailable if already registered or on new register
    const disableModel = (contribution: any) => {
      if (contribution && contribution.name === 'model') {
        contribution.available = () => false
      }
    }

    if (commandUi.live?.contributions) {
      disableModel(commandUi.live.contributions.get('model'))
    }

    const origRegister = commandUi.register?.bind(commandUi)
    if (origRegister) {
      commandUi.register = (contribution: any) => {
        disableModel(contribution)
        return origRegister(contribution)
      }
    }

    // 3. Guard dispatch against 'model'
    const origDispatch = commandUi.dispatch?.bind(commandUi)
    if (origDispatch) {
      commandUi.dispatch = (pick: any) => {
        if (pick?.candidate?.name === 'model') return
        return origDispatch(pick)
      }
    }
  })

  // Intercept conversation composer blocks
  ctx.inject(['conversation'], (scope: ClientContext) => {
    const conversation = scope.get('conversation') as any
    conversationService = conversation
    if (conversation && conversation.blocks) {
      const originalSet = conversation.blocks.set.bind(conversation.blocks)
      conversation.blocks.set = (sessionId: any, block: any) => {
        if (!isEzaiLoggedIn) {
          authBlockedSessions.add(sessionId)
          // When logged out, lock with friendly prompt
          const isZh = getActiveLocale(ctx) === 'zh'
          originalSet(sessionId, { reason: isZh ? '请登录账号后使用' : 'Please log in to your account first' })
          return
        }
        authBlockedSessions.delete(sessionId)
        if (
          block &&
          typeof block.reason === 'string' &&
          (block.reason.includes('模型') ||
            block.reason.toLowerCase().includes('model') ||
            block.reason.includes('登录') ||
            block.reason.toLowerCase().includes('log in'))
        ) {
          originalSet(sessionId, undefined)
          return
        }
        originalSet(sessionId, block)
      }

      const originalStoreFor = conversation.blocks.storeFor?.bind(conversation.blocks)
      if (originalStoreFor) {
        conversation.blocks.storeFor = (sessionId: any) => {
          const store = originalStoreFor(sessionId)
          if (!isEzaiLoggedIn) {
            authBlockedSessions.add(sessionId)
            const current = store.getSnapshot()
            if (!current || !current.reason) {
              const isZh = getActiveLocale(ctx) === 'zh'
              store.set({ reason: isZh ? '请登录账号后使用' : 'Please log in to your account first' })
            }
          }
          return store
        }
      }

      if (isEzaiLoggedIn) {
        unlockAllSessions()
      } else {
        lockAllSessions(ctx)
      }
    }
  })

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ezai-auth: dictionaries')

  // 1. Settings section: EZAI Account (in Settings dialog)
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

  // 2. On startup, check session and sync logged in state
  void (async () => {
    try {
      const response = await fetch('/api/ezai-auth/account', { headers: { accept: 'application/json' } })
      if (response.status === 200) {
        isEzaiLoggedIn = true
        if (typeof window !== 'undefined') {
          (window as any).__EZAI_LOGGED_IN__ = true
          window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: true } }))
        }
        unlockAllSessions()
        cleanUI()
        return
      }
      isEzaiLoggedIn = false
      if (typeof window !== 'undefined') {
        (window as any).__EZAI_LOGGED_IN__ = false
        window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
      }
      lockAllSessions(ctx)
      if (response.status === 403) {
        const payload = (await response.json().catch(() => ({}))) as any
        if (payload.departmentDisallowed) {
          showDepartmentNoticeModal(payload.message, () => {
            showEzaiLoginModal(getActiveLocale(ctx))
          }, payload.title)
          return
        }
      }
      if (response.status === 401) {
        showEzaiLoginModal(getActiveLocale(ctx))
      }
    } catch {
      // Ignore transient network errors on startup
    }
  })()
}

