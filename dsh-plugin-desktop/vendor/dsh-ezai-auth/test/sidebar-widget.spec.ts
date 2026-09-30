/** Unit tests for EzaiSidebarWidget and SessionMonitor. */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { formatNumber } from '../src/client/number-format.ts'
import { checkSessionStatus } from '../src/client/session-monitor.ts'

describe('EzaiSidebarWidget & SessionMonitor', () => {
  const originalFetch = globalThis.fetch
  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document

  let dispatchedEvents: Array<{ type: string; detail: any }> = []

  beforeEach(() => {
    dispatchedEvents = []
    ;(globalThis as any).window = {
      dispatchEvent: (e: any) => {
        dispatchedEvents.push({ type: e.type, detail: e.detail })
      },
    }
    ;(globalThis as any).document = {
      body: {
        appendChild: () => {},
      },
      createElement: () => ({ id: '', style: {}, appendChild: () => {} }),
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    ;(globalThis as any).window = originalWindow
    ;(globalThis as any).document = originalDocument
  })

  it('formatNumber formats numbers with thousand separators matching user screenshot', () => {
    assert.strictEqual(formatNumber(12960), '12,960')
    assert.strictEqual(formatNumber(200000000), '200,000,000')
    assert.strictEqual(formatNumber(0), '0')
    assert.strictEqual(formatNumber(undefined), '0')
    assert.strictEqual(formatNumber(null), '0')
    assert.strictEqual(formatNumber(NaN), '0')
  })

  it('checkSessionStatus updates account and dispatches account-updated event on 200 OK', async () => {
    const mockAccount = {
      user: { id: 'u1', login_name: 'test_user', name: '测试用户' },
      personalInfo: { name: '测试用户', department: '技术中心' },
      tokenUsage: { used: 12960, quota: 200000000 },
    }

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockAccount), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const fakeCtx: any = {
      locale: {
        getSnapshot: () => ({ active: 'zh' }),
      },
    }

    let locked = false
    const res = await checkSessionStatus(fakeCtx, true, {
      onSessionExpired: () => {
        locked = true
      },
    })

    assert.deepStrictEqual(res, mockAccount)
    assert.strictEqual(locked, false)
    assert.ok(dispatchedEvents.some(e => e.type === 'ezai-auth:account-updated'))
    assert.strictEqual((globalThis as any).window.__EZAI_LOGGED_IN__, true)
    assert.deepStrictEqual((globalThis as any).window.__EZAI_ACCOUNT__, mockAccount)
  })

  it('checkSessionStatus triggers session locking and logout event on 401 Unauthorized', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'session_expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })

    const fakeCtx: any = {
      locale: {
        getSnapshot: () => ({ active: 'zh' }),
      },
    }

    let locked = false
    const res = await checkSessionStatus(fakeCtx, true, {
      onSessionExpired: () => {
        locked = true
      },
    })

    assert.strictEqual(res, null)
    assert.strictEqual(locked, true)
    assert.ok(
      dispatchedEvents.some(
        e => e.type === 'ezai-auth:state-change' && e.detail?.loggedIn === false,
      ),
    )
    assert.strictEqual((globalThis as any).window.__EZAI_LOGGED_IN__, false)
  })

  it('checkSessionStatus triggers session locking and logout event on 403 Forbidden', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'not_whitelisted',
          departmentDisallowed: true,
          message: '未开放使用',
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      )

    const fakeCtx: any = {
      locale: {
        getSnapshot: () => ({ active: 'zh' }),
      },
    }

    let locked = false
    let disallowedNotice: any = null
    const res = await checkSessionStatus(fakeCtx, true, {
      onSessionExpired: () => {
        locked = true
      },
      onDisallowedDepartment: (payload) => {
        locked = true
        disallowedNotice = payload
      },
    })

    assert.strictEqual(res, null)
    assert.strictEqual(locked, true)
    assert.strictEqual(disallowedNotice?.departmentDisallowed, true)
    assert.ok(
      dispatchedEvents.some(
        e => e.type === 'ezai-auth:state-change' && e.detail?.loggedIn === false,
      ),
    )
  })
})
