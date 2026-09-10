/**
 * Warm and polite notice dialog shown when the user's department is outside '聚服中心'.
 */

import { useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { injectCss } from './styles.ts'

const NOTICE_MODAL_MOUNT_ID = 'dsh-ezai-auth-department-notice-modal'

export interface DepartmentNoticeModalProps {
  title?: string
  message?: string
  onClose: () => void
}

export function DepartmentNoticeModal({ title, message, onClose }: DepartmentNoticeModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    injectCss()
    const timer = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(() => onClose(), 220)
  }, [onClose])

  // Support ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const defaultMsg =
    '亲爱的同事，您好：\n\n十分感谢您对 EZAI 桌面智能助手的关注与支持！\n目前本体验版本专为【聚服中心】进行深度业务定制与专项定向内测，暂未面向其他部门开放使用。\n\n研发团队正在紧锣密鼓地推进跨业务线的适配与功能升级，后续更多部门的开放已在紧密排期中，敬请期待！\n\n为保障您的数据安全与系统状态一致，系统已为您安全退出登录并已清除本地配置。感谢您的理解与温暖包容！'

  const displayMsg = message || defaultMsg

  return (
    <div
      className="dshEzaiAuthModalBackdrop"
      data-visible={visible ? 'true' : 'false'}
      style={{ zIndex: 1000001 }}
      onClick={handleClose}
    >
      <div
        className="dshEzaiAuthModal"
        style={{
          width: 'min(460px, 92vw)',
          padding: '28px 26px 24px',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {/* Soft Close Icon */}
        <button
          type="button"
          className="dshEzaiAuthCloseBtn"
          onClick={handleClose}
          aria-label="关闭"
          title="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Warm Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(38, 92, 90, 0.12) 0%, rgba(152, 196, 85, 0.18) 100%)',
            border: '1px solid rgba(152, 196, 85, 0.35)',
            boxShadow: '0 8px 18px -4px rgba(38, 92, 90, 0.15)',
            color: '#265C5A',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--dsw-alias-label-primary, #153332)',
            letterSpacing: '-0.01em',
          }}
        >
          {title || '体验阶段温馨提示'}
        </h3>

        {/* Message Container */}
        <div
          style={{
            margin: '14px 0 20px',
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.035))',
            border: '1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.12))',
            fontSize: '13.5px',
            lineHeight: '1.65',
            color: 'var(--dsw-alias-label-secondary, #436160)',
            textAlign: 'left',
            whiteSpace: 'pre-line',
          }}
        >
          {displayMsg}
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          className="dshEzaiAuthSubmit"
          style={{ marginTop: '0', height: '42px', fontSize: '14.5px' }}
          onClick={handleClose}
        >
          我知道了
        </button>
      </div>
    </div>
  )
}

/** Show the department restriction notice modal dynamically. */
export function showDepartmentNoticeModal(message?: string, onConfirm?: () => void, title?: string): () => void {
  // Remove any existing one first
  const existing = document.getElementById(NOTICE_MODAL_MOUNT_ID)
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing)
  }

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
    onConfirm?.()
  }

  container = document.createElement('div')
  container.id = NOTICE_MODAL_MOUNT_ID
  document.body.appendChild(container)

  root = createRoot(container)
  root.render(<DepartmentNoticeModal title={title} message={message} onClose={dispose} />)

  return dispose
}
