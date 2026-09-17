import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import {
  copyMentionToClipboard,
  insertMentionToCurrentComposer,
} from './session-reference-utils.ts'

function SearchIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
      <path d="M11.895 6.647C11.895 3.725 9.534 1.357 6.623 1.357 3.712 1.357 1.352 3.725 1.352 6.647c0 2.922 2.36 5.291 5.271 5.291 2.911 0 5.272-2.369 5.272-5.291zm1.35 0c0 3.67-2.965 6.646-6.622 6.646-3.658 0-6.623-2.975-6.623-6.646 0-3.671 2.965-6.647 6.623-6.647 3.657 0 6.622 2.976 6.622 6.647z" fill="currentColor" />
      <path d="M16 15.041l-.956.96-3.514-3.527.956-.96L16 15.041z" fill="currentColor" />
    </svg>
  )
}

function CopyIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h7a2 2 0 012 2v1H5a2 2 0 00-2 2v7H2a2 2 0 01-2-2V4a2 2 0 012-2h2zm2 4h8a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" fill="currentColor" />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" fill="currentColor" />
    </svg>
  )
}

export interface SessionPickerModalProps {
  readonly ctx: ClientContext
  readonly onClose: () => void
}

interface SessionItem {
  id: string
  title: string
  updatedAt: number
  cwd?: string
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 30) return `${diffDays} 天前`
  return new Date(timestamp).toLocaleDateString()
}

export function SessionPickerModal({ ctx, onClose }: SessionPickerModalProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch session items
  const allSessions: SessionItem[] = useMemo(() => {
    try {
      const listSnapshot = (ctx as any).sessions?.list?.getSnapshot?.()
      if (!listSnapshot?.byId) return []

      const items: SessionItem[] = Object.entries<any>(listSnapshot.byId)
        .map(([id, s]) => ({
          id,
          title: (s?.title && s.title.trim()) || id,
          updatedAt: s?.updatedAt || 0,
          cwd: s?.cwd,
        }))
        .filter(s => s.title !== '')

      items.sort((a, b) => b.updatedAt - a.updatedAt)
      return items
    } catch {
      return []
    }
  }, [ctx])

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allSessions
    return allSessions.filter(
      s => s.title.toLowerCase().includes(q) || (s.cwd && s.cwd.toLowerCase().includes(q)),
    )
  }, [allSessions, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current
    if (!listEl) return
    const selectedEl = listEl.children[selectedIndex] as HTMLElement | undefined
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (session: SessionItem) => {
    insertMentionToCurrentComposer(ctx, session.id, session.title)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(idx => (idx + 1 < filteredSessions.length ? idx + 1 : idx))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(idx => (idx > 0 ? idx - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filteredSessions[selectedIndex]
      if (item) {
        handleSelect(item)
      }
    }
  }

  return (
    <div className="dsh-session-picker-overlay" onPointerDown={onClose}>
      <div
        className="dsh-session-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="引用历史会话"
        onPointerDown={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="dsh-session-picker-header">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className="dsh-session-picker-input"
            placeholder="搜索要引用的历史会话标题或目录... (↑↓ 选择，Enter 插入)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="dsh-session-picker-btn"
            style={{ padding: '4px', display: 'flex', alignItems: 'center' }}
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div ref={listRef} className="dsh-session-picker-list" role="listbox">
          {filteredSessions.length === 0 ? (
            <div className="dsh-session-picker-empty">
              {query ? '未找到匹配的会话' : '暂无历史会话'}
            </div>
          ) : (
            filteredSessions.map((session, index) => {
              const isSelected = index === selectedIndex
              return (
                <div
                  key={session.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`dsh-session-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(session)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="dsh-session-picker-item-left">
                    <span className="dsh-session-picker-item-title">{session.title}</span>
                    <div className="dsh-session-picker-item-meta">
                      {session.updatedAt > 0 && <span>{formatRelativeTime(session.updatedAt)}</span>}
                      {session.cwd && <span>· {session.cwd}</span>}
                    </div>
                  </div>

                  <div className="dsh-session-picker-item-actions">
                    <button
                      type="button"
                      className="dsh-session-picker-btn"
                      title="复制引用标记"
                      onClick={e => {
                        e.stopPropagation()
                        void copyMentionToClipboard(session.id, session.title)
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <CopyIcon />
                        复制
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dsh-session-picker-btn"
                      title="插入引用到当前输入框"
                      onClick={e => {
                        e.stopPropagation()
                        handleSelect(session)
                      }}
                    >
                      引用
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="dsh-session-picker-footer">
          <span>按 ↑ / ↓ 选择，Enter 立即插入引用到当前输入框</span>
          <span>按 ESC 退出</span>
        </div>
      </div>
    </div>
  )
}
