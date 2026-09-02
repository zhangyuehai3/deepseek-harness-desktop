/** Mandatory EZAI login modal shown on startup when no session exists. */

import { useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EzaiAccountTab } from './EzaiAccountTab.tsx'
import { injectCss } from './styles.ts'
import { en, NS, zh } from './locales.ts'

const MODAL_MOUNT_ID = 'dsh-ezai-auth-login-modal'

export interface EzaiLoginModalProps {
  locale: 'zh' | 'en'
  onClose: () => void
}

function EzaiLoginModal({ locale, onClose }: EzaiLoginModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    injectCss()
    const timer = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    // Allow the fade-out animation to finish before unmounting.
    setTimeout(() => onClose(), 220)
  }, [onClose])

  const handleLogin = useCallback(() => {
    handleClose()
  }, [handleClose])

  // Support ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const dictionary = locale === 'zh' ? zh : en
  const t = (key: keyof typeof zh) => dictionary[key]

  return (
    <div
      className="dshEzaiAuthModalBackdrop"
      data-visible={visible ? 'true' : 'false'}
      onClick={handleClose}
    >
      <div
        className="dshEzaiAuthModal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsh-ezai-auth-login-title"
      >
        <button
          type="button"
          className="dshEzaiAuthCloseBtn"
          onClick={handleClose}
          aria-label={t('close')}
          title={t('close')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="dshEzaiAuthHeader">
          <div className="dshEzaiAuthLogo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 id="dsh-ezai-auth-login-title" className="dshEzaiAuthTitle">
            {t('loginTitle')}
          </h2>
          <p className="dshEzaiAuthSubtitle">
            {t('loginSubtitle')}
          </p>
        </div>

        <EzaiAccountTab t={t as never} onLogin={handleLogin} hideHeader={true} />
      </div>
    </div>
  )
}

/** Bootstrap a mandatory login modal. Returns a disposer that unmounts it. */
export function showEzaiLoginModal(locale: 'zh' | 'en'): () => void {
  let root: Root | undefined
  let container: HTMLElement | undefined

  const dispose = () => {
    if (root !== undefined) {
      root.unmount()
      root = undefined
    }
    if (container !== undefined && container.parentNode !== null) {
      container.parentNode.removeChild(container)
      container = undefined
    }
  }

  container = document.createElement('div')
  container.id = MODAL_MOUNT_ID
  document.body.appendChild(container)

  root = createRoot(container)
  root.render(<EzaiLoginModal locale={locale} onClose={dispose} />)

  return dispose
}

export { NS, zh, en }
