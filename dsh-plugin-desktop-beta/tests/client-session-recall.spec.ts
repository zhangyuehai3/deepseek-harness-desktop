import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  encodeSessionReferenceUri,
  escapeMentionLabel,
  formatSessionReferenceMention,
  insertMentionToCurrentComposer,
  SESSION_REFERENCE_SCHEME,
} from '../src/client/session-reference-utils.ts'
import { SessionHeaderQuoteAction } from '../src/client/SessionHeaderQuoteAction.tsx'
import { installSessionSidebarInteractions } from '../src/client/session-sidebar-interactions.ts'
import { installSessionPickerService } from '../src/client/session-picker-service.ts'

describe('client cross-session recall utilities', () => {
  it('encodes session reference URI with canonical scheme and base64url', () => {
    const sessionId = 'session-test-123'
    const uri = encodeSessionReferenceUri(sessionId)
    expect(uri.startsWith(SESSION_REFERENCE_SCHEME)).toBe(true)

    const payload = uri.slice(SESSION_REFERENCE_SCHEME.length)
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    expect(decoded).toBe(sessionId)
  })

  it('escapes brackets in labels correctly', () => {
    expect(escapeMentionLabel('test')).toBe('test')
    expect(escapeMentionLabel('test [foo] bar')).toBe('test [foo\\] bar')
  })

  it('formats session reference mention as markdown chip', () => {
    const sessionId = 'sess-456'
    const mention = formatSessionReferenceMention(sessionId, 'My Research [Plan]')
    expect(mention.startsWith('@[My Research [Plan\\]](')).toBe(true)
    expect(mention.includes(SESSION_REFERENCE_SCHEME)).toBe(true)
    expect(mention.endsWith(')')).toBe(true)
  })

  it('renders SessionHeaderQuoteAction button', () => {
    const fakeUseSessions = vi.fn().mockReturnValue('My Session Title')
    const html = renderToStaticMarkup(
      createElement(SessionHeaderQuoteAction, {
        sessionId: 'test-sess-id',
        useSessions: fakeUseSessions,
      } as any),
    )

    expect(html).toContain('dsh-header-quote-btn')
    expect(html).toContain('引用此会话')
  })

  it('installs and uninstalls sidebar interactions safely in headless mode', () => {
    const fakeCtx = {
      sessions: {
        list: {
          getSnapshot: () => ({ byId: {}, current: undefined }),
        },
      },
    } as any

    const dispose = installSessionSidebarInteractions(fakeCtx)
    expect(typeof dispose).toBe('function')
    dispose()
  })

  it('installs and uninstalls session picker service safely', () => {
    const fakeCtx = {
      inject: vi.fn(),
    } as any

    const dispose = installSessionPickerService(fakeCtx)
    expect(typeof dispose).toBe('function')
    dispose()
  })

  it('inserts atomic reference chip into shell when insertReference is supported', () => {
    const insertRefMock = vi.fn().mockReturnValue(true)
    const caretSpanMock = vi.fn().mockReturnValue({ start: 3, end: 3 })
    const pasteMock = vi.fn()

    const fakeCtx = {
      sessions: {
        list: {
          getSnapshot: () => ({ byId: {}, current: 'curr-sess-1' }),
        },
      },
      conversation: {
        input: {
          shell: (id: string) => {
            if (id === 'curr-sess-1') {
              return {
                snapshot: { draftRev: 5 },
                caretSpan: caretSpanMock,
                insertReference: insertRefMock,
                paste: pasteMock,
              }
            }
            return null
          },
        },
      },
    } as any

    const inserted = insertMentionToCurrentComposer(fakeCtx, 'target-sess-999', 'Target Session')
    expect(inserted).toBe(true)
    expect(insertRefMock).toHaveBeenCalledTimes(1)
    expect(insertRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'reference',
        label: 'Target Session',
        appearance: 'session',
        ref: expect.stringContaining(SESSION_REFERENCE_SCHEME),
        clipboardText: expect.stringContaining(SESSION_REFERENCE_SCHEME),
      }),
      {
        start: 3,
        end: 3,
        draftRev: 5,
      },
    )
    expect(pasteMock).not.toHaveBeenCalled()
  })

  it('falls back to shell paste when insertReference returns false', () => {
    const insertRefMock = vi.fn().mockReturnValue(false)
    const pasteMock = vi.fn()

    const fakeCtx = {
      sessions: {
        list: {
          getSnapshot: () => ({ byId: {}, current: 'curr-sess-2' }),
        },
      },
      conversation: {
        input: {
          shell: () => ({
            snapshot: { draftRev: 1 },
            caretSpan: () => ({ start: 0, end: 0 }),
            insertReference: insertRefMock,
            paste: pasteMock,
          }),
        },
      },
    } as any

    const inserted = insertMentionToCurrentComposer(fakeCtx, 'target-sess-888', 'Fallback Session')
    expect(inserted).toBe(true)
    expect(insertRefMock).toHaveBeenCalledTimes(1)
    expect(pasteMock).toHaveBeenCalledTimes(1)
  })
})

