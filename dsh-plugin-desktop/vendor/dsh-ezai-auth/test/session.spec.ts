/** Unit tests for dsh-ezai-auth session store. */

import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createSessionStore } from '../src/session.ts'

describe('session store', () => {
  it('persists cookies and user with restricted permissions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-ezai-auth-'))
    const sessionFile = join(dir, 'session.json')
    const store = createSessionStore({ sessionFile })

    const user = {
      id: '1',
      name: 'Test',
      login_name: 'test@example.com',
      avatar: '',
      gender: 1,
      birthday: 0,
      department_id: '',
      email: 'test@example.com',
      surname_lable: '',
      user_phone: '',
      qrcode: '',
    }

    await store.setCookies('XSRF-TOKEN=abc')
    await store.setUser(user)

    const snapshot = await store.getSnapshot()
    assert.equal(snapshot?.cookies, 'XSRF-TOKEN=abc')
    assert.equal(snapshot?.user.login_name, 'test@example.com')

    const stats = await stat(sessionFile)
    // File mode should be 0o600 (owner read/write only).
    assert.equal(stats.mode & 0o777, 0o600)

    await store.clear()
    const cleared = await store.getSnapshot()
    assert.equal(cleared, undefined)
  })

  it('anchors week and token usage to trusted server time and resists system time tampering', async () => {
    const { updateServerTime, resetTrustedTimeForTesting } = await import('../src/trusted-time.ts')
    resetTrustedTimeForTesting()

    const dir = await mkdtemp(join(tmpdir(), 'dsh-ezai-auth-tamper-'))
    const sessionFile = join(dir, 'session.json')
    const tokensFile = join(dir, 'account_tokens.json')
    const store = createSessionStore({ sessionFile, tokensFile })

    const user = {
      id: 'u-123',
      name: 'AntiTamper',
      login_name: 'tamper@example.com',
      avatar: '',
      gender: 1,
      birthday: 0,
      department_id: '',
      email: 'tamper@example.com',
      surname_lable: '',
      user_phone: '',
      qrcode: '',
    }
    await store.setUser(user)

    // 1. Simulate receiving authoritative server Date header: Tuesday, 08 Sep 2026
    updateServerTime('Tue, 08 Sep 2026 01:00:00 GMT')

    // Add 50,000 tokens
    await store.addTokenUsage(50_000)
    let usage = await store.getTokenUsage()
    assert.equal(usage, 50_000)

    // 2. Tamper local system clock forward to next week (2026-09-16)
    const originalDateNow = Date.now
    try {
      Date.now = () => Date.parse('2026-09-16T12:00:00Z')

      // Because server time anchor is active, local Date.now tampering MUST NOT reset tokens!
      usage = await store.getTokenUsage()
      assert.equal(usage, 50_000)

      // Consuming additional tokens still counts towards current week
      await store.addTokenUsage(2_000)
      usage = await store.getTokenUsage()
      assert.equal(usage, 52_000)

      // 3. Tamper local system clock backwards into the past (2026-08-01)
      Date.now = () => Date.parse('2026-08-01T12:00:00Z')
      usage = await store.getTokenUsage()
      assert.equal(usage, 52_000)
    } finally {
      Date.now = originalDateNow
    }

    // 4. Authoritative server time advances across weekly boundary (Monday, 14 Sep 2026)
    updateServerTime('Mon, 14 Sep 2026 01:00:00 GMT')
    usage = await store.getTokenUsage()
    // Tokens for the new week should naturally start at 0
    assert.equal(usage, 0)

    resetTrustedTimeForTesting()
  })

  it('prevents time rewind via persistent lastActiveTime even without server sync', async () => {
    const { resetTrustedTimeForTesting } = await import('../src/trusted-time.ts')
    resetTrustedTimeForTesting()

    const dir = await mkdtemp(join(tmpdir(), 'dsh-ezai-auth-offline-'))
    const sessionFile = join(dir, 'session.json')
    const tokensFile = join(dir, 'account_tokens.json')
    const store = createSessionStore({ sessionFile, tokensFile })

    const user = {
      id: 'u-456',
      name: 'OfflineUser',
      login_name: 'offline@example.com',
      avatar: '',
      gender: 1,
      birthday: 0,
      department_id: '',
      email: 'offline@example.com',
      surname_lable: '',
      user_phone: '',
      qrcode: '',
    }
    await store.setUser(user)

    // Add usage today
    await store.addTokenUsage(12_345)
    let usage = await store.getTokenUsage()
    assert.equal(usage, 12_345)

    // User maliciously rewinds OS clock to 2025
    const originalDateNow = Date.now
    try {
      Date.now = () => Date.parse('2025-01-01T00:00:00Z')
      // Monotonic guard prevents returning to 2025 week
      usage = await store.getTokenUsage()
      assert.equal(usage, 12_345)
    } finally {
      Date.now = originalDateNow
    }

    resetTrustedTimeForTesting()
  })
})
