/** Unit tests for dsh-ezai-auth credential vault. */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getBootstrapApiKey, resolveApiKey } from '../src/vault.ts'

describe('credential vault', () => {
  it('unscrambles obfuscated bootstrap api key correctly', () => {
    const key = getBootstrapApiKey()
    assert.equal(key, 'sk-bdf587de6046480bbd1987c1ab32dea7')
    assert.equal(key.startsWith('sk-'), true)
    assert.equal(key.length, 35)
  })

  it('resolves active api key asynchronously without crashing', async () => {
    const resolved = await resolveApiKey()
    assert.equal(typeof resolved, 'string')
    assert.equal(resolved, 'sk-bdf587de6046480bbd1987c1ab32dea7')
  })

  it('saves, retrieves, and clears saved login credentials', async () => {
    const { saveSavedCredentials, getSavedCredentials } = await import('../src/vault.ts')

    // 1. Save credentials
    await saveSavedCredentials({ username: 'testuser@ezai.com', password: 'secretpassword123' })
    const loaded = await getSavedCredentials()
    assert.deepEqual(loaded, { username: 'testuser@ezai.com', password: 'secretpassword123' })

    // 2. Clear credentials
    await saveSavedCredentials(null)
    const cleared = await getSavedCredentials()
    assert.equal(cleared, null)
  })
})
