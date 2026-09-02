/** Persistent EZAI session store: cookies + logged-in user snapshot + per-account token ledger. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { EzaiUser, SessionSnapshot } from './types.ts'

const DEFAULT_SESSION_DIR = '.dsh-ezai-auth'
const DEFAULT_SESSION_FILE = 'session.json'
const DEFAULT_TOKENS_FILE = 'account_tokens.json'
const DIR_MODE = 0o700
const FILE_MODE = 0o600

export interface SessionStoreOptions {
  /** Explicit session file path; otherwise `$DSH_HOME/.dsh-ezai-auth/session.json`. */
  sessionFile?: string
  /** Explicit account tokens file path; otherwise `$DSH_HOME/.dsh-ezai-auth/account_tokens.json`. */
  tokensFile?: string
}

export interface EzaiSessionStore {
  getCookies(): Promise<string | undefined>
  setCookies(cookies: string): Promise<void>
  getUser(): Promise<EzaiUser | undefined>
  setUser(user: EzaiUser): Promise<void>
  clear(): Promise<void>
  getSnapshot(): Promise<SessionSnapshot | undefined>
  addTokenUsage(tokens: number): Promise<number>
  getTokenUsage(): Promise<number>
  getAccountTokenUsage(userId: string): Promise<number>
}

function parseSnapshot(text: string): SessionSnapshot | undefined {
  try {
    const parsed = JSON.parse(text) as unknown
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const snapshot = parsed as Partial<SessionSnapshot>
    if (typeof snapshot.cookies !== 'string') return undefined
    if (typeof snapshot.user !== 'object' || snapshot.user === null) return undefined
    if (typeof snapshot.loggedInAt !== 'string') return undefined
    return snapshot as SessionSnapshot
  } catch {
    return undefined
  }
}

export function createSessionStore(options: SessionStoreOptions = {}): EzaiSessionStore {
  const filePath = resolve(options.sessionFile ?? dshHomePath(DEFAULT_SESSION_DIR, DEFAULT_SESSION_FILE))
  const tokensPath = resolve(options.tokensFile ?? dshHomePath(DEFAULT_SESSION_DIR, DEFAULT_TOKENS_FILE))

  async function writeSnapshot(snapshot: SessionSnapshot | undefined): Promise<void> {
    await mkdir(dirname(filePath), { mode: DIR_MODE, recursive: true })
    if (snapshot === undefined) {
      await writeFile(filePath, '', { mode: FILE_MODE })
      return
    }
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), { mode: FILE_MODE })
  }

  async function readSnapshot(): Promise<SessionSnapshot | undefined> {
    try {
      const text = await readFile(filePath, 'utf8')
      if (text.trim() === '') return undefined
      return parseSnapshot(text)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async function readAccountTokens(): Promise<Record<string, number>> {
    try {
      const text = await readFile(tokensPath, 'utf8')
      if (text.trim() === '') return {}
      const parsed = JSON.parse(text) as unknown
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, number>
      }
      return {}
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      return {}
    }
  }

  async function writeAccountTokens(tokens: Record<string, number>): Promise<void> {
    await mkdir(dirname(tokensPath), { mode: DIR_MODE, recursive: true })
    await writeFile(tokensPath, JSON.stringify(tokens, null, 2), { mode: FILE_MODE })
  }

  return {
    async getCookies(): Promise<string | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.cookies
    },
    async setCookies(cookies: string): Promise<void> {
      const snapshot = (await readSnapshot()) ?? { cookies, user: {} as EzaiUser, loggedInAt: new Date().toISOString(), tokenUsed: 0 }
      snapshot.cookies = cookies
      await writeSnapshot(snapshot)
    },
    async getUser(): Promise<EzaiUser | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.user
    },
    async setUser(user: EzaiUser): Promise<void> {
      const accountKey = user.id || user.login_name || user.email || 'default'
      const ledger = await readAccountTokens()
      const userTokens = Number(ledger[accountKey]) || 0

      const snapshot = (await readSnapshot()) ?? { cookies: '', user, loggedInAt: new Date().toISOString(), tokenUsed: userTokens, accountTokens: ledger }
      snapshot.user = user
      snapshot.tokenUsed = userTokens
      snapshot.accountTokens = ledger
      snapshot.loggedInAt = new Date().toISOString()
      await writeSnapshot(snapshot)
    },
    async clear(): Promise<void> {
      // Clear active session snapshot while safely keeping account_tokens ledger untouched
      await writeSnapshot(undefined)
    },
    async getSnapshot(): Promise<SessionSnapshot | undefined> {
      return readSnapshot()
    },
    async addTokenUsage(tokens: number): Promise<number> {
      const snapshot = (await readSnapshot()) ?? { cookies: '', user: {} as EzaiUser, loggedInAt: new Date().toISOString(), tokenUsed: 0 }
      const accountKey = snapshot.user?.id || snapshot.user?.login_name || snapshot.user?.email || 'default'

      const ledger = await readAccountTokens()
      const currentLedgerTokens = Number(ledger[accountKey]) || Number(snapshot.tokenUsed) || 0
      const next = currentLedgerTokens + Math.max(0, tokens)

      ledger[accountKey] = next
      await writeAccountTokens(ledger)

      snapshot.tokenUsed = next
      snapshot.accountTokens = ledger
      await writeSnapshot(snapshot)
      return next
    },
    async getTokenUsage(): Promise<number> {
      const snapshot = await readSnapshot()
      const accountKey = snapshot?.user?.id || snapshot?.user?.login_name || snapshot?.user?.email
      if (accountKey) {
        const ledger = await readAccountTokens()
        if (ledger[accountKey] !== undefined) {
          return Number(ledger[accountKey]) || 0
        }
      }
      return Number(snapshot?.tokenUsed) || 0
    },
    async getAccountTokenUsage(userId: string): Promise<number> {
      const ledger = await readAccountTokens()
      return Number(ledger[userId]) || 0
    },
  }
}
