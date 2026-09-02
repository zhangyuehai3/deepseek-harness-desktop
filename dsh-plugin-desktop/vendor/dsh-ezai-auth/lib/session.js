/** Persistent EZAI session store: cookies + logged-in user snapshot + per-account token ledger. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
const DEFAULT_SESSION_DIR = '.dsh-ezai-auth';
const DEFAULT_SESSION_FILE = 'session.json';
const DEFAULT_TOKENS_FILE = 'account_tokens.json';
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
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
    return {
        async getCookies() {
            const snapshot = await readSnapshot();
            return snapshot?.cookies;
        },
        async setCookies(cookies) {
            const snapshot = (await readSnapshot()) ?? { cookies, user: {}, loggedInAt: new Date().toISOString(), tokenUsed: 0 };
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
            const userTokens = Number(ledger[accountKey]) || 0;
            const snapshot = (await readSnapshot()) ?? { cookies: '', user, loggedInAt: new Date().toISOString(), tokenUsed: userTokens, accountTokens: ledger };
            snapshot.user = user;
            snapshot.tokenUsed = userTokens;
            snapshot.accountTokens = ledger;
            snapshot.loggedInAt = new Date().toISOString();
            await writeSnapshot(snapshot);
        },
        async clear() {
            // Clear active session snapshot while safely keeping account_tokens ledger untouched
            await writeSnapshot(undefined);
        },
        async getSnapshot() {
            return readSnapshot();
        },
        async addTokenUsage(tokens) {
            const snapshot = (await readSnapshot()) ?? { cookies: '', user: {}, loggedInAt: new Date().toISOString(), tokenUsed: 0 };
            const accountKey = snapshot.user?.id || snapshot.user?.login_name || snapshot.user?.email || 'default';
            const ledger = await readAccountTokens();
            const currentLedgerTokens = Number(ledger[accountKey]) || Number(snapshot.tokenUsed) || 0;
            const next = currentLedgerTokens + Math.max(0, tokens);
            ledger[accountKey] = next;
            await writeAccountTokens(ledger);
            snapshot.tokenUsed = next;
            snapshot.accountTokens = ledger;
            await writeSnapshot(snapshot);
            return next;
        },
        async getTokenUsage() {
            const snapshot = await readSnapshot();
            const accountKey = snapshot?.user?.id || snapshot?.user?.login_name || snapshot?.user?.email;
            if (accountKey) {
                const ledger = await readAccountTokens();
                if (ledger[accountKey] !== undefined) {
                    return Number(ledger[accountKey]) || 0;
                }
            }
            return Number(snapshot?.tokenUsed) || 0;
        },
        async getAccountTokenUsage(userId) {
            const ledger = await readAccountTokens();
            return Number(ledger[userId]) || 0;
        },
    };
}
