import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { EzaiAccountTab } from './EzaiAccountTab.tsx'
import { showDepartmentNoticeModal } from './DepartmentNoticeModal.tsx'
import { showEzaiLoginModal } from './EzaiLoginModal.tsx'
import { en, NS, zh } from './locales.ts'
import { injectCss } from './styles.ts'

export const inject = ['slots', 'locale']

function getActiveLocale(ctx: ClientContext): 'zh' | 'en' {
  const snapshot = (ctx.locale as any).getSnapshot?.()
  const active = typeof snapshot?.active === 'string' ? snapshot.active : 'en'
  return active === 'zh' ? 'zh' : 'en'
}

function installModelLockObserver(): void {
  if (typeof document === 'undefined') return

  const cleanUI = () => {
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
    // 4. Clear model unavailable block from composer textarea
    const textareas = document.querySelectorAll('textarea')
    for (const ta of textareas) {
      const ph = ta.placeholder || ''
      if (ta.disabled && (ph.includes('模型不可用') || ph.includes('选择模型') || ph.toLowerCase().includes('model is unavailable'))) {
        ta.disabled = false
        ta.removeAttribute('disabled')
        ta.placeholder = '输入消息或使用 / 调用命令...'
      }
    }

    // 5. Update hero preview badge to "版本 2.0.2"
    const badges = document.querySelectorAll('span[class*="previewBadge"], span[class*="HeroShell_previewBadge"]')
    for (const badge of badges) {
      const text = badge.textContent?.trim()
      if (text === '预览版' || text === 'Preview') {
        badge.textContent = '版本 2.0.2'
      }
    }
  }

  // Run immediately and observe DOM changes
  cleanUI()
  const observer = new MutationObserver(() => {
    cleanUI()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

export function apply(ctx: ClientContext): void {
  injectCss()
  installModelLockObserver()

  // Intercept conversation composer model-unavailable blocks
  ctx.inject(['conversation'], (scope: ClientContext) => {
    const conversation = scope.get('conversation') as any
    if (conversation && conversation.blocks) {
      const originalSet = conversation.blocks.set.bind(conversation.blocks)
      conversation.blocks.set = (sessionId: any, block: any) => {
        if (block && typeof block.reason === 'string' && (block.reason.includes('模型') || block.reason.toLowerCase().includes('model'))) {
          originalSet(sessionId, undefined)
          return
        }
        originalSet(sessionId, block)
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

  // 2. On startup, pop up the original EZAI Login Modal if user has no active session
  void (async () => {
    try {
      const response = await fetch('/api/ezai-auth/account', { headers: { accept: 'application/json' } })
      if (response.status === 403) {
        const payload = (await response.json().catch(() => ({}))) as any
        if (payload.departmentDisallowed) {
          showDepartmentNoticeModal(payload.message, () => {
            showEzaiLoginModal(getActiveLocale(ctx))
          })
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
