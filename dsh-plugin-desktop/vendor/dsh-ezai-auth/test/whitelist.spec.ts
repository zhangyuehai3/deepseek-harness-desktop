import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { isUserAllowed, checkUserAllowed, resolveUserTokenQuota, clearWhitelistCache } from '../src/index.ts'

const FIXTURE_WHITELIST = {
  聚服中心: 'all',
  国际运营中心: [
    { name: '裘恺', email: 'qiukai@ezaigc.com' },
  ],
  战略部: [],
  财务管理中心: [
    {
      name: '王小龙',
      email: 'wangxiaolong03@ezaigc.com',
      tokenQuota: 400000000,
    },
    {
      name: '闫肃',
      email: 'yansu@ezaigc.com',
    },
  ],
}

describe('dynamic whitelist verification', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearWhitelistCache()
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => JSON.parse(JSON.stringify(FIXTURE_WHITELIST)),
    } as any)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearWhitelistCache()
  })

  it('allows user whose department is configured with all (e.g. 聚服中心)', async () => {
    const allowed = await isUserAllowed(
      { name: '普通员工', email: 'user@ezaigc.com' },
      { department: '聚服中心' },
    )
    assert.equal(allowed, true)

    const check = await checkUserAllowed(
      { name: '普通员工', email: 'user@ezaigc.com' },
      { department: '聚服中心' },
    )
    assert.equal(check.allowed, true)
  })

  it('allows user explicitly listed in individual department whitelist (e.g. 裘恺 qiukai@ezaigc.com)', async () => {
    // Match by email
    const allowedByEmail = await isUserAllowed(
      { name: '测试用户', email: 'qiukai@ezaigc.com' },
      { department: '国际运营中心' },
    )
    assert.equal(allowedByEmail, true)

    // Match by case-insensitive email
    const allowedByUpperEmail = await isUserAllowed(
      { name: '测试用户', email: 'QiuKai@EZAIGC.COM' },
      { department: '国际运营中心' },
    )
    assert.equal(allowedByUpperEmail, true)

    // Match by name
    const allowedByName = await isUserAllowed(
      { name: '裘恺', email: 'other@ezaigc.com' },
      { department: '国际运营中心' },
    )
    assert.equal(allowedByName, true)
  })

  it('rejects user when department is empty list [] and provides departmental notice for modal', async () => {
    const check = await checkUserAllowed(
      { name: '张三', email: 'zhangsan@ezaigc.com' },
      { department: '战略部' },
    )
    assert.equal(check.allowed, false)
    assert.equal(check.reason, 'not_whitelisted')
    assert.ok(check.message?.includes('定向内测'))
  })

  it('rejects user from unconfigured or unknown department', async () => {
    const check = await checkUserAllowed(
      { name: '李四', email: 'lisi@ezaigc.com' },
      { department: '未知部门' },
    )
    assert.equal(check.allowed, false)
    assert.equal(check.reason, 'not_whitelisted')
  })

  it('resolves tokenQuota: returns custom quota when present, defaults to 200,000,000 when absent', async () => {
    // For currently listed member without custom tokenQuota (e.g. 闫肃), defaults to 200M
    const defaultQuota = await resolveUserTokenQuota(
      { name: '闫肃', email: 'yansu@ezaigc.com' },
      { department: '财务管理中心' },
    )
    assert.equal(defaultQuota, 200_000_000)

    // For user from department "all", defaults to 200M
    const deptAllQuota = await resolveUserTokenQuota(
      { name: '普通员工', email: 'user@ezaigc.com' },
      { department: '聚服中心' },
    )
    assert.equal(deptAllQuota, 200_000_000)
  })

  it('correctly reads custom tokenQuota (e.g. 400,000,000) from member configuration', async () => {
    const check = await checkUserAllowed(
      { name: '王小龙', email: 'wangxiaolong03@ezaigc.com' },
      { department: '财务管理中心' },
    )
    assert.equal(check.allowed, true)
    assert.equal(check.tokenQuota, 400_000_000)

    const quota = await resolveUserTokenQuota(
      { name: '王小龙', email: 'wangxiaolong03@ezaigc.com' },
      { department: '财务管理中心' },
    )
    assert.equal(quota, 400_000_000)

    // Member without tokenQuota in same department gets default 200,000,000
    const quotaDefault = await resolveUserTokenQuota(
      { name: '闫肃', email: 'yansu@ezaigc.com' },
      { department: '财务管理中心' },
    )
    assert.equal(quotaDefault, 200_000_000)
  })
})

