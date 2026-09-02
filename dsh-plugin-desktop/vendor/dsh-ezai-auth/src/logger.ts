/** Minimal debug logger for dsh-ezai-auth host operations. */

import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

const LOG_DIR = '.dsh-ezai-auth'
const LOG_FILE = 'debug.log'
const DIR_MODE = 0o700

let logPath: string | undefined

async function ensureLogPath(): Promise<string> {
  if (logPath !== undefined) return logPath
  logPath = dshHomePath(LOG_DIR, LOG_FILE)
  await mkdir(dirname(logPath), { mode: DIR_MODE, recursive: true })
  return logPath
}

export async function ezaiLog(message: string): Promise<void> {
  try {
    const path = await ensureLogPath()
    const line = `[${new Date().toISOString()}] ${message}\n`
    await appendFile(path, line)
  } catch {
    // Logging must never break the login flow.
  }
}
