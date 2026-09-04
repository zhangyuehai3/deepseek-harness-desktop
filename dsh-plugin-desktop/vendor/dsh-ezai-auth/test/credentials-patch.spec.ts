/** Unit tests for dsh-ezai-auth credentials and launchEnvironment patching. */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { patchCredentialsService, patchLaunchEnvironment } from '../src/index.ts'
import { getBootstrapApiKey } from '../src/vault.ts'

describe('credentials & launchEnvironment patching', () => {
  const originalEnvKey = process.env.DEEPSEEK_API_KEY

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey()
  })

  afterEach(() => {
    if (originalEnvKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = originalEnvKey
    } else {
      delete process.env.DEEPSEEK_API_KEY
    }
  })

  it('patches fake credentials service and resolves DEEPSEEK_API_KEY', async () => {
    const fakeCredentials = {
      resolve: async (ref: string) => undefined,
      describe: async (ref: string) => ({ configured: false, writable: true }),
    }

    patchCredentialsService(fakeCredentials)

    const resolved = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.deepEqual(resolved, {
      value: 'sk-bdf587de6046480bbd1987c1ab32dea7',
      source: 'env',
    })

    const described = await fakeCredentials.describe('DEEPSEEK_API_KEY')
    assert.deepEqual(described, {
      configured: true,
      source: 'env',
      writable: false,
    })

    // Other refs pass through to original
    const other = await fakeCredentials.resolve('OTHER_KEY')
    assert.equal(other, undefined)
  })

  it('returns undefined when user is logged out / DEEPSEEK_API_KEY deleted', async () => {
    delete process.env.DEEPSEEK_API_KEY

    const fakeCredentials = {
      resolve: async (ref: string) => undefined,
      describe: async (ref: string) => ({ configured: false, writable: true }),
    }

    patchCredentialsService(fakeCredentials)

    const resolved = await fakeCredentials.resolve('DEEPSEEK_API_KEY')
    assert.equal(resolved, undefined)

    const described = await fakeCredentials.describe('DEEPSEEK_API_KEY')
    assert.deepEqual(described, {
      configured: false,
      writable: true,
    })
  })

  it('patches fake launchEnvironment and provides DEEPSEEK_API_KEY', () => {
    const fakeEnv = {
      get: (name: string) => undefined,
      getFrom: (name: string, sources: readonly string[]) => undefined,
    }

    patchLaunchEnvironment(fakeEnv)

    const entry = fakeEnv.get('DEEPSEEK_API_KEY')
    assert.deepEqual(entry, {
      value: 'sk-bdf587de6046480bbd1987c1ab32dea7',
      source: 'process',
    })

    const entryFrom = fakeEnv.getFrom('DEEPSEEK_API_KEY', ['process'])
    assert.deepEqual(entryFrom, {
      value: 'sk-bdf587de6046480bbd1987c1ab32dea7',
      source: 'process',
    })
  })
})
