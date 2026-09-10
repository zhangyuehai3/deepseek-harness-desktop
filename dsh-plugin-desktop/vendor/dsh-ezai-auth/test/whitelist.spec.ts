import { describe, it } from 'node:test'
import assert from 'node:assert'
import { isUserAllowed, checkUserAllowed } from '../src/index.ts'

describe('dynamic whitelist verification', () => {
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
})
