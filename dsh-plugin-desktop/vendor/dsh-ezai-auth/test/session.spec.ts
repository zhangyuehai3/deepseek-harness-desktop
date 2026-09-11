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
    const { updateServerTime, resetTrustedTimeForTesting } = await import('../src/trusted-time.ts')
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

    // Add usage during peak hours (Friday 10:00 AM Beijing time = UTC 02:00)
    updateServerTime('Fri, 11 Sep 2026 02:00:00 GMT')
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

  it('correctly calculates peak hours and 0.5x off-peak coefficient under Beijing time', async () => {
    const { isPeakHours, getTokenRateMultiplier, createSessionStore } = await import('../src/session.ts')
    const { updateServerTime, resetTrustedTimeForTesting } = await import('../src/trusted-time.ts')
    resetTrustedTimeForTesting()

    // 1. Test window boundaries in Beijing Time (UTC+8)
    // Monday (2026-09-07)
    // 08:59:59 Beijing time -> UTC 00:59:59 -> Off-peak
    const monBefore = new Date(Date.parse('2026-09-07T00:59:59Z'))
    assert.equal(isPeakHours(monBefore), false)
    assert.equal(getTokenRateMultiplier(monBefore), 0.5)

    // 09:00:00 Beijing time -> UTC 01:00:00 -> Morning peak
    const monPeak1Start = new Date(Date.parse('2026-09-07T01:00:00Z'))
    assert.equal(isPeakHours(monPeak1Start), true)
    assert.equal(getTokenRateMultiplier(monPeak1Start), 1.0)

    // 11:59:59 Beijing time -> UTC 03:59:59 -> Morning peak
    const monPeak1End = new Date(Date.parse('2026-09-07T03:59:59Z'))
    assert.equal(isPeakHours(monPeak1End), true)
    assert.equal(getTokenRateMultiplier(monPeak1End), 1.0)

    // 12:00:00 Beijing time -> UTC 04:00:00 -> Lunch off-peak
    const monLunch = new Date(Date.parse('2026-09-07T04:00:00Z'))
    assert.equal(isPeakHours(monLunch), false)
    assert.equal(getTokenRateMultiplier(monLunch), 0.5)

    // 13:59:59 Beijing time -> UTC 05:59:59 -> Lunch off-peak
    const monBeforePeak2 = new Date(Date.parse('2026-09-07T05:59:59Z'))
    assert.equal(isPeakHours(monBeforePeak2), false)
    assert.equal(getTokenRateMultiplier(monBeforePeak2), 0.5)

    // 14:00:00 Beijing time -> UTC 06:00:00 -> Afternoon peak
    const monPeak2Start = new Date(Date.parse('2026-09-07T06:00:00Z'))
    assert.equal(isPeakHours(monPeak2Start), true)
    assert.equal(getTokenRateMultiplier(monPeak2Start), 1.0)

    // 17:59:59 Beijing time -> UTC 09:59:59 -> Afternoon peak
    const monPeak2End = new Date(Date.parse('2026-09-07T09:59:59Z'))
    assert.equal(isPeakHours(monPeak2End), true)
    assert.equal(getTokenRateMultiplier(monPeak2End), 1.0)

    // 18:00:00 Beijing time -> UTC 10:00:00 -> Evening off-peak
    const monEvening = new Date(Date.parse('2026-09-07T10:00:00Z'))
    assert.equal(isPeakHours(monEvening), false)
    assert.equal(getTokenRateMultiplier(monEvening), 0.5)

    // Weekend (Saturday 2026-09-12 10:00:00 Beijing time -> UTC 02:00:00) -> Off-peak
    const satMorning = new Date(Date.parse('2026-09-12T02:00:00Z'))
    assert.equal(isPeakHours(satMorning), false)
    assert.equal(getTokenRateMultiplier(satMorning), 0.5)

    // Weekend (Sunday 2026-09-13 15:00:00 Beijing time -> UTC 07:00:00) -> Off-peak
    const sunAfternoon = new Date(Date.parse('2026-09-13T07:00:00Z'))
    assert.equal(isPeakHours(sunAfternoon), false)
    assert.equal(getTokenRateMultiplier(sunAfternoon), 0.5)

    // 2. Test actual token billing in store:
    const dir = await mkdtemp(join(tmpdir(), 'dsh-ezai-auth-rates-'))
    const store = createSessionStore({ sessionFile: join(dir, 'session.json'), tokensFile: join(dir, 'tokens.json') })
    await store.setUser({
      id: 'rate-user',
      name: 'RateUser',
      login_name: 'rate@example.com',
      avatar: '',
      gender: 1,
      birthday: 0,
      department_id: '',
      email: 'rate@example.com',
      surname_lable: '',
      user_phone: '',
      qrcode: '',
    })

    // Consume 10,000 tokens during peak hours (Monday 10:00 Beijing time -> UTC 02:00) -> 10,000 * 1.0 = 10,000
    updateServerTime('Mon, 07 Sep 2026 02:00:00 GMT')
    assert.equal(await store.isCurrentPeakHours(), true)
    assert.equal(await store.getTokenRateMultiplier(), 1.0)
    await store.addTokenUsage(10_000)
    assert.equal(await store.getTokenUsage(), 10_000)

    // Clock tampering protection: user changes local OS time to weekend off-peak while server time is peak (Wednesday 10:00 AM)
    updateServerTime('Wed, 09 Sep 2026 02:00:00 GMT')
    const savedDateNow = Date.now
    try {
      Date.now = () => Date.parse('2026-09-13T03:00:00Z') // Sunday (Off-peak)
      // Because server time anchor is active, peak determination uses server time (Wed 10:00 AM)
      assert.equal(await store.isCurrentPeakHours(), true)
      assert.equal(await store.getTokenRateMultiplier(), 1.0)
      await store.addTokenUsage(10_000)
      assert.equal(await store.getTokenUsage(), 20_000)
    } finally {
      Date.now = savedDateNow
    }

    // Consume 10,000 tokens during off-peak hours (Wednesday 12:30 Beijing time -> UTC 04:30) -> 10,000 * 0.5 = 5,000
    updateServerTime('Wed, 09 Sep 2026 04:30:00 GMT')
    assert.equal(await store.isCurrentPeakHours(), false)
    assert.equal(await store.getTokenRateMultiplier(), 0.5)
    await store.addTokenUsage(10_000)
    assert.equal(await store.getTokenUsage(), 25_000)

    // Consume 20,000 tokens during weekend off-peak (Saturday 11:00 Beijing time -> UTC 03:00) -> 20,000 * 0.5 = 10,000
    updateServerTime('Sat, 12 Sep 2026 03:00:00 GMT')
    assert.equal(await store.isCurrentPeakHours(), false)
    assert.equal(await store.getTokenRateMultiplier(), 0.5)
    await store.addTokenUsage(20_000)
    assert.equal(await store.getTokenUsage(), 35_000)

    resetTrustedTimeForTesting()
  })

  it('heals unroutable session model by automatically falling back to default model', async () => {
    let agentRequestHandler: any = null
    let llmStreamHandler: any = null

    const mockCtx: any = {
      on(event: string, handler: any) {
        if (event === 'agent/request') agentRequestHandler = handler
        if (event === 'llm/stream') llmStreamHandler = handler
      },
      get(name: string) {
        if (name === 'llm') {
          return {
            listProviders() {
              return [{ id: 'deepseek' }, { id: 'deepseek-anthropic' }]
            },
          }
        }
        return undefined
      },
      slots: { inject() {} },
      locale: { register() {} },
      inject() {},
      effect() {},
    }

    const { apply } = await import('../src/index.ts')
    const tmpDir = await mkdtemp(join(tmpdir(), 'dsh-ezai-auth-'))
    apply(mockCtx, { sessionStoreDir: tmpDir, tokenQuota: 200000 })

    assert.ok(agentRequestHandler, 'agent/request hook should be registered')
    assert.ok(llmStreamHandler, 'llm/stream hook should be registered')

    // 1. Test agent/request intercepts legacy kimi-coding
    const legacyRequested = { provider: 'kimi-coding', model: 'moonshot-v1-8k' }
    const result1 = await agentRequestHandler({}, async () => legacyRequested)
    assert.equal(result1.provider, 'deepseek')
    assert.equal(result1.model, 'deepseek-flash')

    // 2. Test agent/request intercepts unknown/unserved provider
    const unknownRequested = { provider: 'unknown-provider', model: 'unknown-model' }
    const result2 = await agentRequestHandler({}, async () => unknownRequested)
    assert.equal(result2.provider, 'deepseek')
    assert.equal(result2.model, 'deepseek-flash')

    // 3. Test agent/request strictly locks to deepseek-flash
    const validRequested = { provider: 'deepseek', model: 'deepseek-chat' }
    const result3 = await agentRequestHandler({}, async () => validRequested)
    assert.equal(result3.provider, 'deepseek')
    assert.equal(result3.model, 'deepseek-flash')

    // 4. Test agent/request seamlessly upgrades legacy deepseek-v4-flash to deepseek-flash
    const legacyModelRequested = { provider: 'deepseek', model: 'deepseek-v4-flash' }
    const result4 = await agentRequestHandler({}, async () => legacyModelRequested)
    assert.equal(result4.provider, 'deepseek')
    assert.equal(result4.model, 'deepseek-flash')

    const legacyVisionRequested = { provider: 'deepseek-anthropic', model: 'deepseek-v4-flash-vision-exp' }
    const result5 = await agentRequestHandler({}, async () => legacyVisionRequested)
    assert.equal(result5.provider, 'deepseek-anthropic')
    assert.equal(result5.model, 'deepseek-flash')
  })
})
