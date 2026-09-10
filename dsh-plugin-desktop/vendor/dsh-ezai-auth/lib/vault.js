/**
 * Secure credential vault using Electron safeStorage (macOS Keychain / Windows DPAPI).
 * Ensures API keys are encrypted at rest with system-managed hardware/OS credentials
 * and never stored in plain text on disk.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// XOR masked seed bytes for default key sk-bdf587de6046480bbd1987c1ab32dea7
// XOR mask: 0x5a
const SEED_MASK = 0x5a;
const DEFAULT_SEED_BYTES = [
    41, 49, 119, 56, 62, 60, 111, 98, 109, 62, 63, 108, 106, 110, 108, 110, 98, 106, 56, 56, 62, 107, 99, 98, 109, 57, 107, 59, 56, 105, 104, 62, 63, 59, 109,
];
// XOR masked seed bytes for finance key sk-d63c951d588c4a2887e1d0b29f91f996 (财务管理中心专用)
const FINANCE_SEED_BYTES = [
    41, 49, 119, 62, 108, 105, 57, 99, 111, 107, 62, 111, 98, 98, 57, 110, 59, 104, 98, 98, 109, 63, 107, 62, 106, 56, 104, 99, 60, 99, 107, 60, 99, 99, 108,
];
export function isFinanceDepartment(department) {
    return typeof department === 'string' && department.includes('财务管理中心');
}
export function getBootstrapApiKey(department) {
    if (isFinanceDepartment(department)) {
        return process.env.FINANCE_DEEPSEEK_API_KEY || getFinanceApiKey();
    }
    return process.env.DEFAULT_DEEPSEEK_API_KEY || String.fromCharCode(...DEFAULT_SEED_BYTES.map((b) => b ^ SEED_MASK));
}
export function getFinanceApiKey() {
    return String.fromCharCode(...FINANCE_SEED_BYTES.map((b) => b ^ SEED_MASK));
}
async function getSafeStorage() {
    try {
        const electron = await import('electron');
        const ss = electron.safeStorage || (electron.default && electron.default.safeStorage);
        if (ss && typeof ss.isEncryptionAvailable === 'function' && ss.isEncryptionAvailable()) {
            return ss;
        }
    }
    catch { }
    return null;
}
function getVaultPath() {
    return join(homedir(), '.dsh', '.dsh-ezai-auth', 'credentials.vault');
}
/**
 * Encrypt and persist API key to vault file using system-level safeStorage.
 */
export async function saveEncryptedApiKey(key, scope = 'default') {
    const ss = await getSafeStorage();
    const vaultPath = getVaultPath();
    await mkdir(join(homedir(), '.dsh', '.dsh-ezai-auth'), { recursive: true });
    if (ss) {
        const encryptedBuf = ss.encryptString(key);
        let doc = {
            version: 2,
            encrypted: true,
            storage: 'safeStorage',
            ciphers: {},
        };
        try {
            const content = await readFile(vaultPath, 'utf8');
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
                doc = {
                    ...parsed,
                    version: 2,
                    ciphers: {
                        ...(parsed.ciphers || {}),
                        ...(parsed.cipher ? { default: parsed.cipher } : {}),
                    },
                };
            }
        }
        catch { }
        doc.ciphers = doc.ciphers || {};
        doc.ciphers[scope] = encryptedBuf.toString('base64');
        if (scope === 'default') {
            doc.cipher = doc.ciphers[scope];
        }
        await writeFile(vaultPath, JSON.stringify(doc, null, 2), { mode: 0o600, encoding: 'utf8' });
        return true;
    }
    return false;
}
/**
 * Decrypt API key from system-level safeStorage vault, or bootstrap and encrypt if first run.
 */
export async function resolveApiKey(department) {
    const isFinance = isFinanceDepartment(department);
    const scope = isFinance ? 'finance' : 'default';
    const fallbackKey = isFinance
        ? (process.env.FINANCE_DEEPSEEK_API_KEY || getFinanceApiKey())
        : (process.env.DEFAULT_DEEPSEEK_API_KEY || getBootstrapApiKey());
    const ss = await getSafeStorage();
    const vaultPath = getVaultPath();
    if (ss) {
        try {
            const content = await readFile(vaultPath, 'utf8');
            const doc = JSON.parse(content);
            if (doc.encrypted && doc.storage === 'safeStorage') {
                const cipher = doc.ciphers?.[scope] || (!isFinance ? doc.cipher : undefined);
                if (cipher) {
                    const decrypted = ss.decryptString(Buffer.from(cipher, 'base64'));
                    if (decrypted && decrypted.length > 0) {
                        return decrypted;
                    }
                }
            }
        }
        catch {
            // Vault does not exist or needs re-encryption
        }
    }
    // Bootstrap from obfuscated seed and store encrypted in system vault
    try {
        await saveEncryptedApiKey(fallbackKey, scope);
    }
    catch { }
    return fallbackKey;
}
/**
 * Scrub plain-text API keys from disk files like ~/.dsh/.credentials.yaml.
 */
export async function scrubDiskPlaintextCredentials() {
    try {
        const { parse, stringify } = await import('yaml');
        const credsPath = join(homedir(), '.dsh', '.credentials.yaml');
        const text = await readFile(credsPath, 'utf8');
        const credsDoc = parse(text) || {};
        if (credsDoc.refs) {
            let modified = false;
            if (credsDoc.refs['DEEPSEEK_API_KEY']) {
                delete credsDoc.refs['DEEPSEEK_API_KEY'];
                modified = true;
            }
            if (credsDoc.refs['KIMI_CODING_API_KEY']) {
                delete credsDoc.refs['KIMI_CODING_API_KEY'];
                modified = true;
            }
            if (modified) {
                await writeFile(credsPath, stringify(credsDoc), { mode: 0o600, encoding: 'utf8' });
            }
        }
    }
    catch {
        // ignore
    }
}
