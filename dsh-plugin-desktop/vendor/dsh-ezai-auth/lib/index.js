/** dsh-ezai-auth — host face: EZAI account login/session/token usage. */
import z from '@deepseek-ai/schemastery';
import { createEzaiClient } from "./api.js";
import { createSessionStore } from "./session.js";
export const name = 'dsh-ezai-auth';
export const inject = ['webServer'];
export const Config = z.object({
    baseURL: z.string().default('https://www.ezsvsbox.com'),
    loginPath: z.string().default('/login'),
    captchaPath: z.string().default('/captcha/box'),
    tokenQuota: z.number().default(200_000_000),
    sessionFile: z.string().default(''),
});
const MAX_BODY_BYTES = 4 * 1024;
function finishJson(res, statusCode, value) {
    res.statusCode = statusCode;
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(JSON.stringify(value));
}
function error(message) {
    return { error: message };
}
function isLoopbackHostname(hostname) {
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}
function parseHost(raw) {
    const input = raw.trim();
    if (input === '')
        return null;
    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `http://${input}`);
        return { hostname: url.hostname };
    }
    catch {
        return null;
    }
}
function networkGuard(req) {
    const rawHost = String(req.headers.host ?? '');
    const parsedHost = parseHost(rawHost);
    if (parsedHost === null)
        return 'forbidden: malformed host';
    if (!isLoopbackHostname(parsedHost.hostname))
        return 'forbidden: non-loopback host';
    const origin = req.headers.origin;
    if (origin !== undefined) {
        const parsedOrigin = parseHost(origin);
        if (parsedOrigin === null || parsedOrigin.hostname !== parsedHost.hostname) {
            return 'forbidden: cross-origin';
        }
    }
    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite !== undefined && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
        return 'forbidden: cross-site';
    }
    return null;
}
async function readJson(req) {
    const declaredLength = req.headers['content-length'];
    if (declaredLength !== undefined) {
        if (!/^\d+$/.test(declaredLength))
            throw new SyntaxError('invalid content length');
        if (Number(declaredLength) > MAX_BODY_BYTES)
            throw new Error('body too large');
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        if (size > MAX_BODY_BYTES)
            throw new Error('body too large');
        chunks.push(buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(text);
}
function assertLoginRequest(body) {
    if (typeof body !== 'object' || body === null)
        throw new Error('invalid login body');
    const { username, password, captcha, cookies } = body;
    if (typeof username !== 'string' || username.trim() === '')
        throw new Error('username required');
    if (typeof password !== 'string' || password === '')
        throw new Error('password required');
    if (typeof captcha !== 'string' || captcha.trim() === '')
        throw new Error('captcha required');
    if (typeof cookies !== 'string')
        throw new Error('captcha cookies required');
    return { username: username.trim(), password, captcha: captcha.trim(), cookies };
}
// Ensure domestic AI API traffic bypasses local HTTP proxies (Shadowrocket / Clash / Charles)
const BYPASS_HOSTS = [
    'api.deepseek.com',
    '*.deepseek.com',
    'api.kimi.com',
    '*.kimi.com',
    'moonshot.cn',
    '*.moonshot.cn',
    'www.ezsvsbox.com',
    '*.ezsvsbox.com',
    'localhost',
    '127.0.0.1',
];
const existingNoProxy = process.env.NO_PROXY || process.env.no_proxy || '';
const mergedNoProxy = existingNoProxy
    ? `${existingNoProxy},${BYPASS_HOSTS.join(',')}`
    : BYPASS_HOSTS.join(',');
process.env.NO_PROXY = mergedNoProxy;
process.env.no_proxy = mergedNoProxy;
import { getBootstrapApiKey, resolveApiKey, scrubDiskPlaintextCredentials } from "./vault.js";
const DEEPSEEK_OPENAI_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
// Initialize in-memory DEEPSEEK_API_KEY if not already provided
if (!process.env.DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = getBootstrapApiKey();
}
// Asynchronously hydrate from safeStorage vault and scrub plaintext credentials from disk
void (async () => {
    try {
        process.env.DEEPSEEK_API_KEY = await resolveApiKey();
        await scrubDiskPlaintextCredentials();
    }
    catch { }
})();
const DEEPSEEK_MODELS = [
    {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        contextWindow: 1000000,
        maxTokens: 256000,
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        contextWindow: 65536,
        maxTokens: 8192,
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        contextWindow: 65536,
        maxTokens: 8192,
    },
];
export function patchCredentialsService(credentials) {
    if (!credentials || credentials.__ezaiCredentialPatched)
        return;
    credentials.__ezaiCredentialPatched = true;
    const origResolve = credentials.resolve?.bind(credentials);
    if (origResolve) {
        credentials.resolve = async (ref) => {
            if (ref === 'DEEPSEEK_API_KEY') {
                if (!process.env.DEEPSEEK_API_KEY)
                    return undefined;
                const apiKey = await resolveApiKey();
                if (apiKey)
                    return { value: apiKey, source: 'env' };
            }
            return origResolve(ref);
        };
    }
    const origDescribe = credentials.describe?.bind(credentials);
    if (origDescribe) {
        credentials.describe = async (ref) => {
            if (ref === 'DEEPSEEK_API_KEY') {
                if (!process.env.DEEPSEEK_API_KEY) {
                    return { configured: false, writable: true };
                }
                return { configured: true, source: 'env', writable: false };
            }
            return origDescribe(ref);
        };
    }
}
export function patchLaunchEnvironment(env) {
    if (!env || env.__ezaiEnvPatched)
        return;
    env.__ezaiEnvPatched = true;
    const origGet = env.get?.bind(env);
    if (origGet) {
        env.get = (name) => {
            if (name === 'DEEPSEEK_API_KEY') {
                if (!process.env.DEEPSEEK_API_KEY)
                    return undefined;
                const key = process.env.DEEPSEEK_API_KEY || getBootstrapApiKey();
                return { value: key, source: 'process' };
            }
            return origGet(name);
        };
    }
    const origGetFrom = env.getFrom?.bind(env);
    if (origGetFrom) {
        env.getFrom = (name, sources) => {
            if (name === 'DEEPSEEK_API_KEY' && (!sources || sources.includes('process'))) {
                if (!process.env.DEEPSEEK_API_KEY)
                    return undefined;
                const key = process.env.DEEPSEEK_API_KEY || getBootstrapApiKey();
                return { value: key, source: 'process' };
            }
            return origGetFrom(name, sources);
        };
    }
}
async function ensureDefaultModelConfig(ctx) {
    const apiKey = await resolveApiKey();
    process.env.DEEPSEEK_API_KEY = apiKey;
    // 1. Ensure in Cordis credentials
    try {
        const credentials = ctx.get?.('credentials');
        if (credentials) {
            patchCredentialsService(credentials);
        }
    }
    catch { }
    // 2. Ensure in Cordis launchEnvironment
    try {
        const env = ctx.get?.('launchEnvironment');
        if (env) {
            patchLaunchEnvironment(env);
        }
    }
    catch { }
    // 3. Ensure in Cordis settings & agentDefaultModel
    try {
        const settings = ctx.get('settings');
        if (settings?.replace) {
            const { settingsNamespace } = await import('@deepseek-ai/dsh-settings');
            const piAiNs = settingsNamespace('llm-pi-ai');
            const currentPiAi = (await settings.get?.(piAiNs)) ?? {};
            const currentProviders = { ...(currentPiAi.providers ?? {}) };
            delete currentProviders['kimi-coding'];
            currentProviders['deepseek'] = {
                displayName: 'DeepSeek',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'openai-completions',
                baseURL: DEEPSEEK_OPENAI_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            currentProviders['deepseek-anthropic'] = {
                displayName: 'DeepSeek (Anthropic)',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'anthropic-messages',
                baseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            await settings.replace(piAiNs, {
                ...currentPiAi,
                providers: currentProviders,
            });
            const defaultModelNs = settingsNamespace('agent-default-model');
            await settings.replace(defaultModelNs, {
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
            });
        }
        const agentDefaultModel = ctx.get('agentDefaultModel');
        if (agentDefaultModel?.saveSelection) {
            await agentDefaultModel.saveSelection({
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
            });
        }
    }
    catch {
        // ignore
    }
    // 3. Ensure disk config in ~/.dsh/settings.yaml, ~/.dsh/profiles/desktop/settings.json, and .credentials.yaml
    try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const { homedir } = await import('node:os');
        const { parse, stringify } = await import('yaml');
        const dshDir = path.join(homedir(), '.dsh');
        const settingsPath = path.join(dshDir, 'settings.yaml');
        const credsPath = path.join(dshDir, '.credentials.yaml');
        const profileDesktopSettingsPath = path.join(dshDir, 'profiles', 'desktop', 'settings.json');
        // Root settings.yaml
        try {
            let settingsDoc = {};
            try {
                const text = await fs.readFile(settingsPath, 'utf8');
                settingsDoc = parse(text) || {};
            }
            catch { }
            settingsDoc['llm-pi-ai'] = settingsDoc['llm-pi-ai'] || {};
            settingsDoc['llm-pi-ai'].providers = settingsDoc['llm-pi-ai'].providers || {};
            delete settingsDoc['llm-pi-ai'].providers['kimi-coding'];
            settingsDoc['llm-pi-ai'].providers['deepseek'] = {
                displayName: 'DeepSeek',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'openai-completions',
                baseURL: DEEPSEEK_OPENAI_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            settingsDoc['llm-pi-ai'].providers['deepseek-anthropic'] = {
                displayName: 'DeepSeek (Anthropic)',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'anthropic-messages',
                baseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            settingsDoc['agent-default-model'] = {
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
            };
            await fs.writeFile(settingsPath, stringify(settingsDoc), 'utf8');
        }
        catch { }
        // Profile desktop settings.json if exists
        try {
            let profileDoc = {};
            try {
                const text = await fs.readFile(profileDesktopSettingsPath, 'utf8');
                profileDoc = JSON.parse(text) || {};
            }
            catch { }
            profileDoc['llm-pi-ai'] = profileDoc['llm-pi-ai'] || {};
            profileDoc['llm-pi-ai'].providers = profileDoc['llm-pi-ai'].providers || {};
            delete profileDoc['llm-pi-ai'].providers['kimi-coding'];
            profileDoc['llm-pi-ai'].providers['deepseek'] = {
                displayName: 'DeepSeek',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'openai-completions',
                baseURL: DEEPSEEK_OPENAI_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            profileDoc['llm-pi-ai'].providers['deepseek-anthropic'] = {
                displayName: 'DeepSeek (Anthropic)',
                apiKeyEnv: 'DEEPSEEK_API_KEY',
                api: 'anthropic-messages',
                baseURL: DEEPSEEK_ANTHROPIC_BASE_URL,
                models: DEEPSEEK_MODELS,
            };
            profileDoc['agent-default-model'] = {
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
            };
            await fs.mkdir(path.dirname(profileDesktopSettingsPath), { recursive: true });
            await fs.writeFile(profileDesktopSettingsPath, JSON.stringify(profileDoc, null, 2), 'utf8');
        }
        catch { }
        // Root .credentials.yaml: Scrub plain-text keys to ensure zero plaintext credential leak on disk
        await scrubDiskPlaintextCredentials();
    }
    catch { }
}
async function removeDefaultModelConfig(ctx) {
    // Clear in-memory env
    delete process.env.DEEPSEEK_API_KEY;
    // 1. Remove credential from Cordis credentials
    try {
        const credentials = ctx.get?.('credentials');
        if (credentials?.unset) {
            await credentials.unset('DEEPSEEK_API_KEY');
            await credentials.unset('KIMI_CODING_API_KEY');
        }
    }
    catch {
        // ignore
    }
    // 2. Remove settings for llm-pi-ai and agent-default-model
    try {
        const settings = ctx.get('settings');
        if (settings?.replace) {
            const { settingsNamespace } = await import('@deepseek-ai/dsh-settings');
            const piAiNs = settingsNamespace('llm-pi-ai');
            const currentPiAi = (await settings.get?.(piAiNs)) ?? {};
            const currentProviders = { ...(currentPiAi.providers ?? {}) };
            delete currentProviders['deepseek'];
            delete currentProviders['deepseek-anthropic'];
            delete currentProviders['kimi-coding'];
            await settings.replace(piAiNs, {
                ...currentPiAi,
                providers: currentProviders,
            });
            const defaultModelNs = settingsNamespace('agent-default-model');
            await settings.replace(defaultModelNs, undefined);
        }
    }
    catch {
        // ignore
    }
    // 3. Fallback: also clean directly from disk files
    try {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const { homedir } = await import('node:os');
        const { parse, stringify } = await import('yaml');
        const dshDir = path.join(homedir(), '.dsh');
        const settingsPath = path.join(dshDir, 'settings.yaml');
        const credsPath = path.join(dshDir, '.credentials.yaml');
        const profileDesktopSettingsPath = path.join(dshDir, 'profiles', 'desktop', 'settings.json');
        try {
            const settingsContent = await fs.readFile(settingsPath, 'utf8');
            const settingsDoc = parse(settingsContent) || {};
            if (settingsDoc['llm-pi-ai']?.providers) {
                delete settingsDoc['llm-pi-ai'].providers['deepseek'];
                delete settingsDoc['llm-pi-ai'].providers['deepseek-anthropic'];
                delete settingsDoc['llm-pi-ai'].providers['kimi-coding'];
                if (Object.keys(settingsDoc['llm-pi-ai'].providers).length === 0) {
                    delete settingsDoc['llm-pi-ai'].providers;
                }
            }
            if (settingsDoc['agent-default-model']?.provider === 'deepseek' || settingsDoc['agent-default-model']?.provider === 'kimi-coding') {
                delete settingsDoc['agent-default-model'];
            }
            await fs.writeFile(settingsPath, stringify(settingsDoc), 'utf8');
        }
        catch { }
        try {
            const profileText = await fs.readFile(profileDesktopSettingsPath, 'utf8');
            const profileDoc = JSON.parse(profileText) || {};
            if (profileDoc['llm-pi-ai']?.providers) {
                delete profileDoc['llm-pi-ai'].providers['deepseek'];
                delete profileDoc['llm-pi-ai'].providers['deepseek-anthropic'];
                delete profileDoc['llm-pi-ai'].providers['kimi-coding'];
                if (Object.keys(profileDoc['llm-pi-ai'].providers).length === 0) {
                    delete profileDoc['llm-pi-ai'].providers;
                }
            }
            if (profileDoc['agent-default-model']?.provider === 'deepseek' || profileDoc['agent-default-model']?.provider === 'kimi-coding') {
                delete profileDoc['agent-default-model'];
            }
            await fs.writeFile(profileDesktopSettingsPath, JSON.stringify(profileDoc, null, 2), 'utf8');
        }
        catch { }
        await scrubDiskPlaintextCredentials();
    }
    catch { }
}
const DISALLOWED_DEPARTMENT_NOTICE = '亲爱的同事，您好：\n\n十分感谢您对 EZAI 桌面智能助手的关注与支持！\n目前本体验版本专为【聚服中心】进行深度业务定制与专项定向内测，暂未面向其他部门开放使用。\n\n研发团队正在紧锣密鼓地推进跨业务线的适配与功能升级，后续更多部门的开放已在紧密排期中，敬请期待！\n\n为保障您的数据安全与系统状态一致，系统已为您安全退出登录并已清除本地配置。感谢您的理解与温暖包容！';
/** Allowed departments (matches if the user's department string contains any of these). */
export const ALLOWED_DEPARTMENTS = ['聚服中心'];
/** Individual users whitelist allowed to log in even if outside the allowed departments. */
export const ALLOWED_USERS_WHITELIST = [
    { email: 'qiukai@ezaigc.com', name: '裘恺' },
];
/**
 * Determine whether a user is permitted to use EZAI Desktop:
 * 1. Matches individual user whitelist (by email e.g. qiukai@ezaigc.com, or name e.g. 裘恺);
 * 2. Or belongs to an allowed department (e.g. '聚服中心').
 */
export function isUserAllowed(user, personalInfo, username) {
    // 1. Check user whitelist by email (case-insensitive) and name (exact match)
    const candidateEmails = [
        user?.email,
        personalInfo?.email,
        username && username.includes('@') ? username : undefined,
    ]
        .filter((v) => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim().toLowerCase());
    const candidateNames = [
        user?.name,
        personalInfo?.name,
    ]
        .filter((v) => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim());
    for (const allowed of ALLOWED_USERS_WHITELIST) {
        if (allowed.email && candidateEmails.includes(allowed.email.toLowerCase())) {
            return true;
        }
        if (allowed.name && candidateNames.includes(allowed.name)) {
            return true;
        }
    }
    // 2. Check department restriction
    const department = (personalInfo?.department || '').trim();
    if (department && ALLOWED_DEPARTMENTS.some(dept => department.includes(dept))) {
        return true;
    }
    return false;
}
export function apply(ctx, config) {
    const session = createSessionStore({ sessionFile: config.sessionFile || undefined });
    const client = createEzaiClient(config, session);
    // Hook credentials and launchEnvironment safely via ctx.get and ctx.inject
    try {
        const currentCredentials = ctx.get?.('credentials');
        if (currentCredentials)
            patchCredentialsService(currentCredentials);
    }
    catch { }
    try {
        const currentEnv = ctx.get?.('launchEnvironment');
        if (currentEnv)
            patchLaunchEnvironment(currentEnv);
    }
    catch { }
    try {
        ctx.inject(['credentials'], (credCtx) => {
            const creds = credCtx.get?.('credentials');
            if (creds)
                patchCredentialsService(creds);
        });
    }
    catch { }
    // Ensure model config matches active session on boot
    void (async () => {
        try {
            const snapshot = await session.getSnapshot();
            if (snapshot?.user && snapshot.cookies && isUserAllowed(snapshot.user, snapshot.personalInfo)) {
                await ensureDefaultModelConfig(ctx);
            }
            else {
                if (snapshot?.user && !isUserAllowed(snapshot.user, snapshot.personalInfo)) {
                    await session.clear();
                }
                await removeDefaultModelConfig(ctx);
            }
        }
        catch {
            // ignore
        }
    })();
    // The captcha handler seeds cookies by hitting the login page, then returns
    // the captcha image plus the cookies the client must send back with login.
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/api/ezai-auth/captcha',
        handler: async (req, res) => {
            const guard = networkGuard(req);
            if (guard !== null) {
                finishJson(res, 403, error(guard));
                return;
            }
            if (req.method !== 'GET') {
                finishJson(res, 405, error('method not allowed'));
                return;
            }
            try {
                const { image, contentType, cookies } = await client.fetchCaptcha();
                const imageBase64 = image.toString('base64');
                const payload = { imageBase64: `data:${contentType};base64,${imageBase64}`, contentType, cookies };
                finishJson(res, 200, payload);
            }
            catch (err) {
                finishJson(res, 502, error(err instanceof Error ? err.message : 'captcha failed'));
            }
        },
    }));
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/api/ezai-auth/login',
        handler: async (req, res) => {
            const guard = networkGuard(req);
            if (guard !== null) {
                finishJson(res, 403, error(guard));
                return;
            }
            if (req.method !== 'POST') {
                finishJson(res, 405, error('method not allowed'));
                return;
            }
            try {
                const body = await readJson(req);
                const { username, password, captcha, cookies } = assertLoginRequest(body);
                const { user, cookies: responseCookies } = await client.login(username, password, captcha, cookies);
                await session.setCookies(responseCookies);
                await session.setUser(user);
                // Fetch enriched personal details from /personalDetails
                let personalInfo;
                try {
                    personalInfo = await client.fetchPersonalInfo(responseCookies);
                    if (personalInfo) {
                        await session.setPersonalInfo(personalInfo);
                    }
                }
                catch { }
                // Check access permission: department '聚服中心' or individual whitelist (e.g. JS000021 裘恺)
                const department = (personalInfo?.department || '').trim();
                const allowed = isUserAllowed(user, personalInfo, username);
                if (!allowed) {
                    // Delete session and remove all model configurations immediately
                    await session.clear();
                    await removeDefaultModelConfig(ctx);
                    finishJson(res, 403, {
                        status_code: 403,
                        message: DISALLOWED_DEPARTMENT_NOTICE,
                        error: DISALLOWED_DEPARTMENT_NOTICE,
                        departmentDisallowed: true,
                        department: department || '未知部门',
                    });
                    return;
                }
                await ensureDefaultModelConfig(ctx);
                finishJson(res, 200, { status_code: 200, message: '登录成功', user, personalInfo });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : '登录失败';
                finishJson(res, 401, { status_code: 401, message: msg, error: msg });
            }
        },
    }));
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/api/ezai-auth/account',
        handler: async (req, res) => {
            const guard = networkGuard(req);
            if (guard !== null) {
                finishJson(res, 403, error(guard));
                return;
            }
            if (req.method !== 'GET') {
                finishJson(res, 405, error('method not allowed'));
                return;
            }
            try {
                const snapshot = await session.getSnapshot();
                if (snapshot === undefined || !snapshot.user || !snapshot.cookies) {
                    await removeDefaultModelConfig(ctx);
                    finishJson(res, 401, error('not logged in'));
                    return;
                }
                // 1. Local TTL safety check (30 days)
                const loggedInTime = new Date(snapshot.loggedInAt).getTime();
                const isExpiredByTime = Number.isNaN(loggedInTime) || (Date.now() - loggedInTime > 30 * 24 * 3600 * 1000);
                if (isExpiredByTime) {
                    await session.clear();
                    await removeDefaultModelConfig(ctx);
                    finishJson(res, 401, { status_code: 401, message: '登录凭据已过期，请重新登录', error: 'session_expired' });
                    return;
                }
                // 2. Remote Validation against EZAI platform
                const validation = await client.validateSession(snapshot.cookies);
                if (!validation.valid) {
                    await session.clear();
                    await removeDefaultModelConfig(ctx);
                    finishJson(res, 401, { status_code: 401, message: '登录凭据已失效，请重新登录', error: 'session_expired' });
                    return;
                }
                // 3. Resolve personalInfo (from snapshot or lazily fetched)
                let personalInfo = snapshot.personalInfo;
                if (!personalInfo && snapshot.cookies) {
                    try {
                        personalInfo = await client.fetchPersonalInfo(snapshot.cookies);
                        if (personalInfo) {
                            await session.setPersonalInfo(personalInfo);
                        }
                    }
                    catch { }
                }
                // 4. Access permission check: department '聚服中心' or individual whitelist (e.g. JS000021 裘恺)
                const department = (personalInfo?.department || '').trim();
                if (!isUserAllowed(snapshot.user, personalInfo, snapshot.user.login_name)) {
                    await session.clear();
                    await removeDefaultModelConfig(ctx);
                    finishJson(res, 403, {
                        status_code: 403,
                        message: DISALLOWED_DEPARTMENT_NOTICE,
                        error: DISALLOWED_DEPARTMENT_NOTICE,
                        departmentDisallowed: true,
                        department: department || '未知部门',
                    });
                    return;
                }
                const tokenUsage = await client.fetchTokenUsage();
                const payload = {
                    user: snapshot.user,
                    personalInfo,
                    tokenUsage,
                    warning: validation.unverified ? '网络连接异常，当前显示离线状态' : undefined,
                };
                finishJson(res, 200, payload);
            }
            catch (err) {
                finishJson(res, 500, error(err instanceof Error ? err.message : 'account failed'));
            }
        },
    }));
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: '/api/ezai-auth/logout',
        handler: async (req, res) => {
            const guard = networkGuard(req);
            if (guard !== null) {
                finishJson(res, 403, error(guard));
                return;
            }
            if (req.method !== 'POST') {
                finishJson(res, 405, error('method not allowed'));
                return;
            }
            try {
                await session.clear();
                await removeDefaultModelConfig(ctx);
                finishJson(res, 200, { ok: true });
            }
            catch (err) {
                finishJson(res, 500, error(err instanceof Error ? err.message : 'logout failed'));
            }
        },
    }));
    // 4. Intercept Agent request configuration: Default to deepseek & deepseek-v4-flash
    ctx.on('agent/request', async (_payload, next) => {
        try {
            const creds = ctx.get?.('credentials');
            if (creds)
                patchCredentialsService(creds);
            const env = ctx.get?.('launchEnvironment');
            if (env)
                patchLaunchEnvironment(env);
        }
        catch { }
        const isServed = (p) => {
            if (!p || p === 'kimi-coding')
                return false;
            const llm = ctx.get?.('llm');
            return !llm || !llm.listProviders || llm.listProviders().some((entry) => entry.id === p);
        };
        const requested = await next();
        if (!requested || !requested.provider || !isServed(requested.provider)) {
            return {
                ...requested,
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
            };
        }
        return requested;
    });
    // 5. Intercept LLM streaming: redirect legacy requests, enforce 200k quota & track tokens
    ctx.on('llm/stream', async function* (options, next) {
        try {
            const creds = ctx.get?.('credentials');
            if (creds)
                patchCredentialsService(creds);
            const env = ctx.get?.('launchEnvironment');
            if (env)
                patchLaunchEnvironment(env);
        }
        catch { }
        const isServed = (p) => {
            if (!p || p === 'kimi-coding')
                return false;
            const llm = ctx.get?.('llm');
            return !llm || !llm.listProviders || llm.listProviders().some((entry) => entry.id === p);
        };
        // Seamless fallback: If a request targets unserved or legacy provider, redirect to deepseek & deepseek-v4-flash
        if (options && (!options.provider || !isServed(options.provider))) {
            options.provider = 'deepseek';
            options.model = 'deepseek-v4-flash';
        }
        const snapshot = await session.getSnapshot();
        const currentUsed = Number(snapshot?.tokenUsed) || 0;
        const quota = Number(config.tokenQuota) || 200_000_000;
        // Strict quota check: block model calls if limit is reached
        if (currentUsed >= quota) {
            yield {
                type: 'finish',
                reason: {
                    kind: 'error',
                    failure: {
                        code: 'QUOTA_EXCEEDED',
                        message: `EZAI Token 额度已达到上限 (${currentUsed.toLocaleString()} / ${quota.toLocaleString()} Tokens)，已禁止继续使用模型。`,
                    },
                },
            };
            return;
        }
        let requestTokens = 0;
        for await (const chunk of next()) {
            if (chunk && chunk.type === 'usage' && chunk.usage) {
                const input = Number(chunk.usage.inputTokens) || 0;
                const output = Number(chunk.usage.outputTokens) || 0;
                const cacheRead = Number(chunk.usage.cacheReadTokens) || 0;
                const cacheWrite = Number(chunk.usage.cacheWriteTokens) || 0;
                const total = input + output + cacheRead + cacheWrite;
                if (total > 0) {
                    requestTokens = total;
                }
            }
            yield chunk;
        }
        if (requestTokens > 0) {
            await session.addTokenUsage(requestTokens);
        }
    });
}
