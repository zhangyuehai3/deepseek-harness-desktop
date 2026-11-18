/** Unit tests for dsh-ezai-auth credential vault. */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { rm } from 'node:fs/promises'
import { resolveApiKey, saveEncryptedApiKey } from '../src/vault.ts'

describe('credential vault', () => {
  const origDshHome = process.env.DSH_HOME
  const testDshHome = `/tmp/dsh_test_vault_${Date.now()}`

  beforeEach(() => {
    process.env.DSH_HOME = testDshHome
  })

  afterEach(async () => {
    if (origDshHome !== undefined) {
      process.env.DSH_HOME = origDshHome
    } else {
      delete process.env.DSH_HOME
    }
    try {
      await rm(testDshHome, { recursive: true, force: true })
    } catch {}
  })

  it('resolves active api key asynchronously without crashing', async () => {
    const resolved = await resolveApiKey()
    assert.equal(typeof resolved, 'string')
  })

  it('saves and resolves encrypted api key', async () => {
    await saveEncryptedApiKey('sk-test-api-key-1234567890')
    const resolved = await resolveApiKey()
    assert.equal(resolved, 'sk-test-api-key-1234567890')
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
