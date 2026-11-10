import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  isCommerceDepartment,
  isFinanceDepartment,
  isEastAsiaDepartment,
  isEuropeDepartment,
  getCommerceApiKey,
  getFinanceApiKey,
  getEastAsiaApiKey,
  getEuropeApiKey,
  getBootstrapApiKey,
  resolveApiKey,
} from '../src/vault.ts'
import {
  setActiveDepartment,
  getActiveDepartment,
  patchCredentialsService,
  patchLaunchEnvironment,
} from '../src/index.ts'

describe('Commerce, Finance, East Asia & Europe Departments dedicated DeepSeek API Keys', () => {
  it('correctly identifies departments', () => {
    // 商务部（金石易服/财务管理中心/商务部 独立专属 Key）
    assert.equal(isCommerceDepartment('金石易服/财务管理中心/商务部'), true)
    assert.equal(isCommerceDepartment('商务部'), true)
    assert.equal(isCommerceDepartment('公司/商务部/国际商务组'), true)
    assert.equal(isCommerceDepartment('财务管理中心'), false)
    assert.equal(isCommerceDepartment('东亚大区'), false)
    assert.equal(isCommerceDepartment(undefined), false)

    // 财务管理中心（排除商务部后使用财务专属 Key）
    assert.equal(isFinanceDepartment('财务管理中心'), true)
    assert.equal(isFinanceDepartment('公司/财务管理中心/会计组'), true)
    assert.equal(isFinanceDepartment('金石易服/财务管理中心/商务部'), false)
    assert.equal(isFinanceDepartment('商务部'), false)
    assert.equal(isFinanceDepartment('东亚大区'), false)
    assert.equal(isFinanceDepartment('欧洲大区'), false)
    assert.equal(isFinanceDepartment('聚服中心'), false)
    assert.equal(isFinanceDepartment(undefined), false)

    assert.equal(isEastAsiaDepartment('东亚大区'), true)
    assert.equal(isEastAsiaDepartment('公司/东亚大区/市场组'), true)
    assert.equal(isEastAsiaDepartment('财务管理中心'), false)
    assert.equal(isEastAsiaDepartment('欧洲大区'), false)
    assert.equal(isEastAsiaDepartment(undefined), false)

    assert.equal(isEuropeDepartment('欧洲大区'), true)
    assert.equal(isEuropeDepartment('公司/欧洲大区/商务组'), true)
    assert.equal(isEuropeDepartment('zhangyin@ezaigc.com'), true)
    assert.equal(isEuropeDepartment('zhangyin@ezsvs.com'), true)
    assert.equal(isEuropeDepartment('财务管理中心'), false)
    assert.equal(isEuropeDepartment('东亚大区'), false)
    assert.equal(isEuropeDepartment(undefined), false)
  })

  it('dedicated API keys match expected format and are mutually distinct', () => {
    const commerceKey = getCommerceApiKey()
    const financeKey = getFinanceApiKey()
    const eastAsiaKey = getEastAsiaApiKey()
    const europeKey = getEuropeApiKey()
    const defaultKey = getBootstrapApiKey('聚服中心')

    assert.equal(commerceKey, 'sk-dfb957ab39aa4c35860379d322f4784c')

    for (const key of [commerceKey, financeKey, eastAsiaKey, europeKey, defaultKey]) {
      assert.equal(typeof key, 'string')
      assert.equal(key.startsWith('sk-'), true)
      assert.equal(key.length, 35)
    }

    assert.notEqual(commerceKey, financeKey)
    assert.notEqual(commerceKey, defaultKey)
    assert.notEqual(commerceKey, eastAsiaKey)
    assert.notEqual(commerceKey, europeKey)
    assert.notEqual(financeKey, defaultKey)
    assert.notEqual(eastAsiaKey, defaultKey)
    assert.notEqual(europeKey, defaultKey)
    assert.notEqual(eastAsiaKey, europeKey)
    assert.notEqual(financeKey, eastAsiaKey)
    assert.notEqual(financeKey, europeKey)
  })

  it('getBootstrapApiKey returns dedicated keys for specific departments, default key for others', () => {
    const commerceKey1 = getBootstrapApiKey('金石易服/财务管理中心/商务部')
    const commerceKey2 = getBootstrapApiKey('商务部')
    const financeKey = getBootstrapApiKey('财务管理中心')
    const eastAsiaKey = getBootstrapApiKey('东亚大区')
    const europeKey = getBootstrapApiKey('欧洲大区')
    const defaultKey = getBootstrapApiKey('聚服中心')

    assert.equal(commerceKey1, getCommerceApiKey())
    assert.equal(commerceKey2, getCommerceApiKey())
    assert.equal(financeKey, getFinanceApiKey())
    assert.equal(eastAsiaKey, getEastAsiaApiKey())
    assert.equal(europeKey, getEuropeApiKey())
    assert.notEqual(commerceKey1, financeKey)
    assert.notEqual(financeKey, defaultKey)
    assert.notEqual(eastAsiaKey, defaultKey)
    assert.notEqual(europeKey, defaultKey)
  })

  it('resolveApiKey resolves dedicated keys for respective departments', async () => {
    const commerceResolved = await resolveApiKey('金石易服/财务管理中心/商务部')
    const financeResolved = await resolveApiKey('财务管理中心')
    const eastAsiaResolved = await resolveApiKey('东亚大区')
    const europeResolved = await resolveApiKey('欧洲大区')
    const defaultResolved = await resolveApiKey('销售中心')

    assert.equal(commerceResolved, getCommerceApiKey())
    assert.equal(financeResolved, getFinanceApiKey())
    assert.equal(eastAsiaResolved, getEastAsiaApiKey())
    assert.equal(europeResolved, getEuropeApiKey())
    assert.equal(defaultResolved, getBootstrapApiKey())
  })

  it('patchCredentialsService resolves dedicated key based on active department', async () => {
    const fakeCredentials: any = {
      resolve: async () => ({ value: 'original' }),
      describe: async () => ({ configured: true }),
    }
    patchCredentialsService(fakeCredentials)

    // When department is 金石易服/财务管理中心/商务部
    setActiveDepartment('金石易服/财务管理中心/商务部')
    const commerceCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(commerceCred.value, getCommerceApiKey())

    // When department is 财务管理中心
    setActiveDepartment('财务管理中心')
    const financeCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(financeCred.value, getFinanceApiKey())

    // When department is 东亚大区
    setActiveDepartment('东亚大区')
    const eastAsiaCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(eastAsiaCred.value, getEastAsiaApiKey())

    // When department is 欧洲大区
    setActiveDepartment('欧洲大区')
    const europeCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(europeCred.value, getEuropeApiKey())

    // When department is 聚服中心
    setActiveDepartment('聚服中心')
    const defaultCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(defaultCred.value, getBootstrapApiKey())

    // Reset
    setActiveDepartment(undefined)
  })

  it('patchLaunchEnvironment injects dedicated key into process environment', () => {
    const fakeEnv: any = {
      get: () => undefined,
      getFrom: () => undefined,
    }
    patchLaunchEnvironment(fakeEnv)

    setActiveDepartment('金石易服/财务管理中心/商务部')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('金石易服/财务管理中心/商务部')
    const commerceResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(commerceResult.value, getCommerceApiKey())

    setActiveDepartment('财务管理中心')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('财务管理中心')
    const financeResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(financeResult.value, getFinanceApiKey())

    setActiveDepartment('东亚大区')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('东亚大区')
    const eastAsiaResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(eastAsiaResult.value, getEastAsiaApiKey())

    setActiveDepartment('欧洲大区')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('欧洲大区')
    const europeResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(europeResult.value, getEuropeApiKey())

    setActiveDepartment('聚服中心')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('聚服中心')
    const defaultResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(defaultResult.value, getBootstrapApiKey())

    setActiveDepartment(undefined)
  })
})
