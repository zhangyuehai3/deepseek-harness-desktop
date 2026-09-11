import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tests = [
  ['tests/service.proxy.test.mjs'],
  ['tests/host.purge.test.mjs'],
  ['tests/client.bundle.test.mjs', 'lib/client.js'],
  ['tests/locale.relabel.test.mjs', 'lib/client.js'],
  ['tests/client.render.test.mjs', 'lib/client.js'],
]

for (const [script, ...args] of tests) {
  console.log(`\n--- Running ${script} ---`)
  const result = spawnSync(process.execPath, [resolve(here, script), ...args], {
    cwd: here,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`${script} failed with exit code ${String(result.status)}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\nAll dsh-session-purge unit tests passed!')
