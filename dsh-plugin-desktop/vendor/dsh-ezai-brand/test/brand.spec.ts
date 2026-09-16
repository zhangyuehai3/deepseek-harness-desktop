/** Unit tests for the dsh-ezai-brand client bundle and packaging metadata. */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const readPackage = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('ezai brand bundle', () => {
  it('ships a ModuleLoader client bundle occupying the brand slots', () => {
    const bundle = readPackage('../lib/client.js')
    assert.match(bundle, /window\.__ModuleLoader__\.load\(\{ id: "dsh-ezai-brand"/u)
    assert.ok(bundle.includes('sidebar.brand.mark'))
    assert.ok(bundle.includes('sidebar.brand.name'))
    assert.ok(bundle.includes('conversation.hero.brand.mark'))
  })

  it('embeds the repository-owned EZAI artwork and the wordmark', () => {
    const bundle = readPackage('../lib/client.js')
    assert.ok(bundle.includes('data:image/png;base64,'))
    assert.ok(bundle.includes('金石易服'))
    assert.ok(bundle.includes('EZAI'))
    assert.equal(bundle.includes('<style'), false)
  })

  it('restores the pre-migration sidebar and hero presentation', () => {
    const bundle = readPackage('../lib/client.js')
    // Expanded brand row mark rides 40px tall; the collapsed rail re-anchors
    // on the vendored sidebar rail wrapper class (0.1.5-rc.2 pinned hash).
    assert.ok(bundle.includes('ezaiBrandMarkImg'))
    assert.ok(bundle.includes('_muAxG_railMark'))
    assert.ok(bundle.includes('height:40px'))
    // Brand button row restores the pre-migration 35px height.
    assert.ok(bundle.includes('._muAxG_brand{height:35px;'))
    // Wordmark stack: 金石易服 16px/600 over EZAI 13px/500 with tracking.
    assert.ok(bundle.includes('fontSize: 16'))
    assert.ok(bundle.includes('fontSize: 13'))
    assert.ok(bundle.includes('0.05em'))
    // Hero mark keeps the pre-migration ~47px-tall presence.
    assert.ok(bundle.includes('height: 47'))
  })

  it('declares a web client seat with slot-registry inject', () => {
    const manifest = JSON.parse(readPackage('../package.json')) as {
      dsh?: { client?: { inject?: string[]; platform?: string } }
    }
    assert.equal(manifest.dsh?.client?.platform, 'web')
    assert.ok(manifest.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-ui-sidebar'))
    assert.ok(manifest.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-ui-conversation'))
  })

  it('carries a cordis patch inserting the brand plugin', () => {
    const patch = readPackage('../cordis.patch.yml')
    assert.ok(patch.includes('id: ezai-brand'))
    assert.ok(patch.includes('name: dsh-ezai-brand'))
  })

  it('keeps the artwork pipeline anchored to the EZAI tray source', () => {
    const tray = readFileSync(new URL('../../../build/tray-icon.svg', import.meta.url), 'utf8')
    assert.ok(tray.includes('data:image/png;base64,'))
    assert.equal(/<style\b/iu.test(tray), false)
  })
})

describe('ezai brand node seat', () => {
  it('exposes an empty host apply', async () => {
    const { apply } = await import('../src/index.ts')
    assert.equal(typeof apply, 'function')
    assert.equal(apply(), undefined)
  })
})
