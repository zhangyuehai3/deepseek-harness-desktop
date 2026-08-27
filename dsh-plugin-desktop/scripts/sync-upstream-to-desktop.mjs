#!/usr/bin/env node
/**
 * Copy locally built upstream artifacts from the `deepseek-harness/` submodule
 * into the npm-installed packages under `dsh-plugin-desktop/node_modules/`,
 * without mixing the pnpm and Yarn workspaces.
 *
 * The script preserves each installed package's npm `package.json` so Yarn and
 * Electron Builder continue to see the published semver versions.
 */
import { spawn } from 'node:child_process'
import { cp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Repository root (parent of dsh-plugin-desktop). */
const REPO_ROOT = resolve(__dirname, '..', '..')
/** Upstream submodule root. */
const UPSTREAM_ROOT = join(REPO_ROOT, 'deepseek-harness')
/** Installed upstream packages owned by the desktop plugin. */
const DESKTOP_MODULES = join(REPO_ROOT, 'dsh-plugin-desktop', 'node_modules', '@deepseek-ai')

/**
 * Built artifact directories to sync per package. Most packages ship `lib/`;
 * the web frontend ships the browser bundle in `dist/`.
 */
const BUILT_DIRS = {
  default: ['lib'],
  '@deepseek-ai/dsh-web-frontend': ['dist'],
}

/**
 * Read the root package.json and build a map from package name to the set of
 * Yarn patch files that must be reapplied after syncing upstream artifacts.
 * Resolutions entries like:
 *   "@deepseek-ai/dsh@npm:^0.1.1-rc.2": "patch:...#./patches/dsh@0.1.1-rc.2.patch"
 * become an entry `@deepseek-ai/dsh` -> `/repo/patches/dsh@0.1.1-rc.2.patch`.
 */
async function loadPatchMap() {
  const rootPkg = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf-8'))
  const patchMap = new Map()
  for (const [key, value] of Object.entries(rootPkg.resolutions ?? {})) {
    if (typeof value !== 'string' || !value.startsWith('patch:')) continue
    const match = key.match(/^(@[^/]+\/[^@]+)/)
    if (!match) continue
    const patchPath = value.split('#')[1]
    if (!patchPath) continue
    const absolutePath = resolve(REPO_ROOT, patchPath)
    const set = patchMap.get(match[1]) ?? new Set()
    set.add(absolutePath)
    patchMap.set(match[1], set)
  }
  return patchMap
}

/**
 * Apply a unified diff to the installed package directory. The patch files are
 * produced by Yarn and name paths like `a/lib/client.js`, so `-p1` strips the
 * `a/` prefix and resolves against the package root.
 */
async function applyPatch(installedDir, patchPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'patch',
      ['-p1', '--no-backup-if-mismatch', '--input', patchPath],
      { cwd: installedDir, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`patch failed for ${installedDir} with ${patchPath}\n${stderr || stdout}`))
      } else {
        resolve()
      }
    })
  })
}

/** Remove `.orig` files that some patches create as a side effect. */
async function removeOrigFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await removeOrigFiles(path)
    } else if (entry.name.endsWith('.orig')) {
      await rm(path, { force: true })
    }
  }
}

/**
 * Build a map from package name to its upstream source directory by scanning
 * the upstream pnpm workspace packages and apps.
 */
async function buildUpstreamMap() {
  const map = new Map()
  const roots = [
    join(UPSTREAM_ROOT, 'packages'),
    join(UPSTREAM_ROOT, 'apps'),
  ]
  for (const root of roots) {
    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = join(root, entry.name)
      // packages/ is grouped: packages/<group>/<pkg>/package.json
      // apps/ is flat: apps/<app>/package.json
      if (root === join(UPSTREAM_ROOT, 'packages')) {
        const groupEntries = await readdir(dir, { withFileTypes: true })
        for (const child of groupEntries) {
          if (!child.isDirectory()) continue
          await registerPackage(map, join(dir, child.name))
        }
      } else {
        await registerPackage(map, dir)
      }
    }
  }
  return map
}

async function registerPackage(map, pkgDir) {
  const pkgJsonPath = join(pkgDir, 'package.json')
  let pkgJson
  try {
    pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'))
  } catch {
    return
  }
  if (pkgJson.name && pkgJson.name.startsWith('@deepseek-ai/')) {
    map.set(pkgJson.name, pkgDir)
  }
}

const BACKUP_SUFFIX = '.upstream-sync-backup'

async function syncPackage(name, installedDir, upstreamDir, patches) {
  const dirs = BUILT_DIRS[name] ?? BUILT_DIRS.default
  const backups = []
  try {
    for (const dir of dirs) {
      const sourceDir = join(upstreamDir, dir)
      const targetDir = join(installedDir, dir)
      try {
        await stat(sourceDir)
      } catch {
        throw new Error(`upstream build output missing for ${name}: ${sourceDir}`)
      }
      if (patches) {
        const backupDir = `${targetDir}${BACKUP_SUFFIX}`
        try {
          await stat(targetDir)
          await rm(backupDir, { recursive: true, force: true })
          await cp(targetDir, backupDir, { recursive: true, preserveTimestamps: true })
          backups.push({ targetDir, backupDir })
        } catch {
          // target did not exist; nothing to restore
        }
      }
      await rm(targetDir, { recursive: true, force: true })
      await cp(sourceDir, targetDir, { recursive: true, preserveTimestamps: true })
    }
    if (patches) {
      for (const patchPath of patches) {
        await applyPatch(installedDir, patchPath)
      }
      await removeOrigFiles(installedDir)
    }
  } catch (error) {
    for (const { targetDir, backupDir } of backups) {
      await rm(targetDir, { recursive: true, force: true }).catch(() => {})
      await cp(backupDir, targetDir, { recursive: true, preserveTimestamps: true }).catch(() => {})
      await rm(backupDir, { recursive: true, force: true }).catch(() => {})
    }
    throw error
  }
  for (const { backupDir } of backups) {
    await rm(backupDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function main() {
  const upstreamMap = await buildUpstreamMap()
  const patchMap = await loadPatchMap()
  const installedEntries = await readdir(DESKTOP_MODULES, { withFileTypes: true })
  const installedNames = installedEntries.filter(e => e.isDirectory()).map(e => e.name)
  const synced = []
  const patched = []
  const skipped = []
  const patchFailures = []
  for (const dirName of installedNames) {
    const installedDir = join(DESKTOP_MODULES, dirName)
    const pkgJsonPath = join(installedDir, 'package.json')
    let pkgJson
    try {
      pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'))
    } catch {
      continue
    }
    const name = pkgJson.name
    const upstreamDir = upstreamMap.get(name)
    if (upstreamDir === undefined) {
      skipped.push(name)
      continue
    }
    const patches = patchMap.get(name)
    try {
      await syncPackage(name, installedDir, upstreamDir, patches)
      synced.push(name)
      if (patches) patched.push(name)
    } catch (error) {
      console.error(`warning: ${error.message}`)
      patchFailures.push(name)
    }
  }

  console.log(`synced ${synced.length} upstream package(s) into ${DESKTOP_MODULES}`)
  if (patched.length > 0) {
    console.log(`reapplied patches to ${patched.length} package(s): ${patched.join(', ')}`)
  }
  if (patchFailures.length > 0) {
    console.log(`patch reapplication failed for ${patchFailures.length} package(s); npm originals preserved: ${patchFailures.join(', ')}`)
  }
  if (skipped.length > 0) {
    console.log(`skipped ${skipped.length} package(s) with no upstream source: ${skipped.join(', ')}`)
  }
  if (patchFailures.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
