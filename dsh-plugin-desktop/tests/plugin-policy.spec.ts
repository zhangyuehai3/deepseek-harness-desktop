import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { composeEntries } from '@deepseek-ai/dsh-app-boot'
import {
  filterUnauthorizedPatches,
  isOfficialPlugin,
  OFFICIAL_PACKAGE_EXACT,
  prepareDesktopProfile,
  ensureDesktopProfile,
} from '../src/profile.ts'

const homes: string[] = []

function temporaryHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-desktop-plugin-policy-'))
  homes.push(home)
  return home
}

function installBundle(home: string, packageName: string, patch: string, version = '1.0.0'): string {
  const bundleDir = join(home, 'profiles', 'desktop', 'node_modules', packageName)
  mkdirSync(bundleDir, { recursive: true })
  writeFileSync(join(bundleDir, 'package.json'), JSON.stringify({
    name: packageName,
    version,
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }) + '\n')
  writeFileSync(join(bundleDir, 'cordis.patch.yml'), patch)
  writeFileSync(join(bundleDir, 'index.js'), 'export default {}\n')
  return bundleDir
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

describe('plugin whitelist policy', () => {
  describe('isOfficialPlugin', () => {
    it('allows all official @deepseek-ai scoped packages', () => {
      expect(isOfficialPlugin('@deepseek-ai/dsh-web-app')).toBe(true)
      expect(isOfficialPlugin('@deepseek-ai/cordis')).toBe(true)
      expect(isOfficialPlugin('@deepseek-ai/dsh-base')).toBe(true)
      expect(isOfficialPlugin('@deepseek-ai/dsh-agent')).toBe(true)
    })

    it('allows desktop package and its sub-entries', () => {
      expect(isOfficialPlugin('dsh-plugin-desktop')).toBe(true)
      expect(isOfficialPlugin('dsh-plugin-desktop/webserver')).toBe(true)
      expect(isOfficialPlugin('dsh-plugin-desktop/windows-pwsh-sandbox')).toBe(true)
      expect(isOfficialPlugin('dsh-plugin-desktop/diagnostics')).toBe(true)
    })

    it('allows built-in official vendor packages', () => {
      for (const pkg of OFFICIAL_PACKAGE_EXACT) {
        expect(isOfficialPlugin(pkg)).toBe(true)
      }
      expect(isOfficialPlugin('dsh-ezai-auth')).toBe(true)
      expect(isOfficialPlugin('dsh-files')).toBe(true)
      expect(isOfficialPlugin('dsh-session-purge')).toBe(true)
      expect(isOfficialPlugin('dsh-community-market')).toBe(true)
    })

    it('allows cordis internal entries', () => {
      expect(isOfficialPlugin('cordis:include')).toBe(true)
      expect(isOfficialPlugin('cordis:group')).toBe(true)
    })

    it('strictly rejects any third-party or user-created packages', () => {
      expect(isOfficialPlugin('third-party-plugin')).toBe(false)
      expect(isOfficialPlugin('@evil/hacker-plugin')).toBe(false)
      expect(isOfficialPlugin('dsh-usage-stats')).toBe(false)
      expect(isOfficialPlugin('my-custom-plugin')).toBe(false)
      expect(isOfficialPlugin('')).toBe(false)
      expect(isOfficialPlugin(undefined)).toBe(false)
      expect(isOfficialPlugin(null)).toBe(false)
    })
  })

  describe('filterUnauthorizedPatches', () => {
    it('discards inserts of unauthorized plugins and keeps official ones', () => {
      const patches = [
        {
          insert: [
            { id: 'auth', name: 'dsh-ezai-auth' },
            { id: 'unauthorized', name: 'my-custom-plugin' },
            { id: 'web', name: '@deepseek-ai/dsh-web-app' },
          ],
        },
      ]

      const filtered = filterUnauthorizedPatches(patches)
      expect(filtered).toHaveLength(1)
      const inserted = filtered[0]!.insert as Array<{ id: string, name: string }>
      expect(inserted).toHaveLength(2)
      expect(inserted.map(e => e.id)).toEqual(['auth', 'web'])
    })

    it('drops empty insert patch if all rows are unauthorized', () => {
      const patches = [
        {
          insert: [
            { id: 'bad1', name: 'malicious-plugin-1' },
            { id: 'bad2', name: 'malicious-plugin-2' },
          ],
        },
      ]

      const filtered = filterUnauthorizedPatches(patches)
      expect(filtered).toHaveLength(0)
    })

    it('drops standalone patch modifying a row to an unauthorized package name', () => {
      const patches = [
        { id: 'webserver', name: 'hijacked-webserver' },
        { id: 'official-config', config: { key: 'value' } },
      ]

      const filtered = filterUnauthorizedPatches(patches)
      expect(filtered).toHaveLength(1)
      expect(filtered[0]!.id).toBe('official-config')
    })
  })

  describe('prepareDesktopProfile with strictPlugins enforcement', () => {
    it('blocks unauthorized bundles configured in profile manifest', () => {
      const home = temporaryHome()
      const unauthorizedPkg = 'user-unauthorized-plugin'

      installBundle(
        home,
        unauthorizedPkg,
        '- insert:\n    - id: unauthorized-marker\n      name: ' + unauthorizedPkg + '\n',
      )

      const profileDir = ensureDesktopProfile(home)
      const manifestPath = join(profileDir, 'package.json')
      writeFileSync(manifestPath, JSON.stringify({
        name: 'dsh-profile-desktop',
        private: true,
        dependencies: {},
        dsh: {
          profile: {
            bundles: [
              '@deepseek-ai/dsh-base',
              '@deepseek-ai/dsh-web-app',
              unauthorizedPkg,
            ],
          },
        },
      }) + '\n')

      const prepared = prepareDesktopProfile(
        undefined,
        home,
        'darwin',
        'desktop',
        undefined,
        undefined,
        {},
        { strictPlugins: true },
      )

      const rows = composeEntries([prepared.patches])
      const markerRow = rows.find(r => r.id === 'unauthorized-marker')
      expect(markerRow).toBeUndefined()
    })

    it('blocks unauthorized plugin injection from cordis.patch.yml', () => {
      const home = temporaryHome()

      // User adds custom patch in ~/.dsh/cordis.patch.yml
      writeFileSync(join(home, 'cordis.patch.yml'), [
        '- insert:',
        '    - id: custom-injected-id',
        '      name: custom-injected-plugin',
        '- insert:',
        '    - id: legal-ezai-custom',
        '      name: dsh-ezai-auth',
      ].join('\n'))

      const prepared = prepareDesktopProfile(
        undefined,
        home,
        'darwin',
        'desktop',
        undefined,
        undefined,
        {},
        { strictPlugins: true },
      )

      const rows = composeEntries([prepared.patches])
      expect(rows.some(r => r.id === 'custom-injected-id')).toBe(false)
      expect(rows.some(r => r.id === 'legal-ezai-custom')).toBe(true)
    })
  })
})
