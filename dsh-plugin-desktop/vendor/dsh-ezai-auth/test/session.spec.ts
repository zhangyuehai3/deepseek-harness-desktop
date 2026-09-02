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
})
