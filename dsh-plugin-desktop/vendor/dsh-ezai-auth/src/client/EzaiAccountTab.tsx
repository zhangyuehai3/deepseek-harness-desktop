/** EZAI account tab rendered inside Settings → Plugins and inside EzaiLoginModal. */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AccountResponse, CaptchaResponse } from '../types.ts'

import { showDepartmentNoticeModal } from './DepartmentNoticeModal.tsx'

export interface EzaiAccountTabProps extends PropsLocale<'ezai-auth'> {
  /** Optional callback fired once after a successful login. */
  onLogin?: (user: AccountResponse['user']) => void
  /** If true, the embedded header is hidden (e.g. when hosted inside a modal). */
  hideHeader?: boolean
}

interface LoginForm {
  username: string
  password: string
  captcha: string
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

function parseBackendError(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const msg = parsed.message ?? parsed.error ?? parsed.msg
    if (typeof msg === 'string' && msg.trim() !== '') return msg
  } catch {
    // ignore parse error
  }
  return undefined
}

function maskPhone(phone: string | undefined): string {
  if (!phone) return '—'
  const clean = phone.trim()
  if (clean.length === 11) {
    return `${clean.slice(0, 3)} **** ${clean.slice(7)}`
  }
  if (clean.length > 7) {
    return `${clean.slice(0, 3)} **** ${clean.slice(-4)}`
  }
  return clean
}

export function EzaiAccountTab({ t, onLogin, hideHeader = false }: EzaiAccountTabProps) {
  const [captcha, setCaptcha] = useState<CaptchaResponse | undefined>(undefined)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [form, setForm] = useState<LoginForm>({ username: '', password: '', captcha: '' })
  const [account, setAccount] = useState<AccountResponse | undefined>(undefined)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [captchaError, setCaptchaError] = useState<string | undefined>(undefined)

  const fetchAccount = useCallback(async () => {
    try {
      const response = await fetch('/api/ezai-auth/account', { headers: { accept: 'application/json' } })
      if (response.status === 401 || response.status === 403) {
        setAccount(undefined)
        return
      }
      if (!response.ok) {
        const text = await response.text()
        const backend = parseBackendError(text)
        throw new Error(backend ?? `account request failed (${response.status})`)
      }
      const payload = (await response.json()) as AccountResponse
      setAccount(payload)
    } catch {
      setAccount(undefined)
    }
  }, [])

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    try {
      const response = await fetch('/api/ezai-auth/captcha', { headers: { accept: 'application/json' } })
      if (!response.ok) {
        const text = await response.text()
        const backend = parseBackendError(text)
        throw new Error(backend ?? `captcha request failed (${response.status})`)
      }
      const payload = (await response.json()) as CaptchaResponse
      setCaptcha(payload)
      setCaptchaError(undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('networkError'))
      setCaptcha(undefined)
    } finally {
      setCaptchaLoading(false)
    }
  }, [t])

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const response = await fetch('/api/ezai-auth/account', { headers: { accept: 'application/json' } })
        if (response.status === 403) {
          const payload = (await response.json().catch(() => ({}))) as any
          if (payload.departmentDisallowed) {
            if (active) {
              setAccount(undefined)
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
              }
              showDepartmentNoticeModal(payload.message)
              void fetchCaptcha()
            }
            return
          }
        }
        if (response.status === 401) {
          if (active) {
            setAccount(undefined)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
            }
            void fetchCaptcha()
          }
          return
        }
        if (response.ok) {
          const payload = (await response.json()) as AccountResponse
          if (active) {
            setAccount(payload)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: true, user: payload.user } }))
            }
          }
        } else {
          if (active) {
            setAccount(undefined)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
            }
            void fetchCaptcha()
          }
        }
      } catch {
        if (active) {
          setAccount(undefined)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
          }
          void fetchCaptcha()
        }
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [fetchCaptcha])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (captcha === undefined) return
    setLoading(true)
    setError(undefined)
    setCaptchaError(undefined)
    try {
      const response = await fetch('/api/ezai-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          captcha: form.captcha,
          cookies: captcha.cookies,
        }),
      })
      const payload = (await response.json()) as {
        status_code?: number
        message?: string
        error?: string
        departmentDisallowed?: boolean
        user?: AccountResponse['user']
      }

      if (response.status === 403 || payload.departmentDisallowed) {
        showDepartmentNoticeModal(payload.message)
        setForm((previous) => ({ ...previous, password: '', captcha: '' }))
        void fetchCaptcha()
        return
      }

      if (!response.ok || payload.status_code !== 200 || payload.user === undefined) {
        throw new Error(payload.message ?? payload.error ?? t('networkError'))
      }
      await fetchAccount()
      setForm({ username: '', password: '', captcha: '' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: true, user: payload.user } }))
      }
      onLogin?.(payload.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Captcha failures are shown directly under the captcha field, matching
      // the EZSVS_BOX web login layout.
      if (/验证码/.test(message)) {
        setCaptchaError(message)
      } else {
        setError(t('loginFailed').replace('{{message}}', message))
      }
      setForm((previous) => ({ ...previous, captcha: '' }))
      void fetchCaptcha()
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/ezai-auth/logout', { method: 'POST' })
      setAccount(undefined)
      void fetchCaptcha()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ezai-auth:state-change', { detail: { loggedIn: false } }))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('networkError'))
    }
  }

  const updateField = (field: keyof LoginForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (error !== undefined) setError(undefined)
    if (captchaError !== undefined) setCaptchaError(undefined)
    setForm((previous) => ({ ...previous, [field]: event.target.value }))
  }

  const [copiedKey, setCopiedKey] = useState<string | undefined>(undefined)

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return
    try {
      void navigator.clipboard?.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(undefined), 1500)
    } catch {
      // ignore clipboard write failure
    }
  }

  // 1. Initial probing state — show loading spinner instead of flashing login form
  if (checkingSession) {
    return (
      <div className="dshEzaiAuthLoadingState">
        <div className="dshEzaiAuthSpinner" style={{ width: '24px', height: '24px', borderWidth: '2.5px' }} />
        <span style={{ fontSize: '13px', color: 'var(--dsw-alias-label-secondary, #587372)' }}>
          {t('checkingSession')}
        </span>
      </div>
    )
  }

  // 2. Logged In State
  if (account !== undefined) {
    const quota = account.tokenUsage.quota
    const used = account.tokenUsage.used
    const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
    const user = account.user
    const personalInfo = account.personalInfo

    const displayName = personalInfo?.name || user.name || user.surname_lable || user.login_name
    const avatarInitial = (personalInfo?.name ? personalInfo.name.slice(-2) : undefined) || user.surname_lable || (user.name ? user.name.slice(-2) : user.login_name.charAt(0).toUpperCase())
    const avatarUrl = personalInfo?.avatar || user.avatar

    return (
      <div className="dshEzaiAuthAccountCard">
        {/* User Hero Banner */}
        <div className="dshEzaiProfileHero">
          <div className="dshEzaiProfileUser">
            <div className="dshEzaiAvatarWrap">
              {avatarUrl ? (
                <img className="dshEzaiAvatarImg" src={avatarUrl} alt={displayName} />
              ) : (
                <div className="dshEzaiAvatarFallback">{avatarInitial}</div>
              )}
              <div className="dshEzaiStatusDot" title="Active" />
            </div>
            <div className="dshEzaiProfileMeta">
              <div className="dshEzaiNameRow">
                <span className="dshEzaiUserName">{displayName}</span>
                <span className="dshEzaiVerifiedChip">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('verifiedUser')}
                </span>
              </div>
              <div className="dshEzaiLoginAccount">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#7a9493' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>{user.login_name}</span>
              </div>
            </div>
          </div>
          <button type="button" className="dshEzaiLogoutActionBtn" onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{t('logout')}</span>
          </button>
        </div>

        {/* User Info Grid: 办公电话、岗位、所属部门、工作地点 这四个 */}
        <div className="dshEzaiInfoGrid">
          {/* 1. 办公电话 */}
          <div className="dshEzaiInfoTile">
            <div className="dshEzaiTileHeader">
              <div className="dshEzaiTileLabelWithIcon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#265C5A' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{t('workPhone')}</span>
              </div>
            </div>
            <div className="dshEzaiTileValue" title={personalInfo?.tel_phone || personalInfo?.user_phone || user.user_phone}>
              {maskPhone(personalInfo?.tel_phone || personalInfo?.user_phone || user.user_phone)}
            </div>
          </div>

          {/* 2. 岗位 */}
          <div className="dshEzaiInfoTile">
            <div className="dshEzaiTileHeader">
              <div className="dshEzaiTileLabelWithIcon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#265C5A' }}>
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>{t('post')}</span>
              </div>
            </div>
            <div className="dshEzaiTileValue" title={personalInfo?.post || '—'}>
              {personalInfo?.post || '—'}
            </div>
          </div>

          {/* 3. 所属部门 */}
          <div className="dshEzaiInfoTile">
            <div className="dshEzaiTileHeader">
              <div className="dshEzaiTileLabelWithIcon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#265C5A' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>{t('department')}</span>
              </div>
            </div>
            <div className="dshEzaiTileValue" title={personalInfo?.department || '—'}>
              {personalInfo?.department || '—'}
            </div>
          </div>

          {/* 4. 工作地点 */}
          <div className="dshEzaiInfoTile">
            <div className="dshEzaiTileHeader">
              <div className="dshEzaiTileLabelWithIcon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#265C5A' }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{t('location')}</span>
              </div>
            </div>
            <div className="dshEzaiTileValue" title={personalInfo?.location || '—'}>
              {personalInfo?.location || '—'}
            </div>
          </div>
        </div>

        {/* Token Usage Card */}
        <div className="dshEzaiTokenCard">
          <div className="dshEzaiTokenHead">
            <div className="dshEzaiTokenLabel">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#265C5A' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{t('tokenUsage')}</span>
              <span className="dshEzaiWeeklyTag">{t('weeklyResetHint')}</span>
            </div>
            <span className="dshEzaiTokenVal">{percent}%</span>
          </div>
          <div className="dshEzaiProgressBar">
            <div className="dshEzaiProgressFill" style={{ width: `${percent}%` }} />
          </div>
          <div className="dshEzaiTokenFoot">
            <span>{t('tokenUsed')}: <strong>{formatNumber(used)}</strong></span>
            <span>{t('tokenQuota')}: <strong>{formatNumber(quota)}</strong> {t('tokenUnit')}</span>
          </div>
        </div>

        {account.warning && (
          <div style={{ fontSize: '12px', color: '#7a9493', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{account.warning}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <form className="dshEzaiAuthForm" onSubmit={handleLogin}>
      {!hideHeader && (
        <div style={{ marginBottom: '8px' }}>
          <h3 className="dshEzaiAuthTitle" style={{ fontSize: '17px' }}>{t('title')}</h3>
          <p className="dshEzaiAuthSubtitle">{t('intro')}</p>
        </div>
      )}

      <label className="dshEzaiAuthField">
        <span className="dshEzaiAuthLabel">{t('username')}</span>
        <div className="dshEzaiAuthInputWrap">
          <span className="dshEzaiAuthInputIcon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <input
            className="dshEzaiAuthInput"
            type="text"
            value={form.username}
            onChange={updateField('username')}
            placeholder={t('usernamePlaceholder')}
            autoComplete="username"
            disabled={loading}
            required
          />
        </div>
      </label>

      <label className="dshEzaiAuthField">
        <span className="dshEzaiAuthLabel">{t('password')}</span>
        <div className="dshEzaiAuthInputWrap">
          <span className="dshEzaiAuthInputIcon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <input
            className="dshEzaiAuthInput"
            type="password"
            value={form.password}
            onChange={updateField('password')}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
            disabled={loading}
            required
          />
        </div>
      </label>

      <label className="dshEzaiAuthField">
        <span className="dshEzaiAuthLabel">{t('captcha')}</span>
        <div className="dshEzaiAuthCaptchaRow">
          <div className="dshEzaiAuthInputWrap dshEzaiAuthCaptchaWrap">
            <span className="dshEzaiAuthInputIcon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <input
              className="dshEzaiAuthInput"
              type="text"
              value={form.captcha}
              onChange={updateField('captcha')}
              placeholder={t('captchaPlaceholder')}
              disabled={loading}
              required
            />
          </div>

          <div
            className="dshEzaiAuthCaptchaBox"
            onClick={fetchCaptcha}
            title={t('refreshHint')}
            role="button"
            tabIndex={0}
          >
            {captchaLoading ? (
              <span className="dshEzaiAuthCaptchaLoading">
                <div className="dshEzaiAuthSpinner" style={{ width: '12px', height: '12px', borderColor: 'rgba(38,92,90,0.25)', borderTopColor: '#98C455' }} />
                <span>{t('refreshCaptcha')}</span>
              </span>
            ) : captcha !== undefined ? (
              <img
                className="dshEzaiAuthCaptchaImg"
                src={captcha.imageBase64}
                alt={t('captcha')}
              />
            ) : (
              <span className="dshEzaiAuthCaptchaLoading">{t('refreshCaptcha')}</span>
            )}
          </div>
        </div>
        {captchaError !== undefined && (
          <div className="dshEzaiAuthCaptchaError" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{captchaError}</span>
          </div>
        )}
      </label>

      {error !== undefined && (
        <div className="dshEzaiAuthErrorBanner" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="dshEzaiAuthSubmit"
        disabled={loading || captcha === undefined}
      >
        {loading && <span className="dshEzaiAuthSpinner" />}
        <span>{loading ? t('loggingIn') : t('login')}</span>
      </button>
    </form>
  )
}
