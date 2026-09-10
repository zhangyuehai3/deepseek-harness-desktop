import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  isFinanceDepartment,
  getFinanceApiKey,
  getBootstrapApiKey,
  resolveApiKey,
} from '../src/vault.ts'
import {
  setActiveDepartment,
  getActiveDepartment,
  patchCredentialsService,
  patchLaunchEnvironment,
} from '../src/index.ts'

describe('Finance Department dedicated DeepSeek API Key', () => {
  it('correctly identifies finance department', () => {
    assert.equal(isFinanceDepartment('财务管理中心'), true)
    assert.equal(isFinanceDepartment('公司/财务管理中心/会计组'), true)
    assert.equal(isFinanceDepartment('聚服中心'), false)
    assert.equal(isFinanceDepartment(undefined), false)
  })

  it('finance API key matches user dedicated key sk-d63c951d588c4a2887e1d0b29f91f996', () => {
    const financeKey = getFinanceApiKey()
    assert.equal(financeKey, 'sk-d63c951d588c4a2887e1d0b29f91f996')
  })

  it('getBootstrapApiKey returns finance key for finance department, default key for others', () => {
    const financeKey = getBootstrapApiKey('财务管理中心')
    assert.equal(financeKey, 'sk-d63c951d588c4a2887e1d0b29f91f996')

    const defaultKey = getBootstrapApiKey('聚服中心')
    assert.equal(defaultKey, 'sk-bdf587de6046480bbd1987c1ab32dea7')
  })

  it('resolveApiKey resolves finance key for finance department', async () => {
    const financeResolved = await resolveApiKey('财务管理中心')
    assert.equal(financeResolved, 'sk-d63c951d588c4a2887e1d0b29f91f996')

    const defaultResolved = await resolveApiKey('销售中心')
    assert.equal(defaultResolved, 'sk-bdf587de6046480bbd1987c1ab32dea7')
  })

  it('patchCredentialsService resolves dedicated key based on active department', async () => {
    const fakeCredentials: any = {
      resolve: async () => ({ value: 'original' }),
      describe: async () => ({ configured: true }),
    }
    patchCredentialsService(fakeCredentials)

    // When department is 财务管理中心
    setActiveDepartment('财务管理中心')
    const financeCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(financeCred.value, 'sk-d63c951d588c4a2887e1d0b29f91f996')

    // When department is 聚服中心
    setActiveDepartment('聚服中心')
    const defaultCred = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(defaultCred.value, 'sk-bdf587de6046480bbd1987c1ab32dea7')

    // Reset
    setActiveDepartment(undefined)
  })

  it('patchLaunchEnvironment injects dedicated key into process environment', () => {
    const fakeEnv: any = {
      get: () => undefined,
      getFrom: () => undefined,
    }
    patchLaunchEnvironment(fakeEnv)

    setActiveDepartment('财务管理中心')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('财务管理中心')
    const financeResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(financeResult.value, 'sk-d63c951d588c4a2887e1d0b29f91f996')

    setActiveDepartment('聚服中心')
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey('聚服中心')
    const defaultResult = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.equal(defaultResult.value, 'sk-bdf587de6046480bbd1987c1ab32dea7')
  })
})
