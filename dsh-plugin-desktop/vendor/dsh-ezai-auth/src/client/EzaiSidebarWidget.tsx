import { useCallback, useEffect, useState } from 'react'
import type { AccountResponse } from '../types.ts'
import { showEzaiLoginModal } from './EzaiLoginModal.tsx'
import { injectCss } from './styles.ts'
import { formatNumber } from './number-format.ts'
export { formatNumber }

export interface EzaiSidebarWidgetProps {
  wide?: boolean
  locale?: 'zh' | 'en'
}

export function openEzaiAccountTab(): void {
  // 1. Try to find and trigger the sidebar settings button
  const settingsBtn = document.querySelector(
    'button[aria-label="设置"], button[aria-label="Settings"], button[class*="trigger"], div[class*="settingsArea"] button'
  ) as HTMLButtonElement | null

  if (settingsBtn) {
    settingsBtn.click()
    // 2. Once dialog opens, switch to EZAI account tab
    setTimeout(() => {
      const navButtons = document.querySelectorAll(
        'button[class*="navCell"], button[class*="SettingsRoot_navCell"], button[role="tab"]'
      )
      for (const btn of navButtons) {
        const text = btn.textContent?.trim()
        if (text === 'EZAI 账户' || text === 'EZAI Account' || text?.includes('EZAI')) {
          (btn as HTMLElement).click()
          break
        }
      }
    }, 60)
  }
}

export function EzaiSidebarWidget(props: EzaiSidebarWidgetProps) {
  const [account, setAccount] = useState<AccountResponse | undefined>(() => {
    if (typeof window !== 'undefined' && (window as any).__EZAI_ACCOUNT__) {
      return (window as any).__EZAI_ACCOUNT__
    }
    return undefined
  })
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof (window as any).__EZAI_LOGGED_IN__ === 'boolean') {
      return (window as any).__EZAI_LOGGED_IN__
    }
    return false
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isZh = (props.locale || 'zh') === 'zh'
  const wide = props.wide !== false

  const refreshAccount = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/ezai-auth/account', {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (res.status === 200) {
        const payload = (await res.json()) as AccountResponse
        setAccount(payload)
        setIsLoggedIn(true)
        if (typeof window !== 'undefined') {
          (window as any).__EZAI_ACCOUNT__ = payload
          ;(window as any).__EZAI_LOGGED_IN__ = true
          window.dispatchEvent(new CustomEvent('ezai-auth:account-updated', { detail: payload }))
        }
        return
      }

      if (res.status === 401 || res.status === 403) {
        setAccount(undefined)
        setIsLoggedIn(false)
        if (typeof window !== 'undefined') {
          delete (window as any).__EZAI_ACCOUNT__
          ;(window as any).__EZAI_LOGGED_IN__ = false
          window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
        }
        if (manual) {
          showEzaiLoginModal(isZh ? 'zh' : 'en')
        }
      }
    } catch {
      // Keep existing data on transient network error
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }, [isZh])

  useEffect(() => {
    injectCss()

    const handleAccountUpdate = (e: any) => {
      if (e.detail) {
        setAccount(e.detail)
        setIsLoggedIn(true)
      }
    }

    const handleStateChange = (e: any) => {
      const nextLoggedIn = Boolean(e.detail?.loggedIn)
      setIsLoggedIn(nextLoggedIn)
      if (!nextLoggedIn) {
        setAccount(undefined)
      } else {
        void refreshAccount(false)
      }
    }

    window.addEventListener('ezai-auth:account-updated', handleAccountUpdate)
    window.addEventListener('ezai-auth:state-change', handleStateChange)

    // Initial fetch if account is not loaded yet
    if (!account) {
      void refreshAccount(false)
    }

    return () => {
      window.removeEventListener('ezai-auth:account-updated', handleAccountUpdate)
      window.removeEventListener('ezai-auth:state-change', handleStateChange)
    }
  }, [account, refreshAccount])

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicked refresh button, don't trigger card click
    if ((e.target as HTMLElement).closest('.dshEzaiSidebarRefreshBtn')) {
      return
    }
    if (!isLoggedIn) {
      showEzaiLoginModal(isZh ? 'zh' : 'en')
    } else {
      openEzaiAccountTab()
    }
  }

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    void refreshAccount(true)
  }

  const userName =
    account?.personalInfo?.name ||
    account?.user?.name ||
    account?.user?.login_name ||
    (isLoggedIn ? (isZh ? '已登录用户' : 'User') : (isZh ? '未登录' : 'Not signed in'))

  const department = account?.personalInfo?.department?.trim()
  const fullUserTitle = department ? `${userName} (${department})` : userName

  const used = account?.tokenUsage?.used ?? 0
  const quota = account?.tokenUsage?.quota ?? 200_000_000
  const percent = quota > 0 ? Math.min(100, Math.max(0, (used / quota) * 100)) : 0
  const isNearLimit = percent >= 85
  const isOverQuota = percent >= 100

  // Collapsed rail mode
  if (!wide) {
    return (
      <div
        className="dshEzaiSidebarRailItem"
        data-ezai-sidebar-widget="true"
        onClick={handleCardClick}
        title={`${fullUserTitle}\n${isZh ? '已消耗' : 'Used'}: ${formatNumber(used)}\n${isZh ? '总额度' : 'Quota'}: ${formatNumber(quota)} Tokens`}
      >
        <div className="dshEzaiSidebarRailAvatar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    )
  }

  // Expanded wide mode: matches user screenshot 1 & 2
  return (
    <div
      className="dshEzaiSidebarCard"
      data-ezai-sidebar-widget="true"
      onClick={handleCardClick}
      title={isLoggedIn ? (isZh ? '点击查看账户详情' : 'Click to view account details') : (isZh ? '点击登录账号' : 'Click to sign in')}
    >
      {/* 1. User Info Header */}
      <div className="dshEzaiSidebarUserRow">
        <div className="dshEzaiSidebarAvatar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="dshEzaiSidebarUserInfo">
          <span className="dshEzaiSidebarUserName" title={fullUserTitle}>
            {userName}
          </span>
          {department && (
            <span className="dshEzaiSidebarUserDept" title={department}>
              ({department})
            </span>
          )}
        </div>
        {isLoggedIn && (
          <button
            type="button"
            className={`dshEzaiSidebarRefreshBtn ${isRefreshing ? 'dshSpinning' : ''}`}
            title={isZh ? '刷新 Token 用量' : 'Refresh token usage'}
            onClick={handleRefreshClick}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. Progress Bar */}
      <div className="dshEzaiSidebarProgressBar">
        <div
          className="dshEzaiSidebarProgressFill"
          style={{
            width: `${percent}%`,
            background: isOverQuota
              ? '#ef4444'
              : isNearLimit
              ? '#f59e0b'
              : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
          }}
        />
      </div>

      {/* 3. Token Usage Row (Exactly matching user screenshot 2) */}
      <div className="dshEzaiSidebarUsageRow">
        <span className="dshEzaiSidebarUsageUsed">
          {isZh ? '已消耗' : 'Used'}: <strong>{formatNumber(used)}</strong>
        </span>
        <span className="dshEzaiSidebarUsageQuota">
          {isZh ? '总额度' : 'Quota'}: <strong>{formatNumber(quota)}</strong> Tokens
        </span>
      </div>
    </div>
  )
}
