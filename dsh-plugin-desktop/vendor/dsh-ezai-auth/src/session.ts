/** Persistent EZAI session store: cookies + logged-in user snapshot + per-account token ledger. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHmac } from 'node:crypto'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { getTrustedDate } from './trusted-time.ts'
import type { AccountWeeklyUsage, EzaiPersonalInfo, EzaiUser, SessionSnapshot } from './types.ts'

const DEFAULT_SESSION_DIR = '.dsh-ezai-auth'
const DEFAULT_SESSION_FILE = 'session.json'
const DEFAULT_TOKENS_FILE = 'account_tokens.json'
const DIR_MODE = 0o700
const FILE_MODE = 0o600

/**
 * Secret salt used to compute HMAC integrity signatures for local files.
 * Prevents employees from tampering with session.json or account_tokens.json to alter token usage.
 */
const HMAC_INTEGRITY_SALT = 'EZAI_TOKEN_LEDGER_INTEGRITY_SALT_20261117'

export function computeLedgerSignature(accountKey: string, week: string, used: number, totalUsed: number = 0, lastActiveTime: number = 0): string {
  const payload = `${accountKey}|${week}|${Math.round(used)}|${Math.round(totalUsed)}|${Math.round(lastActiveTime)}`
  return createHmac('sha256', HMAC_INTEGRITY_SALT).update(payload).digest('hex')
}

export function verifyLedgerSignature(entry: AccountWeeklyUsage | number | undefined, accountKey: string): boolean {
  if (entry === undefined || typeof entry === 'number') return false
  if (!entry._sig || typeof entry._sig !== 'string') return false
  const expected = computeLedgerSignature(
    accountKey,
    entry.week || '',
    entry.used || 0,
    entry.totalUsed || 0,
    entry.lastActiveTime || 0,
  )
  return entry._sig === expected
}

/** In-memory authoritative server checkpoints to enforce monotonicity and prevent file tampering. */
const inMemoryServerCheckpoints: Record<string, { week: string; used: number; totalUsed: number; quota?: number; timestamp: number }> = {}

/**
 * Returns the current weekly cycle key (Monday 00:00:00 to Sunday 24:00:00).
 * Sunday night 24:00 (i.e. Monday 00:00:00) advances to the next week.
 * Format: "YYYY-MM-DD" of the Monday starting that week.
 */
export function getCurrentWeekKey(date: Date = getTrustedDate()): string {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = (day + 6) % 7 // Monday = 0, Tuesday = 1, ..., Sunday = 6
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${dayOfMonth}`
}

/**
 * Checks whether a given timestamp or Date corresponds to peak hours under Beijing Time (UTC+8).
 *
 * Peak hours: Monday to Friday, 9:00 - 12:00 and 14:00 - 18:00 (Beijing Time).
 * Off-peak hours: All other times (weekends, weekday early morning, lunch break 12:00-14:00, evening).
 */
export function isPeakHours(date: Date = getTrustedDate()): boolean {
  // Convert timestamp to Beijing Time (UTC+8)
  const beijingTimeMs = date.getTime() + 8 * 60 * 60 * 1000
  const bjDate = new Date(beijingTimeMs)

  const day = bjDate.getUTCDay() // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  if (day < 1 || day > 5) {
    return false
  }

  const hour = bjDate.getUTCHours() // 0..23 in Beijing time
  const minute = bjDate.getUTCMinutes() // 0..59 in Beijing time
  const timeInMinutes = hour * 60 + minute

  // Window 1: 9:00 - 12:00 -> [540, 720)
  const morningPeak = timeInMinutes >= 9 * 60 && timeInMinutes < 12 * 60

  // Window 2: 14:00 - 18:00 -> [840, 1080)
  const afternoonPeak = timeInMinutes >= 14 * 60 && timeInMinutes < 18 * 60

  return morningPeak || afternoonPeak
}

/**
 * Returns the token billing multiplier for the given date.
 * Peak hours: 1.0 (standard price)
 * Off-peak hours: 0.5 (half price)
 */
export function getTokenRateMultiplier(date: Date = getTrustedDate()): number {
  return isPeakHours(date) ? 1.0 : 0.5
}

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
  getPersonalInfo(): Promise<EzaiPersonalInfo | undefined>
  setPersonalInfo(info: EzaiPersonalInfo): Promise<void>
  clear(): Promise<void>
  getSnapshot(): Promise<SessionSnapshot | undefined>
  addTokenUsage(tokens: number): Promise<number>
  getTokenUsage(): Promise<number>
  getTotalTokenUsage?(): Promise<number>
  syncServerUsage?(used: number, totalUsed: number, quota?: number): Promise<void>
  getAccountTokenUsage(userId: string): Promise<number>
  isCurrentPeakHours(): Promise<boolean>
  getTokenRateMultiplier(): Promise<number>
  getTokenQuota?(): Promise<number | undefined>
  setTokenQuota?(quota: number): Promise<void>
  getWhitelistDepartment?(): Promise<string | undefined>
  setWhitelistDepartment?(dept: string): Promise<void>
  getApiKey?(): Promise<string | undefined>
  setApiKey?(key: string): Promise<void>
  getDepartmentName?(): Promise<string | undefined>
  setDepartmentName?(dept: string): Promise<void>
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
    if (snapshot.user) {
      const accountKey = snapshot.user.id || snapshot.user.login_name || snapshot.user.email || 'default'
      snapshot._sig = computeLedgerSignature(
        accountKey,
        snapshot.weekKey || '',
        snapshot.tokenUsed || 0,
        snapshot.totalTokenUsed || 0,
        Date.now(),
      )
    }
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), { mode: FILE_MODE })
  }

  async function readSnapshot(): Promise<SessionSnapshot | undefined> {
    try {
      const text = await readFile(filePath, 'utf8')
      if (text.trim() === '') return undefined
      const snapshot = parseSnapshot(text)
      if (!snapshot) return undefined

      // Reconcile snapshot against in-memory authoritative checkpoints
      if (snapshot.user) {
        const accountKey = snapshot.user.id || snapshot.user.login_name || snapshot.user.email || 'default'
        const checkpoint = inMemoryServerCheckpoints[accountKey]
        if (checkpoint) {
          if (checkpoint.week === snapshot.weekKey) {
            snapshot.tokenUsed = Math.max(snapshot.tokenUsed || 0, checkpoint.used)
          }
          snapshot.totalTokenUsed = Math.max(snapshot.totalTokenUsed || 0, checkpoint.totalUsed)
        }
      }
      return snapshot
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async function readAccountTokens(): Promise<Record<string, AccountWeeklyUsage | number>> {
    try {
      const text = await readFile(tokensPath, 'utf8')
      if (text.trim() === '') return {}
      const parsed = JSON.parse(text) as unknown
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, AccountWeeklyUsage | number>
      }
      return {}
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      return {}
    }
  }

  async function writeAccountTokens(tokens: Record<string, AccountWeeklyUsage | number>): Promise<void> {
    await mkdir(dirname(tokensPath), { mode: DIR_MODE, recursive: true })
    await writeFile(tokensPath, JSON.stringify(tokens, null, 2), { mode: FILE_MODE })
  }

  function getMaxLastActiveTime(ledger: Record<string, AccountWeeklyUsage | number>): number {
    let maxTime = 0
    for (const key of Object.keys(ledger)) {
      const item = ledger[key]
      if (typeof item === 'object' && item !== null && typeof item.lastActiveTime === 'number') {
        if (item.lastActiveTime > maxTime) {
          maxTime = item.lastActiveTime
        }
      }
    }
    return maxTime
  }

  function getWeekForEntry(entry: AccountWeeklyUsage | number | undefined, maxLedgerActiveTime: number): string {
    const itemActive = typeof entry === 'object' && entry !== null && typeof entry.lastActiveTime === 'number'
      ? entry.lastActiveTime
      : 0
    const activeTime = Math.max(itemActive, maxLedgerActiveTime)
    return getCurrentWeekKey(getTrustedDate(activeTime))
  }

  function resolveUsageForWeek(
    entry: AccountWeeklyUsage | number | undefined,
    currentWeek: string,
    accountKey?: string,
  ): number {
    const checkpoint = accountKey ? inMemoryServerCheckpoints[accountKey] : undefined
    const checkpointUsed = (checkpoint && checkpoint.week === currentWeek) ? checkpoint.used : 0

    if (entry === undefined) {
      return checkpointUsed
    }

    if (typeof entry === 'number') {
      return Math.max(entry, checkpointUsed)
    }

    if (typeof entry === 'object' && entry !== null) {
      // Check if entry matches the current weekly cycle
      if (entry.week === currentWeek) {
        if (accountKey) {
          const isValid = verifyLedgerSignature(entry, accountKey)
          if (!isValid) {
            // File tampered with! Discard tampered number, use authoritative checkpoint
            return checkpointUsed
          }
        }
        const rawUsed = Number(entry.used) || 0
        return Math.max(rawUsed, checkpointUsed)
      }
      return 0
    }

    return checkpointUsed
  }

  function resolveTotalUsage(
    entry: AccountWeeklyUsage | number | undefined,
    snapshot?: SessionSnapshot,
    accountKey?: string,
  ): number {
    const checkpoint = accountKey ? inMemoryServerCheckpoints[accountKey] : undefined
    const checkpointTotal = checkpoint ? checkpoint.totalUsed : 0

    let localTotal = 0
    if (typeof entry === 'object' && entry !== null && typeof entry.totalUsed === 'number') {
      if (accountKey) {
        const isValid = verifyLedgerSignature(entry, accountKey)
        if (isValid) {
          localTotal = entry.totalUsed
        }
      } else {
        localTotal = entry.totalUsed
      }
    } else if (snapshot && typeof snapshot.totalTokenUsed === 'number') {
      localTotal = snapshot.totalTokenUsed
    }

    return Math.max(localTotal, checkpointTotal)
  }

  return {
    async getCookies(): Promise<string | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.cookies
    },
    async setCookies(cookies: string): Promise<void> {
      const ledger = await readAccountTokens()
      const maxActive = getMaxLastActiveTime(ledger)
      const currentWeek = getCurrentWeekKey(getTrustedDate(maxActive))
      const snapshot = (await readSnapshot()) ?? { cookies, user: {} as EzaiUser, loggedInAt: new Date().toISOString(), tokenUsed: 0, weekKey: currentWeek }
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
      const maxActive = getMaxLastActiveTime(ledger)
      const currentWeek = getWeekForEntry(ledger[accountKey], maxActive)
      const userTokens = resolveUsageForWeek(ledger[accountKey], currentWeek, accountKey)

      const snapshot = (await readSnapshot()) ?? { cookies: '', user, loggedInAt: new Date().toISOString(), tokenUsed: userTokens, weekKey: currentWeek, accountTokens: ledger }
      snapshot.user = user
      snapshot.tokenUsed = userTokens
      snapshot.weekKey = currentWeek
      snapshot.accountTokens = ledger
      snapshot.loggedInAt = new Date().toISOString()
      await writeSnapshot(snapshot)
    },
    async getPersonalInfo(): Promise<EzaiPersonalInfo | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.personalInfo
    },
    async setPersonalInfo(info: EzaiPersonalInfo): Promise<void> {
      const snapshot = await readSnapshot()
      if (snapshot === undefined) return
      snapshot.personalInfo = info
      await writeSnapshot(snapshot)
    },
    async getTokenQuota(): Promise<number | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.tokenQuota
    },
    async setTokenQuota(quota: number): Promise<void> {
      const snapshot = await readSnapshot()
      if (snapshot === undefined) return
      snapshot.tokenQuota = quota
      await writeSnapshot(snapshot)
    },
    async getWhitelistDepartment(): Promise<string | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.whitelistDepartment
    },
    async setWhitelistDepartment(dept: string): Promise<void> {
      const snapshot = await readSnapshot()
      if (snapshot === undefined) return
      snapshot.whitelistDepartment = dept
      await writeSnapshot(snapshot)
    },
    async getApiKey(): Promise<string | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.apiKey
    },
    async setApiKey(key: string): Promise<void> {
      const snapshot = await readSnapshot()
      if (snapshot === undefined) return
      snapshot.apiKey = key
      await writeSnapshot(snapshot)
    },
    async getDepartmentName(): Promise<string | undefined> {
      const snapshot = await readSnapshot()
      return snapshot?.departmentName
    },
    async setDepartmentName(dept: string): Promise<void> {
      const snapshot = await readSnapshot()
      if (snapshot === undefined) return
      snapshot.departmentName = dept
      await writeSnapshot(snapshot)
    },
    async clear(): Promise<void> {
      // Clear active session snapshot while safely keeping account_tokens ledger untouched
      await writeSnapshot(undefined)
    },
    async getSnapshot(): Promise<SessionSnapshot | undefined> {
      const snapshot = await readSnapshot()
      if (snapshot && snapshot.user) {
        const accountKey = snapshot.user.id || snapshot.user.login_name || snapshot.user.email || 'default'
        const ledger = await readAccountTokens()
        const maxActive = getMaxLastActiveTime(ledger)
        const currentWeek = getWeekForEntry(ledger[accountKey], maxActive)
        const currentUsed = resolveUsageForWeek(ledger[accountKey], currentWeek, accountKey)
        const currentTotal = resolveTotalUsage(ledger[accountKey], snapshot, accountKey)

        if (snapshot.tokenUsed !== currentUsed || snapshot.weekKey !== currentWeek || snapshot.totalTokenUsed !== currentTotal) {
          snapshot.tokenUsed = currentUsed
          snapshot.totalTokenUsed = currentTotal
          snapshot.weekKey = currentWeek
          snapshot.accountTokens = ledger
          await writeSnapshot(snapshot)
        }
      }
      return snapshot
    },
    async addTokenUsage(tokens: number): Promise<number> {
      const ledger = await readAccountTokens()
      const snapshot = (await readSnapshot()) ?? { cookies: '', user: {} as EzaiUser, loggedInAt: new Date().toISOString(), tokenUsed: 0, weekKey: '' }
      const accountKey = snapshot.user?.id || snapshot.user?.login_name || snapshot.user?.email || 'default'

      const existingEntry = ledger[accountKey]
      const itemActive = typeof existingEntry === 'object' && existingEntry !== null && typeof existingEntry.lastActiveTime === 'number'
        ? existingEntry.lastActiveTime
        : 0
      const maxActive = Math.max(getMaxLastActiveTime(ledger), itemActive)
      const nowTrusted = getTrustedDate(maxActive)
      const currentWeek = getCurrentWeekKey(nowTrusted)

      const currentLedgerTokens = resolveUsageForWeek(existingEntry, currentWeek, accountKey)
      const multiplier = getTokenRateMultiplier(nowTrusted)
      const billedTokens = Math.round(Math.max(0, tokens) * multiplier)
      const next = currentLedgerTokens + billedTokens

      const existingTotal = resolveTotalUsage(existingEntry, snapshot, accountKey)
      const nextTotal = existingTotal + billedTokens
      const nowMs = nowTrusted.getTime()

      // Update in-memory authoritative checkpoint
      inMemoryServerCheckpoints[accountKey] = {
        week: currentWeek,
        used: next,
        totalUsed: nextTotal,
        timestamp: nowMs,
      }

      const sig = computeLedgerSignature(accountKey, currentWeek, next, nextTotal, nowMs)
      ledger[accountKey] = {
        week: currentWeek,
        used: next,
        totalUsed: nextTotal,
        lastActiveTime: nowMs,
        _sig: sig,
      }
      await writeAccountTokens(ledger)

      snapshot.tokenUsed = next
      snapshot.totalTokenUsed = nextTotal
      snapshot.weekKey = currentWeek
      snapshot.accountTokens = ledger
      await writeSnapshot(snapshot)
      return next
    },
    async syncServerUsage(used: number, totalUsed: number, quota?: number): Promise<void> {
      const ledger = await readAccountTokens()
      const snapshot = (await readSnapshot()) ?? { cookies: '', user: {} as EzaiUser, loggedInAt: new Date().toISOString(), tokenUsed: 0, weekKey: '' }
      const accountKey = snapshot.user?.id || snapshot.user?.login_name || snapshot.user?.email || 'default'

      const existingEntry = ledger[accountKey]
      const itemActive = typeof existingEntry === 'object' && existingEntry !== null && typeof existingEntry.lastActiveTime === 'number'
        ? existingEntry.lastActiveTime
        : Date.now()
      const currentWeek = getCurrentWeekKey(getTrustedDate(itemActive))

      const cleanUsed = Math.max(0, Number(used) || 0)
      const cleanTotalUsed = Math.max(0, Number(totalUsed) || 0)

      // Ensure monotonicity against existing checkpoints
      const existingCheckpoint = inMemoryServerCheckpoints[accountKey]
      const finalUsed = (existingCheckpoint && existingCheckpoint.week === currentWeek)
        ? Math.max(existingCheckpoint.used, cleanUsed)
        : cleanUsed
      const finalTotalUsed = existingCheckpoint
        ? Math.max(existingCheckpoint.totalUsed, cleanTotalUsed)
        : cleanTotalUsed

      const nowMs = Date.now()
      inMemoryServerCheckpoints[accountKey] = {
        week: currentWeek,
        used: finalUsed,
        totalUsed: finalTotalUsed,
        quota: quota ?? existingCheckpoint?.quota,
        timestamp: nowMs,
      }

      const sig = computeLedgerSignature(accountKey, currentWeek, finalUsed, finalTotalUsed, nowMs)
      ledger[accountKey] = {
        week: currentWeek,
        used: finalUsed,
        totalUsed: finalTotalUsed,
        lastActiveTime: nowMs,
        _sig: sig,
      }
      await writeAccountTokens(ledger)

      snapshot.tokenUsed = finalUsed
      snapshot.totalTokenUsed = finalTotalUsed
      if (typeof quota === 'number' && quota > 0) {
        snapshot.tokenQuota = quota
      }
      snapshot.weekKey = currentWeek
      snapshot.accountTokens = ledger
      await writeSnapshot(snapshot)
    },
    async getTotalTokenUsage(): Promise<number> {
      const ledger = await readAccountTokens()
      const snapshot = await readSnapshot()
      const accountKey = snapshot?.user?.id || snapshot?.user?.login_name || snapshot?.user?.email
      return resolveTotalUsage(accountKey ? ledger[accountKey] : undefined, snapshot, accountKey)
    },
    async getTokenUsage(): Promise<number> {
      const ledger = await readAccountTokens()
      const maxActive = getMaxLastActiveTime(ledger)
      const snapshot = await readSnapshot()
      const accountKey = snapshot?.user?.id || snapshot?.user?.login_name || snapshot?.user?.email
      if (accountKey) {
        const currentWeek = getWeekForEntry(ledger[accountKey], maxActive)
        return resolveUsageForWeek(ledger[accountKey], currentWeek, accountKey)
      }
      const currentWeek = getCurrentWeekKey(getTrustedDate(maxActive))
      return resolveUsageForWeek(snapshot?.tokenUsed, currentWeek)
    },
    async getAccountTokenUsage(userId: string): Promise<number> {
      const ledger = await readAccountTokens()
      const maxActive = getMaxLastActiveTime(ledger)
      const currentWeek = getWeekForEntry(ledger[userId], maxActive)
      return resolveUsageForWeek(ledger[userId], currentWeek, userId)
    },
    async isCurrentPeakHours(): Promise<boolean> {
      const ledger = await readAccountTokens()
      const maxActive = getMaxLastActiveTime(ledger)
      const nowTrusted = getTrustedDate(maxActive)
      return isPeakHours(nowTrusted)
    },
    async getTokenRateMultiplier(): Promise<number> {
      const ledger = await readAccountTokens()
      const maxActive = getMaxLastActiveTime(ledger)
      const nowTrusted = getTrustedDate(maxActive)
      return getTokenRateMultiplier(nowTrusted)
    },
  }
}
