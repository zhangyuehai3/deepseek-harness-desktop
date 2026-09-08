/** Persistent EZAI session store: cookies + logged-in user snapshot + per-account token ledger. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { getTrustedDate } from "./trusted-time.js";
const DEFAULT_SESSION_DIR = '.dsh-ezai-auth';
const DEFAULT_SESSION_FILE = 'session.json';
const DEFAULT_TOKENS_FILE = 'account_tokens.json';
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
/**
 * Returns the current weekly cycle key (Monday 00:00:00 to Sunday 24:00:00).
 * Sunday night 24:00 (i.e. Monday 00:00:00) advances to the next week.
 * Format: "YYYY-MM-DD" of the Monday starting that week.
 */
export function getCurrentWeekKey(date = getTrustedDate()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = (day + 6) % 7; // Monday = 0, Tuesday = 1, ..., Sunday = 6
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
}
function parseSnapshot(text) {
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null)
            return undefined;
        const snapshot = parsed;
        if (typeof snapshot.cookies !== 'string')
            return undefined;
        if (typeof snapshot.user !== 'object' || snapshot.user === null)
            return undefined;
        if (typeof snapshot.loggedInAt !== 'string')
            return undefined;
        return snapshot;
    }
    catch {
        return undefined;
    }
}
export function createSessionStore(options = {}) {
    const filePath = resolve(options.sessionFile ?? dshHomePath(DEFAULT_SESSION_DIR, DEFAULT_SESSION_FILE));
    const tokensPath = resolve(options.tokensFile ?? dshHomePath(DEFAULT_SESSION_DIR, DEFAULT_TOKENS_FILE));
    async function writeSnapshot(snapshot) {
        await mkdir(dirname(filePath), { mode: DIR_MODE, recursive: true });
        if (snapshot === undefined) {
            await writeFile(filePath, '', { mode: FILE_MODE });
            return;
        }
        await writeFile(filePath, JSON.stringify(snapshot, null, 2), { mode: FILE_MODE });
    }
    async function readSnapshot() {
        try {
            const text = await readFile(filePath, 'utf8');
            if (text.trim() === '')
                return undefined;
            return parseSnapshot(text);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return undefined;
            throw error;
        }
    }
    async function readAccountTokens() {
        try {
            const text = await readFile(tokensPath, 'utf8');
            if (text.trim() === '')
                return {};
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
            return {};
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return {};
            return {};
        }
    }
    async function writeAccountTokens(tokens) {
        await mkdir(dirname(tokensPath), { mode: DIR_MODE, recursive: true });
        await writeFile(tokensPath, JSON.stringify(tokens, null, 2), { mode: FILE_MODE });
    }
    function getMaxLastActiveTime(ledger) {
        let maxTime = 0;
        for (const key of Object.keys(ledger)) {
            const item = ledger[key];
            if (typeof item === 'object' && item !== null && typeof item.lastActiveTime === 'number') {
                if (item.lastActiveTime > maxTime) {
                    maxTime = item.lastActiveTime;
                }
            }
        }
        return maxTime;
    }
    function getWeekForEntry(entry, maxLedgerActiveTime) {
        const itemActive = typeof entry === 'object' && entry !== null && typeof entry.lastActiveTime === 'number'
            ? entry.lastActiveTime
            : 0;
        const activeTime = Math.max(itemActive, maxLedgerActiveTime);
        return getCurrentWeekKey(getTrustedDate(activeTime));
    }
    function resolveUsageForWeek(entry, currentWeek) {
        if (entry === undefined)
            return 0;
        if (typeof entry === 'number') {
            return entry;
        }
        if (typeof entry === 'object' && entry !== null) {
            // If the record matches the current weekly cycle, return its usage;
            // otherwise, Sunday 24:00 (Monday 00:00) has passed and it automatically resets to 0!
            if (entry.week === currentWeek) {
                return Number(entry.used) || 0;
            }
            return 0;
        }
        return 0;
    }
    return {
        async getCookies() {
            const snapshot = await readSnapshot();
            return snapshot?.cookies;
        },
        async setCookies(cookies) {
            const ledger = await readAccountTokens();
            const maxActive = getMaxLastActiveTime(ledger);
            const currentWeek = getCurrentWeekKey(getTrustedDate(maxActive));
            const snapshot = (await readSnapshot()) ?? { cookies, user: {}, loggedInAt: new Date().toISOString(), tokenUsed: 0, weekKey: currentWeek };
            snapshot.cookies = cookies;
            await writeSnapshot(snapshot);
        },
        async getUser() {
            const snapshot = await readSnapshot();
            return snapshot?.user;
        },
        async setUser(user) {
            const accountKey = user.id || user.login_name || user.email || 'default';
            const ledger = await readAccountTokens();
            const maxActive = getMaxLastActiveTime(ledger);
            const currentWeek = getWeekForEntry(ledger[accountKey], maxActive);
            const userTokens = resolveUsageForWeek(ledger[accountKey], currentWeek);
            const snapshot = (await readSnapshot()) ?? { cookies: '', user, loggedInAt: new Date().toISOString(), tokenUsed: userTokens, weekKey: currentWeek, accountTokens: ledger };
            snapshot.user = user;
            snapshot.tokenUsed = userTokens;
            snapshot.weekKey = currentWeek;
            snapshot.accountTokens = ledger;
            snapshot.loggedInAt = new Date().toISOString();
            await writeSnapshot(snapshot);
        },
        async getPersonalInfo() {
            const snapshot = await readSnapshot();
            return snapshot?.personalInfo;
        },
        async setPersonalInfo(info) {
            const snapshot = await readSnapshot();
            if (snapshot === undefined)
                return;
            snapshot.personalInfo = info;
            await writeSnapshot(snapshot);
        },
        async clear() {
            // Clear active session snapshot while safely keeping account_tokens ledger untouched
            await writeSnapshot(undefined);
        },
        async getSnapshot() {
            const snapshot = await readSnapshot();
            if (snapshot && snapshot.user) {
                const accountKey = snapshot.user.id || snapshot.user.login_name || snapshot.user.email || 'default';
                const ledger = await readAccountTokens();
                const maxActive = getMaxLastActiveTime(ledger);
                const currentWeek = getWeekForEntry(ledger[accountKey], maxActive);
                const currentUsed = resolveUsageForWeek(ledger[accountKey], currentWeek);
                if (snapshot.tokenUsed !== currentUsed || snapshot.weekKey !== currentWeek) {
                    snapshot.tokenUsed = currentUsed;
                    snapshot.weekKey = currentWeek;
                    snapshot.accountTokens = ledger;
                    await writeSnapshot(snapshot);
                }
            }
            return snapshot;
        },
        async addTokenUsage(tokens) {
            const ledger = await readAccountTokens();
            const snapshot = (await readSnapshot()) ?? { cookies: '', user: {}, loggedInAt: new Date().toISOString(), tokenUsed: 0, weekKey: '' };
            const accountKey = snapshot.user?.id || snapshot.user?.login_name || snapshot.user?.email || 'default';
            const existingEntry = ledger[accountKey];
            const itemActive = typeof existingEntry === 'object' && existingEntry !== null && typeof existingEntry.lastActiveTime === 'number'
                ? existingEntry.lastActiveTime
                : 0;
            const maxActive = Math.max(getMaxLastActiveTime(ledger), itemActive);
            const nowTrusted = getTrustedDate(maxActive);
            const currentWeek = getCurrentWeekKey(nowTrusted);
            const currentLedgerTokens = resolveUsageForWeek(existingEntry, currentWeek);
            const next = currentLedgerTokens + Math.max(0, tokens);
            ledger[accountKey] = {
                week: currentWeek,
                used: next,
                lastActiveTime: nowTrusted.getTime(),
            };
            await writeAccountTokens(ledger);
            snapshot.tokenUsed = next;
            snapshot.weekKey = currentWeek;
            snapshot.accountTokens = ledger;
            await writeSnapshot(snapshot);
            return next;
        },
        async getTokenUsage() {
            const ledger = await readAccountTokens();
            const maxActive = getMaxLastActiveTime(ledger);
            const snapshot = await readSnapshot();
            const accountKey = snapshot?.user?.id || snapshot?.user?.login_name || snapshot?.user?.email;
            if (accountKey) {
                const currentWeek = getWeekForEntry(ledger[accountKey], maxActive);
                return resolveUsageForWeek(ledger[accountKey], currentWeek);
            }
            const currentWeek = getCurrentWeekKey(getTrustedDate(maxActive));
            return resolveUsageForWeek(snapshot?.tokenUsed, currentWeek);
        },
        async getAccountTokenUsage(userId) {
            const ledger = await readAccountTokens();
            const maxActive = getMaxLastActiveTime(ledger);
            const currentWeek = getWeekForEntry(ledger[userId], maxActive);
            return resolveUsageForWeek(ledger[userId], currentWeek);
        },
    };
}
