#!/usr/bin/env node
/**
 * Copy locally built upstream artifacts from the `deepseek-harness/` submodule
 * into the npm-installed packages under `dsh-plugin-desktop/node_modules/`,
 * without mixing the pnpm and Yarn workspaces.
 *
 * The script preserves each installed package's npm `package.json` so Yarn and
 * Electron Builder continue to see the published semver versions.
 */
import { cp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
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
 * Read the root package.json and collect package names whose installed copies
 * are replaced by Yarn patch: resolutions. Syncing would overwrite the patch,
 * so these are skipped.
 */
async function loadPatchedPackageNames() {
  const rootPkg = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf-8'))
  const patched = new Set()
  for (const key of Object.keys(rootPkg.resolutions ?? {})) {
    const value = rootPkg.resolutions[key]
    if (typeof value === 'string' && value.startsWith('patch:')) {
      const match = key.match(/^(@[^/]+\/[^@]+)/)
      if (match) patched.add(match[1])
    }
  }
  return patched
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

async function syncPackage(name, installedDir, upstreamDir) {
  const dirs = BUILT_DIRS[name] ?? BUILT_DIRS.default
  for (const dir of dirs) {
    const sourceDir = join(upstreamDir, dir)
    const targetDir = join(installedDir, dir)
    try {
      await stat(sourceDir)
    } catch {
      throw new Error(`upstream build output missing for ${name}: ${sourceDir}`)
    }
    await rm(targetDir, { recursive: true, force: true })
    await cp(sourceDir, targetDir, { recursive: true, preserveTimestamps: true })
  }
}

async function main() {
  const upstreamMap = await buildUpstreamMap()
  const patchedNames = await loadPatchedPackageNames()
  const installedEntries = await readdir(DESKTOP_MODULES, { withFileTypes: true })
  const installedNames = installedEntries.filter(e => e.isDirectory()).map(e => e.name)
  const synced = []
  const skipped = []
  const skippedPatches = []
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
    if (patchedNames.has(name)) {
      skippedPatches.push(name)
      continue
    }
    const upstreamDir = upstreamMap.get(name)
    if (upstreamDir === undefined) {
      skipped.push(name)
      continue
    }
    await syncPackage(name, installedDir, upstreamDir)
    synced.push(name)
  }

  console.log(`synced ${synced.length} upstream package(s) into ${DESKTOP_MODULES}`)
  if (skippedPatches.length > 0) {
    console.log(`skipped ${skippedPatches.length} patched package(s): ${skippedPatches.join(', ')}`)
  }
  if (skipped.length > 0) {
    console.log(`skipped ${skipped.length} package(s) with no upstream source: ${skipped.join(', ')}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
