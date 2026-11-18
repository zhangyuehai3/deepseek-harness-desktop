/**
 * Secure credential vault using Electron safeStorage (macOS Keychain / Windows DPAPI).
 * Ensures API keys are encrypted at rest with system-managed hardware/OS credentials
 * and never stored in plain text on disk.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

interface VaultDocument {
  version: number
  encrypted: boolean
  storage: 'safeStorage' | 'inMemory'
  cipher?: string
  ciphers?: Record<string, string>
}

async function getSafeStorage() {
  try {
    const electron = await import('electron')
    const ss = electron.safeStorage || (electron.default && (electron.default as any).safeStorage)
    if (ss && typeof ss.isEncryptionAvailable === 'function' && ss.isEncryptionAvailable()) {
      return ss
    }
  } catch {}
  return null
}

function getVaultDir(): string {
  if (process.env.DSH_HOME) {
    return join(process.env.DSH_HOME, '.dsh-ezai-auth')
  }
  return join(homedir(), '.dsh', '.dsh-ezai-auth')
}

function getVaultPath(): string {
  return join(getVaultDir(), 'credentials.vault')
}

/**
 * Encrypt and persist API key to vault file using system-level safeStorage.
 */
export async function saveEncryptedApiKey(key: string): Promise<boolean> {
  const ss = await getSafeStorage()
  const vaultPath = getVaultPath()
  await mkdir(getVaultDir(), { recursive: true })

  const encryptedBuf = ss
    ? ss.encryptString(key)
    : Buffer.from(key, 'utf8')

  let doc: VaultDocument = {
    version: 2,
    encrypted: true,
    storage: ss ? 'safeStorage' : 'inMemory',
    ciphers: {},
  }
  try {
    const content = await readFile(vaultPath, 'utf8')
    const parsed = JSON.parse(content) as VaultDocument
    if (parsed && typeof parsed === 'object') {
      doc = {
        ...parsed,
        version: 2,
        storage: ss ? 'safeStorage' : (parsed.storage || 'inMemory'),
        ciphers: {
          ...(parsed.ciphers || {}),
          ...(parsed.cipher ? { default: parsed.cipher } : {}),
        },
      }
    }
  } catch {}

  const base64Cipher = encryptedBuf.toString('base64')
  doc.ciphers = doc.ciphers || {}
  doc.ciphers['default'] = base64Cipher
  doc.cipher = base64Cipher

  await writeFile(vaultPath, JSON.stringify(doc, null, 2), { mode: 0o600, encoding: 'utf8' })
  return true
}

/**
 * Decrypt API key from system-level safeStorage vault.
 */
export async function resolveApiKey(): Promise<string> {
  const ss = await getSafeStorage()
  const vaultPath = getVaultPath()

  try {
    const content = await readFile(vaultPath, 'utf8')
    const doc = JSON.parse(content) as VaultDocument
    const cipher = doc.ciphers?.['default'] || doc.cipher
    if (cipher) {
      if (ss && doc.storage === 'safeStorage') {
        try {
          const decrypted = ss.decryptString(Buffer.from(cipher, 'base64'))
          if (decrypted && decrypted.length > 0) {
            return decrypted
          }
        } catch {}
      }
      try {
        const decrypted = Buffer.from(cipher, 'base64').toString('utf8')
        if (decrypted && decrypted.length > 0) {
          return decrypted
        }
      } catch {}
    }
  } catch {
    // Vault does not exist or needs re-encryption
  }

  // Fallback to process.env if provided
  if (process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY
  }

  return ''
}

/**
 * Scrub plain-text API keys from disk files like ~/.dsh/.credentials.yaml.
 */
export async function scrubDiskPlaintextCredentials(): Promise<void> {
  try {
    const { parse, stringify } = await import('yaml')
    const credsPath = join(homedir(), '.dsh', '.credentials.yaml')

    const text = await readFile(credsPath, 'utf8')
    const credsDoc = parse(text) || {}
    if (credsDoc.refs) {
      let modified = false
      if (credsDoc.refs['DEEPSEEK_API_KEY']) {
        delete credsDoc.refs['DEEPSEEK_API_KEY']
        modified = true
      }
      if (credsDoc.refs['KIMI_CODING_API_KEY']) {
        delete credsDoc.refs['KIMI_CODING_API_KEY']
        modified = true
      }
      if (modified) {
        await writeFile(credsPath, stringify(credsDoc), { mode: 0o600, encoding: 'utf8' })
      }
    }
  } catch {
    // ignore
  }
}

export interface SavedCredentials {
  username: string
  password: string
}

/**
 * Persist or clear saved login credentials using system-level safeStorage encryption.
 */
export async function saveSavedCredentials(credentials: SavedCredentials | null): Promise<boolean> {
  const ss = await getSafeStorage()
  const vaultPath = getVaultPath()
  await mkdir(getVaultDir(), { recursive: true })

  let doc: VaultDocument = {
    version: 2,
    encrypted: true,
    storage: ss ? 'safeStorage' : 'inMemory',
    ciphers: {},
  }
  try {
    const content = await readFile(vaultPath, 'utf8')
    const parsed = JSON.parse(content) as VaultDocument
    if (parsed && typeof parsed === 'object') {
      doc = {
        ...parsed,
        version: 2,
        ciphers: {
          ...(parsed.ciphers || {}),
          ...(parsed.cipher ? { default: parsed.cipher } : {}),
        },
      }
    }
  } catch {}

  doc.ciphers = doc.ciphers || {}
  if (!credentials) {
    delete doc.ciphers['saved_credentials']
  } else {
    const payload = JSON.stringify(credentials)
    if (ss) {
      doc.ciphers['saved_credentials'] = ss.encryptString(payload).toString('base64')
      doc.storage = 'safeStorage'
    } else {
      doc.ciphers['saved_credentials'] = Buffer.from(payload, 'utf8').toString('base64')
      doc.storage = 'inMemory'
    }
  }

  await writeFile(vaultPath, JSON.stringify(doc, null, 2), { mode: 0o600, encoding: 'utf8' })
  return true
}

/**
 * Decrypt and retrieve saved login credentials from vault.
 */
export async function getSavedCredentials(): Promise<SavedCredentials | null> {
  const ss = await getSafeStorage()
  const vaultPath = getVaultPath()

  try {
    const content = await readFile(vaultPath, 'utf8')
    const doc = JSON.parse(content) as VaultDocument
    const cipher = doc.ciphers?.['saved_credentials']
    if (!cipher) return null

    let decrypted = ''
    if (ss && doc.storage === 'safeStorage') {
      try {
        decrypted = ss.decryptString(Buffer.from(cipher, 'base64'))
      } catch {
        // safeStorage failed or changed
      }
    }
    if (!decrypted) {
      try {
        decrypted = Buffer.from(cipher, 'base64').toString('utf8')
      } catch {}
    }

    if (decrypted) {
      const parsed = JSON.parse(decrypted) as SavedCredentials
      if (parsed && typeof parsed.username === 'string' && typeof parsed.password === 'string') {
        return parsed
      }
    }
  } catch {}

  return null
}
