/**
 * Session Header Quote Utility Action (P1.2).
 * Contributes a button to the session header utilities slot to quote or copy this session reference.
 */
import React from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  copyMentionToClipboard,
  showRecallToast,
} from './session-reference-utils.ts'

export type SessionHeaderQuoteActionProps = PropsRuntime<'conversation.session.header.utilities'>

export function SessionHeaderQuoteAction({ sessionId, useSessions }: SessionHeaderQuoteActionProps): React.JSX.Element {
  const sessionTitle = useSessions(state => state.byId[sessionId]?.title) || sessionId

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    void copyMentionToClipboard(sessionId, sessionTitle)
    showRecallToast(`已复制会话「${sessionTitle}」引用，可直接粘贴到任意输入框`)
  }

  return (
    <button
      type="button"
      className="dsh-header-quote-btn"
      title="引用此会话（复制标准引用标记）"
      aria-label="引用此会话"
      onClick={handleClick}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path
          d="M6 3.5H3.5C2.67 3.5 2 4.17 2 5v2.5C2 8.33 2.67 9 3.5 9H5v1.5c0 1.1-.9 2-2 2H2.5v1.5H3c2.21 0 4-1.79 4-4V5c0-.83-.67-1.5-1.5-1.5zm8 0h-2.5c-.83 0-1.5.67-1.5 1.5v2.5c0 .83.67 1.5 1.5 1.5H13v1.5c0 1.1-.9 2-2 2h-.5v1.5h.5c2.21 0 4-1.79 4-4V5c0-.83-.67-1.5-1.5-1.5z"
          fill="currentColor"
        />
      </svg>
      <span>引用此会话</span>
    </button>
  )
}
